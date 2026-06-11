/* =============================================
   AJIGS CONNECT — erp.js
   Full Management System Logic
   Supabase Backend
   ============================================= */

'use strict';

// =====================================================
//  SUPABASE CONFIG  — replace with your project values
// =====================================================
const SUPABASE_URL  = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY  = 'YOUR_SUPABASE_ANON_KEY';

// =====================================================
//  SUPABASE FETCH HELPER
// =====================================================
async function sb(path, method = 'GET', body = null, extra = {}) {
  const token = localStorage.getItem('ajigs_token');
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Prefer': 'return=representation',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, ...extra });
  if (res.status === 401) { doLogout(); return null; }
  if (res.status === 204 || res.headers.get('content-length') === '0') return [];
  return await res.json();
}

// =====================================================
//  STATE
// =====================================================
let currentUser = null;
let editingId   = {};  // { jobs, invoices, clients, expenses, staff, users }

// Invoice items array during create/edit
let invItemsArr = [];

// =====================================================
//  AUTH
// =====================================================
async function initAuth() {
  const token = localStorage.getItem('ajigs_token');
  const email = localStorage.getItem('ajigs_user_email');
  if (!token || !email) { window.location.href = 'login.html'; return; }

  // Load current user profile from users table
  const rows = await sb(`app_users?email=eq.${encodeURIComponent(email)}&select=*`);
  if (!rows || rows.length === 0) {
    // Fallback: use stored info
    currentUser = { name: email.split('@')[0], email, role: 'Staff' };
  } else {
    currentUser = rows[0];
  }

  document.getElementById('topbar-name').textContent  = currentUser.name;
  document.getElementById('topbar-role').textContent  = currentUser.role;
  document.getElementById('topbar-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

  // Hide Users nav for non-Proprietor
  if (currentUser.role !== 'Proprietor') {
    const el = document.getElementById('nav-users');
    if (el) el.style.display = 'none';
  }

  // Load dashboard
  navTo('dashboard', document.querySelector('[data-panel="dashboard"]'));
}

function doLogout() {
  localStorage.removeItem('ajigs_token');
  localStorage.removeItem('ajigs_refresh');
  localStorage.removeItem('ajigs_user_email');
  window.location.href = 'login.html';
}

// =====================================================
//  NAVIGATION
// =====================================================
function navTo(panel, el) {
  // Update sidebar
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  // Show panel
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + panel);
  if (target) target.classList.add('active');

  // Load data
  const loaders = {
    dashboard: renderDashboard,
    jobs:      renderJobs,
    invoices:  renderInvoices,
    clients:   renderClients,
    expenses:  renderExpenses,
    staff:     renderStaff,
    reports:   renderReports,
    users:     renderUsers,
    profile:   renderProfile,
  };
  if (loaders[panel]) loaders[panel]();
}

// =====================================================
//  HELPERS
// =====================================================
function fmtMoney(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMoneyShort(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function today() { return new Date().toISOString().split('T')[0]; }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}
function statusBadge(s) {
  const map = {
    'Pending':    'pending',
    'In Progress':'progress',
    'Completed':  'completed',
    'Invoiced':   'invoiced',
    'Paid':       'paid',
    'Unpaid':     'unpaid',
    'Active':     'active',
    'Inactive':   'inactive',
  };
  return badge(s, map[s] || 'orange');
}

function canDelete() { return currentUser && currentUser.role === 'Proprietor'; }

// =====================================================
//  DASHBOARD
// =====================================================
async function renderDashboard() {
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  // Fetch data
  const [invoices, jobs, expenses] = await Promise.all([
    sb('invoices?select=*&order=id.desc'),
    sb('jobs?select=*&order=id.desc'),
    sb('expenses?select=*'),
  ]);

  if (!invoices || !jobs || !expenses) return;

  const paidInv   = invoices.filter(i => i.status === 'Paid');
  const unpaidInv = invoices.filter(i => i.status === 'Unpaid');
  const totalRev  = paidInv.reduce((s, i)  => s + invTotal(i), 0);
  const pendingRev= unpaidInv.reduce((s, i) => s + invTotal(i), 0);
  const totalExp  = expenses.reduce((s, e)  => s + Number(e.amount || 0), 0);
  const netProfit = totalRev - totalExp;
  const activeJobs= jobs.filter(j => j.status === 'In Progress').length;

  // Stat cards
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card orange"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmtMoneyShort(totalRev)}</div><div class="stat-sub">From paid invoices</div></div>
    <div class="stat-card red"><div class="stat-label">Pending Payments</div><div class="stat-value">${fmtMoneyShort(pendingRev)}</div><div class="stat-sub">Outstanding balance</div></div>
    <div class="stat-card blue"><div class="stat-label">Total Expenses</div><div class="stat-value">${fmtMoneyShort(totalExp)}</div></div>
    <div class="stat-card green"><div class="stat-label">Net Profit</div><div class="stat-value">${fmtMoneyShort(netProfit)}</div></div>
    <div class="stat-card purple"><div class="stat-label">Active Jobs</div><div class="stat-value">${activeJobs}</div></div>
    <div class="stat-card gray"><div class="stat-label">Total Invoices</div><div class="stat-value">${invoices.length}</div></div>
  `;

  // Revenue by service
  const services = ['Fumigation','Cleaning','Laundry','Upholstery'];
  const colors   = ['progress-orange','progress-blue','progress-green','progress-purple'];
  const svcRevData = services.map(svc => {
    const svcInv = invoices.filter(inv => {
      const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
      return items.some(it => (it.name || '').toUpperCase().includes(svc.toUpperCase()));
    });
    const paid   = svcInv.filter(i => i.status === 'Paid').reduce((s, i) => s + invTotal(i), 0);
    const unpaid = svcInv.filter(i => i.status !== 'Paid').reduce((s, i) => s + invTotal(i), 0);
    return { svc, paid, unpaid };
  });
  const maxSvc = Math.max(1, ...svcRevData.map(d => d.paid + d.unpaid));

  document.getElementById('dash-by-service').innerHTML = svcRevData.map((d, i) => {
    const pct = Math.round((d.paid / maxSvc) * 100);
    return `
    <div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;font-weight:600;">${d.svc}</div>
      <div class="progress-track"><div class="progress-fill ${colors[i]}" style="width:${pct}%"></div></div>
      <div class="progress-amount" style="text-align:right;font-size:12px;">${fmtMoneyShort(d.paid)}</div>
      <div style="width:70px;text-align:right;font-size:11.5px;color:var(--gray-400);">${fmtMoneyShort(d.unpaid)} due</div>
    </div>`;
  }).join('');

  // Job status overview
  const statuses = ['Pending','In Progress','Completed','Invoiced'];
  const sCls     = ['pending','progress','completed','invoiced'];
  document.getElementById('dash-job-status').innerHTML = statuses.map((s, i) => {
    const cnt = jobs.filter(j => j.status === s).length;
    const pct = jobs.length ? Math.round(cnt / jobs.length * 100) : 0;
    return `
    <div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;">${s}</div>
      <div class="progress-track"><div class="progress-fill progress-orange" style="width:${pct}%"></div></div>
      <div class="progress-amount">${cnt} job${cnt !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');

  // Recent jobs table
  const recent = jobs.slice(0, 7);
  if (!recent.length) {
    document.getElementById('dash-recent-jobs').innerHTML = '<p style="padding:1rem;color:var(--gray-400);font-size:13.5px;">No jobs yet. Create your first job.</p>';
    return;
  }
  document.getElementById('dash-recent-jobs').innerHTML = `
    <table style="min-width:auto;">
      <thead><tr><th>Client</th><th>Service</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${recent.map(j => `
        <tr>
          <td><strong>${j.client_name}</strong></td>
          <td>${j.service}</td>
          <td>${fmtDate(j.scheduled_date)}</td>
          <td>${fmtMoneyShort(j.amount)}</td>
          <td>${statusBadge(j.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// =====================================================
//  JOBS
// =====================================================
async function renderJobs() {
  const search  = (document.getElementById('job-search') || {}).value || '';
  const fStatus = (document.getElementById('job-filter-status') || {}).value || '';
  const fSvc    = (document.getElementById('job-filter-service') || {}).value || '';

  let qs = 'jobs?select=*&order=id.desc';
  if (fStatus) qs += `&status=eq.${encodeURIComponent(fStatus)}`;
  if (fSvc)    qs += `&service=eq.${encodeURIComponent(fSvc)}`;

  const jobs = await sb(qs);
  if (!jobs) return;

  const filtered = search
    ? jobs.filter(j =>
        (j.client_name  || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.service      || '').toLowerCase().includes(search.toLowerCase()) ||
        (j.assigned_staff || '').toLowerCase().includes(search.toLowerCase()))
    : jobs;

  const subtitle = document.getElementById('jobs-subtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} job(s)`;

  const tbody = document.getElementById('jobs-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="td-empty"><td colspan="8">No jobs found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(j => `
    <tr>
      <td><strong>#${j.id}</strong></td>
      <td>
        <strong>${j.client_name}</strong>
        ${j.client_phone ? `<br><span class="text-muted" style="font-size:12px;">${j.client_phone}</span>` : ''}
      </td>
      <td>${j.service}</td>
      <td>${fmtDate(j.scheduled_date)}</td>
      <td>${j.assigned_staff || '<span class="text-muted">—</span>'}</td>
      <td>${fmtMoneyShort(j.amount)}</td>
      <td>${statusBadge(j.status)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editJob(${j.id})" title="Edit">✏️</button>
          ${canDelete() ? `<button class="btn btn-icon btn-sm" onclick="deleteJob(${j.id})" title="Delete">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function openJobModal(id = null) {
  editingId.jobs = id;
  document.getElementById('modal-job-title').textContent = id ? 'Edit Job' : 'New Job';

  // Load staff for dropdown
  const staff = await sb('staff?status=eq.Active&select=name&order=name.asc');
  const staffEl = document.getElementById('job-staff');
  staffEl.innerHTML = '<option value="">-- Unassigned --</option>' +
    (staff || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  if (id) {
    const rows = await sb(`jobs?id=eq.${id}&select=*`);
    if (!rows || !rows.length) return;
    const j = rows[0];
    document.getElementById('job-client').value  = j.client_name || '';
    document.getElementById('job-phone').value   = j.client_phone || '';
    document.getElementById('job-address').value = j.client_address || '';
    document.getElementById('job-service').value = j.service || '';
    document.getElementById('job-date').value    = j.scheduled_date || '';
    document.getElementById('job-staff').value   = j.assigned_staff || '';
    document.getElementById('job-amount').value  = j.amount || '';
    document.getElementById('job-status').value  = j.status || 'Pending';
    document.getElementById('job-desc').value    = j.description || '';
  } else {
    ['job-client','job-phone','job-address','job-amount','job-desc'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('job-service').value = '';
    document.getElementById('job-date').value    = today();
    document.getElementById('job-status').value  = 'Pending';
  }
  openModal('modal-job');
}

async function editJob(id) { await openJobModal(id); }

async function saveJob() {
  const client  = document.getElementById('job-client').value.trim();
  const service = document.getElementById('job-service').value;
  if (!client || !service) { alert('Client name and service are required.'); return; }

  const data = {
    client_name:     client,
    client_phone:    document.getElementById('job-phone').value.trim(),
    client_address:  document.getElementById('job-address').value.trim(),
    service:         service,
    scheduled_date:  document.getElementById('job-date').value || null,
    assigned_staff:  document.getElementById('job-staff').value || null,
    amount:          Number(document.getElementById('job-amount').value) || 0,
    status:          document.getElementById('job-status').value,
    description:     document.getElementById('job-desc').value.trim(),
    created_by:      currentUser.name,
  };

  if (editingId.jobs) {
    await sb(`jobs?id=eq.${editingId.jobs}`, 'PATCH', data);
  } else {
    await sb('jobs', 'POST', { ...data, created_at: new Date().toISOString() });
  }
  closeModal('modal-job');
  renderJobs();
}

async function deleteJob(id) {
  if (!confirm('Delete this job? This cannot be undone.')) return;
  await sb(`jobs?id=eq.${id}`, 'DELETE');
  renderJobs();
}

// =====================================================
//  INVOICES
// =====================================================
function invTotal(inv) {
  const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
  return items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);
}

async function renderInvoices() {
  const search  = (document.getElementById('inv-search') || {}).value || '';
  const fStatus = (document.getElementById('inv-filter-status') || {}).value || '';

  let qs = 'invoices?select=*&order=id.desc';
  if (fStatus) qs += `&status=eq.${encodeURIComponent(fStatus)}`;

  const invoices = await sb(qs);
  if (!invoices) return;

  const filtered = search
    ? invoices.filter(i =>
        (i.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(i.id).includes(search))
    : invoices;

  const subtitle = document.getElementById('inv-subtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} invoice(s)`;

  const tbody = document.getElementById('invoices-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="td-empty"><td colspan="7">No invoices found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const names = items.map(it => it.name).join(', ');
    const total = invTotal(inv);
    return `
      <tr>
        <td><strong>INV-${inv.id}</strong></td>
        <td>${inv.client_name}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${names}">${names}</td>
        <td>${fmtDate(inv.invoice_date)}</td>
        <td><strong>${fmtMoneyShort(total)}</strong></td>
        <td>${statusBadge(inv.status)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="viewInvoice(${inv.id})" title="View & Print">👁</button>
            <button class="btn btn-icon btn-sm" onclick="toggleInvStatus(${inv.id},'${inv.status}')" title="Toggle Paid/Unpaid">${inv.status === 'Paid' ? '↩️' : '✅'}</button>
            <button class="btn btn-icon btn-sm" onclick="editInvoice(${inv.id})" title="Edit">✏️</button>
            ${canDelete() ? `<button class="btn btn-icon btn-sm" onclick="deleteInvoice(${inv.id})" title="Delete">🗑️</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openInvoiceModal(id = null) {
  editingId.invoices = id;
  invItemsArr = [];
  document.getElementById('modal-inv-title').textContent = id ? 'Edit Invoice' : 'New Invoice';

  if (!id) {
    document.getElementById('cinv-client').value = '';
    document.getElementById('cinv-caddr').value  = '';
    document.getElementById('cinv-date').value   = today();
    document.getElementById('cinv-due').value    = today();
    document.getElementById('cinv-status').value = 'Unpaid';
    invItemsArr = [{ name: '', desc: '', qty: 1, price: 0 }];
    refreshInvItems();
    openModal('modal-invoice-create');
    return;
  }
  // Load existing
  sb(`invoices?id=eq.${id}&select=*`).then(rows => {
    if (!rows || !rows.length) return;
    const inv = rows[0];
    document.getElementById('cinv-client').value = inv.client_name || '';
    document.getElementById('cinv-caddr').value  = inv.client_address || '';
    document.getElementById('cinv-date').value   = inv.invoice_date || today();
    document.getElementById('cinv-due').value    = inv.due_date || today();
    document.getElementById('cinv-status').value = inv.status || 'Unpaid';
    invItemsArr = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    refreshInvItems();
    openModal('modal-invoice-create');
  });
}

function editInvoice(id) { openInvoiceModal(id); }

function addInvItem() {
  invItemsArr.push({ name: '', desc: '', qty: 1, price: 0 });
  refreshInvItems();
}

function removeInvItem(idx) {
  invItemsArr.splice(idx, 1);
  refreshInvItems();
}

function refreshInvItems() {
  const wrap = document.getElementById('cinv-items-wrap');
  if (!wrap) return;

  wrap.innerHTML = invItemsArr.map((item, i) => `
    <div class="inv-item-row" id="inv-item-${i}">
      <div class="inv-item-header">
        <div class="inv-item-num">Item ${i + 1}</div>
        ${invItemsArr.length > 1 ? `<button class="btn btn-danger btn-xs" onclick="removeInvItem(${i})">Remove</button>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Service / Item Name (e.g. FUMIGATION SERVICE)</label>
        <input class="form-control" value="${item.name || ''}"
          oninput="invItemsArr[${i}].name=this.value"
          placeholder="CLEANING SERVICE" style="text-transform:uppercase;">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" rows="2"
          oninput="invItemsArr[${i}].desc=this.value"
          placeholder="Professional cleaning for a duplex…">${item.desc || ''}</textarea>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Qty</label>
          <input class="form-control" type="number" min="1" value="${item.qty || 1}"
            oninput="invItemsArr[${i}].qty=Number(this.value)||1; updateRunningTotal()">
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price (₦)</label>
          <input class="form-control" type="number" min="0" value="${item.price || 0}"
            oninput="invItemsArr[${i}].price=Number(this.value)||0; updateRunningTotal()">
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input class="form-control" readonly
            value="${fmtMoney((item.qty || 1) * (item.price || 0))}"
            id="inv-line-${i}">
        </div>
      </div>
    </div>`).join('');

  updateRunningTotal();
}

function updateRunningTotal() {
  const total = invItemsArr.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);
  const el = document.getElementById('cinv-running-total');
  if (el) el.textContent = fmtMoney(total);
  // Update line totals
  invItemsArr.forEach((it, i) => {
    const el = document.getElementById(`inv-line-${i}`);
    if (el) el.value = fmtMoney((it.qty || 1) * (it.price || 0));
  });
}

async function saveInvoice() {
  const client = document.getElementById('cinv-client').value.trim();
  if (!client) { alert('Client name is required.'); return; }
  if (!invItemsArr.length) { alert('Add at least one line item.'); return; }

  const data = {
    client_name:    client,
    client_address: document.getElementById('cinv-caddr').value.trim(),
    invoice_date:   document.getElementById('cinv-date').value || today(),
    due_date:       document.getElementById('cinv-due').value  || today(),
    items:          JSON.stringify(invItemsArr),
    status:         document.getElementById('cinv-status').value,
    created_by:     currentUser.name,
  };

  if (editingId.invoices) {
    await sb(`invoices?id=eq.${editingId.invoices}`, 'PATCH', data);
  } else {
    await sb('invoices', 'POST', { ...data, created_at: new Date().toISOString() });
  }
  closeModal('modal-invoice-create');
  renderInvoices();
}

async function toggleInvStatus(id, current) {
  const newStatus = current === 'Paid' ? 'Unpaid' : 'Paid';
  await sb(`invoices?id=eq.${id}`, 'PATCH', { status: newStatus });
  renderInvoices();
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  await sb(`invoices?id=eq.${id}`, 'DELETE');
  renderInvoices();
}

// ---- INVOICE VIEW / PRINT ----
async function viewInvoice(id) {
  const rows = await sb(`invoices?id=eq.${id}&select=*`);
  if (!rows || !rows.length) return;
  const inv   = rows[0];
  const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
  const total = items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);

  const fN = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const itemRows = items.map(it => `
    <tr>
      <td>
        <span class="inv-item-name">${it.name || ''}</span>
        ${it.desc ? `<span class="inv-item-desc">${it.desc}</span>` : ''}
      </td>
      <td>${it.qty || 1}</td>
      <td>${fN(it.price)}</td>
      <td>${fN((it.qty || 1) * (it.price || 0))}</td>
    </tr>`).join('');

  document.getElementById('invoice-view-area').innerHTML = `
  <div class="invoice-doc" id="printable-invoice">

    <!-- Top: Logo + Company Details -->
    <div class="inv-top">
      <div class="inv-logo-box">
        <div class="inv-logo-triangle"></div>
        <div class="inv-logo-letters">AJIGS</div>
        <div class="inv-logo-connect">CONNECT</div>
        <div class="inv-logo-tagline">Cleaning, Laundry, Upholstery &amp; fumigation</div>
        <div class="inv-logo-rc">RC 7304230</div>
      </div>
      <div class="inv-top-right">
        <div class="inv-word-invoice">Invoice</div>
        <div class="inv-company-name">AJIGS CONNECT</div>
        <div class="inv-company-meta">
          Kaduna Kaduna<br>
          NG<br><br>
          No. 5 Aliyu Asio Street New Extension Kawo, Kaduna, U/Rimi,<br>
          Kaduna State<br>
          08069051403<br>
          aris.jib.global.services@gmail.com
        </div>
      </div>
    </div>

    <!-- Bill To + Invoice Meta -->
    <div class="inv-bill-row">
      <div>
        <div class="inv-bill-label">Bill To</div>
        <div class="inv-bill-name">${inv.client_name}</div>
        <div class="inv-bill-addr">${inv.client_address || ''}</div>
      </div>
      <div>
        <div class="inv-meta-grid">
          <div class="inv-meta-key">Invoice #</div><div class="inv-meta-val">${inv.id}</div>
          <div class="inv-meta-key">Date</div><div class="inv-meta-val">${fmtDate(inv.invoice_date)}</div>
          <div class="inv-meta-key">Due date</div><div class="inv-meta-val">${fmtDate(inv.due_date)}</div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="inv-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals -->
    <div class="inv-totals-wrap">
      <div class="inv-totals-box">
        <div class="inv-total-line"><span>Subtotal</span><span>${fN(total)}</span></div>
        <div class="inv-total-line"><span>Net</span><span>${fN(total)}</span></div>
        <div class="inv-total-line"><span>Total</span><span>${fN(total)}</span></div>
      </div>
    </div>

    <!-- Amount Due Box -->
    <div class="inv-amount-due">
      <div class="inv-amount-due-box">
        <div class="inv-amount-due-label">Amount Due</div>
        <div class="inv-amount-due-value">${fN(total)}</div>
      </div>
    </div>

    <!-- Payment Terms -->
    <div class="inv-payment-terms">
      <div class="inv-terms-title">Payment Terms:</div>
      <div class="inv-terms-line">- Payment is done before the work starts</div>
      <div class="inv-terms-line">- Payment methods: Bank Transfer, Cheque, or Cash</div>
      <div class="inv-terms-line">- Bank Details: [ARI JIB GLOBAL SERVICES LIMITED (MONIEPOINT) 8069051403]</div>
    </div>

  </div>`;

  openModal('modal-invoice-view');
}

function printInvoice() {
  const content = document.getElementById('printable-invoice').outerHTML;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Invoice — AJIGS CONNECT</title>
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Source Sans 3',sans-serif;background:#fff;}
      .invoice-doc{background:#fff;padding:44px 52px;color:#000;font-size:12.5px;line-height:1.5;}
      .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;}
      .inv-logo-box{background:#0a0a0a;padding:14px 18px 10px;display:flex;flex-direction:column;align-items:center;min-width:130px;}
      .inv-logo-triangle{width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:14px solid #E87722;margin-bottom:4px;}
      .inv-logo-letters{font-family:'Oswald',sans-serif;font-size:30px;font-weight:700;color:#fff;letter-spacing:3px;line-height:1;}
      .inv-logo-connect{font-family:'Oswald',sans-serif;font-size:10px;letter-spacing:8px;color:#fff;margin-top:2px;}
      .inv-logo-tagline{font-size:7.5px;color:#888;letter-spacing:.8px;font-style:italic;margin-top:4px;text-align:center;}
      .inv-logo-rc{font-size:9px;color:#E87722;font-weight:700;letter-spacing:1px;margin-top:2px;}
      .inv-top-right{text-align:right;}
      .inv-word-invoice{font-size:20px;font-weight:300;letter-spacing:4px;color:#555;margin-bottom:4px;}
      .inv-company-name{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:2.5px;}
      .inv-company-meta{font-size:11.5px;color:#444;line-height:1.8;margin-top:6px;}
      .inv-bill-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #ddd;padding-top:20px;margin-bottom:28px;}
      .inv-bill-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#333;margin-bottom:8px;}
      .inv-bill-name{font-size:14px;font-weight:700;color:#000;margin-bottom:3px;}
      .inv-bill-addr{font-size:12px;color:#444;line-height:1.6;}
      .inv-meta-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:12px;justify-content:end;text-align:right;}
      .inv-meta-key{font-weight:700;color:#333;text-align:right;}
      .inv-meta-val{color:#000;text-align:right;}
      .inv-table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      .inv-table th{border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#000;text-align:left;}
      .inv-table th:nth-child(2){text-align:center;}
      .inv-table th:nth-child(3),.inv-table th:nth-child(4){text-align:right;}
      .inv-table td{padding:9px 10px;font-size:12.5px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#000;}
      .inv-table td:nth-child(2){text-align:center;}
      .inv-table td:nth-child(3),.inv-table td:nth-child(4){text-align:right;}
      .inv-item-name{font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#000;display:block;}
      .inv-item-desc{font-size:11.5px;color:#444;margin-top:3px;line-height:1.55;display:block;}
      .inv-totals-wrap{display:flex;justify-content:flex-end;margin-bottom:6px;}
      .inv-totals-box{width:250px;}
      .inv-total-line{display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;border-bottom:1px solid #f0f0f0;color:#000;}
      .inv-total-line:last-child{border-bottom:none;font-weight:700;font-size:13.5px;}
      .inv-amount-due{display:flex;justify-content:flex-end;margin-bottom:28px;}
      .inv-amount-due-box{width:250px;background:#f4f4f4;padding:14px 18px;text-align:right;}
      .inv-amount-due-label{font-size:11px;color:#666;letter-spacing:.5px;margin-bottom:3px;}
      .inv-amount-due-value{font-size:24px;font-weight:700;color:#000;}
      .inv-payment-terms{border-top:1px solid #ddd;padding-top:16px;}
      .inv-terms-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#000;margin-bottom:7px;}
      .inv-terms-line{font-size:11.5px;color:#333;line-height:1.9;}
      @media print{body{margin:0;} @page{margin:0;}}
    </style>
  </head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// =====================================================
//  CLIENTS
// =====================================================
async function renderClients() {
  const search = (document.getElementById('client-search') || {}).value || '';
  const clients = await sb('clients?select=*&order=name.asc');
  if (!clients) return;

  const filtered = search
    ? clients.filter(c =>
        (c.name  || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.location || '').toLowerCase().includes(search.toLowerCase()))
    : clients;

  const subtitle = document.getElementById('clients-subtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} client(s)`;

  const tbody = document.getElementById('clients-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="td-empty"><td colspan="7">No clients found</td></tr>';
    return;
  }

  // Get job + invoice counts per client
  const [jobs, invoices] = await Promise.all([
    sb('jobs?select=client_name'),
    sb('invoices?select=client_name,items'),
  ]);

  tbody.innerHTML = filtered.map((c, i) => {
    const jobCount  = (jobs     || []).filter(j => j.client_name === c.name).length;
    const invTotal2 = (invoices || [])
      .filter(inv => inv.client_name === c.name)
      .reduce((s, inv) => s + invTotal(inv), 0);
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone || ''}</td>
        <td>${c.location || c.address || ''}</td>
        <td>${jobCount}</td>
        <td>${fmtMoneyShort(invTotal2)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="editClient(${c.id})" title="Edit">✏️</button>
            ${canDelete() ? `<button class="btn btn-icon btn-sm" onclick="deleteClient(${c.id})" title="Delete">🗑️</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function openClientModal(id = null) {
  editingId.clients = id;
  document.getElementById('modal-client-title').textContent = id ? 'Edit Client' : 'Add Client';

  if (id) {
    const rows = await sb(`clients?id=eq.${id}&select=*`);
    if (!rows || !rows.length) return;
    const c = rows[0];
    document.getElementById('client-name').value  = c.name || '';
    document.getElementById('client-phone').value = c.phone || '';
    document.getElementById('client-loc').value   = c.location || '';
    document.getElementById('client-addr').value  = c.address || '';
  } else {
    ['client-name','client-phone','client-loc','client-addr'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
  openModal('modal-client');
}

async function editClient(id) { await openClientModal(id); }

async function saveClient() {
  const name = document.getElementById('client-name').value.trim();
  if (!name) { alert('Client name is required.'); return; }

  const data = {
    name,
    phone:    document.getElementById('client-phone').value.trim(),
    location: document.getElementById('client-loc').value.trim(),
    address:  document.getElementById('client-addr').value.trim(),
  };

  if (editingId.clients) {
    await sb(`clients?id=eq.${editingId.clients}`, 'PATCH', data);
  } else {
    await sb('clients', 'POST', { ...data, created_by: currentUser.name });
  }
  closeModal('modal-client');
  renderClients();
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  await sb(`clients?id=eq.${id}`, 'DELETE');
  renderClients();
}

// =====================================================
//  EXPENSES
// =====================================================
async function renderExpenses() {
  const search  = (document.getElementById('exp-search') || {}).value || '';
  const fCat    = (document.getElementById('exp-filter-cat') || {}).value || '';

  let qs = 'expenses?select=*&order=expense_date.desc';
  if (fCat) qs += `&category=eq.${encodeURIComponent(fCat)}`;

  const expenses = await sb(qs);
  if (!expenses) return;

  const filtered = search
    ? expenses.filter(e => (e.description || '').toLowerCase().includes(search.toLowerCase()))
    : expenses;

  const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
  const subtitle = document.getElementById('exp-subtitle');
  if (subtitle) subtitle.textContent = `${filtered.length} expense(s) · Total: ${fmtMoneyShort(total)}`;

  const tbody = document.getElementById('expenses-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="td-empty"><td colspan="6">No expenses found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${fmtDate(e.expense_date)}</td>
      <td>${e.description}</td>
      <td><span class="badge badge-orange">${e.category}</span></td>
      <td><strong>${fmtMoneyShort(e.amount)}</strong></td>
      <td>${e.added_by || ''}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editExpense(${e.id})" title="Edit">✏️</button>
          ${canDelete() ? `<button class="btn btn-icon btn-sm" onclick="deleteExpense(${e.id})" title="Delete">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function openExpenseModal(id = null) {
  editingId.expenses = id;
  document.getElementById('modal-exp-title').textContent = id ? 'Edit Expense' : 'Add Expense';

  if (id) {
    const rows = await sb(`expenses?id=eq.${id}&select=*`);
    if (!rows || !rows.length) return;
    const e = rows[0];
    document.getElementById('exp-desc').value   = e.description || '';
    document.getElementById('exp-cat').value    = e.category || 'Fuel';
    document.getElementById('exp-amount').value = e.amount || '';
    document.getElementById('exp-date').value   = e.expense_date || today();
  } else {
    document.getElementById('exp-desc').value   = '';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-date').value   = today();
    document.getElementById('exp-cat').value    = 'Fuel';
  }
  openModal('modal-expense');
}

async function editExpense(id) { await openExpenseModal(id); }

async function saveExpense() {
  const desc   = document.getElementById('exp-desc').value.trim();
  const amount = Number(document.getElementById('exp-amount').value);
  if (!desc || !amount) { alert('Description and amount are required.'); return; }

  const data = {
    description:  desc,
    category:     document.getElementById('exp-cat').value,
    amount,
    expense_date: document.getElementById('exp-date').value || today(),
    added_by:     currentUser.name,
  };

  if (editingId.expenses) {
    await sb(`expenses?id=eq.${editingId.expenses}`, 'PATCH', data);
  } else {
    await sb('expenses', 'POST', data);
  }
  closeModal('modal-expense');
  renderExpenses();
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  await sb(`expenses?id=eq.${id}`, 'DELETE');
  renderExpenses();
}

// =====================================================
//  STAFF
// =====================================================
async function renderStaff() {
  const staff = await sb('staff?select=*&order=name.asc');
  const jobs  = await sb('jobs?select=assigned_staff');
  if (!staff) return;

  const subtitle = document.getElementById('staff-subtitle');
  if (subtitle) subtitle.textContent = `${staff.length} staff member(s)`;

  const tbody = document.getElementById('staff-tbody');
  if (!staff.length) {
    tbody.innerHTML = '<tr class="td-empty"><td colspan="7">No staff found</td></tr>';
    return;
  }

  tbody.innerHTML = staff.map((s, i) => {
    const assigned = (jobs || []).filter(j => j.assigned_staff === s.name).length;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>${s.role || ''}</td>
        <td>${s.phone || ''}</td>
        <td>${statusBadge(s.status || 'Active')}</td>
        <td>${assigned} job(s)</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="editStaff(${s.id})" title="Edit">✏️</button>
            ${canDelete() ? `<button class="btn btn-icon btn-sm" onclick="deleteStaff(${s.id})" title="Delete">🗑️</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function openStaffModal(id = null) {
  editingId.staff = id;
  document.getElementById('modal-staff-title').textContent = id ? 'Edit Staff' : 'Add Staff';

  if (id) {
    const rows = await sb(`staff?id=eq.${id}&select=*`);
    if (!rows || !rows.length) return;
    const s = rows[0];
    document.getElementById('staff-name').value   = s.name || '';
    document.getElementById('staff-role').value   = s.role || '';
    document.getElementById('staff-phone').value  = s.phone || '';
    document.getElementById('staff-status').value = s.status || 'Active';
  } else {
    ['staff-name','staff-role','staff-phone'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('staff-status').value = 'Active';
  }
  openModal('modal-staff');
}

async function editStaff(id) { await openStaffModal(id); }

async function saveStaff() {
  const name = document.getElementById('staff-name').value.trim();
  if (!name) { alert('Staff name is required.'); return; }

  const data = {
    name,
    role:   document.getElementById('staff-role').value.trim(),
    phone:  document.getElementById('staff-phone').value.trim(),
    status: document.getElementById('staff-status').value,
  };

  if (editingId.staff) {
    await sb(`staff?id=eq.${editingId.staff}`, 'PATCH', data);
  } else {
    await sb('staff', 'POST', data);
  }
  closeModal('modal-staff');
  renderStaff();
}

async function deleteStaff(id) {
  if (!confirm('Delete this staff member?')) return;
  await sb(`staff?id=eq.${id}`, 'DELETE');
  renderStaff();
}

// =====================================================
//  REPORTS
// =====================================================
async function renderReports() {
  const [invoices, expenses] = await Promise.all([
    sb('invoices?select=*'),
    sb('expenses?select=*'),
  ]);
  if (!invoices || !expenses) return;

  const totalRev  = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + invTotal(i), 0);
  const pendingRev= invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + invTotal(i), 0);
  const totalExp  = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById('report-stats').innerHTML = `
    <div class="stat-card orange"><div class="stat-label">Total Revenue (Paid)</div><div class="stat-value">${fmtMoneyShort(totalRev)}</div></div>
    <div class="stat-card red"><div class="stat-label">Pending Revenue</div><div class="stat-value">${fmtMoneyShort(pendingRev)}</div></div>
    <div class="stat-card blue"><div class="stat-label">Total Expenses</div><div class="stat-value">${fmtMoneyShort(totalExp)}</div></div>
    <div class="stat-card green"><div class="stat-label">Net Profit</div><div class="stat-value">${fmtMoneyShort(totalRev - totalExp)}</div></div>
  `;

  const services = ['Fumigation','Cleaning','Laundry','Upholstery'];
  const sColors  = ['progress-orange','progress-blue','progress-green','progress-purple'];
  const svcData  = services.map(svc => {
    const total = invoices
      .filter(inv => {
        const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
        return items.some(it => (it.name || '').toUpperCase().includes(svc.toUpperCase()));
      })
      .reduce((s, inv) => s + invTotal(inv), 0);
    return { svc, total };
  });
  const maxSvc = Math.max(1, ...svcData.map(d => d.total));
  document.getElementById('report-by-service').innerHTML = svcData.map((d, i) => `
    <div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;font-weight:600;">${d.svc}</div>
      <div class="progress-track"><div class="progress-fill ${sColors[i]}" style="width:${Math.round(d.total/maxSvc*100)}%"></div></div>
      <div class="progress-amount">${fmtMoneyShort(d.total)}</div>
    </div>`).join('');

  const cats = ['Fuel','Equipment','Chemicals','Salaries','Rent','Utilities','Marketing','Other'];
  const catData = cats.map(c => ({
    cat: c,
    total: expenses.filter(e => e.category === c).reduce((s, e) => s + Number(e.amount || 0), 0)
  })).filter(d => d.total > 0);
  const maxCat = Math.max(1, ...catData.map(d => d.total));
  document.getElementById('report-by-cat').innerHTML = catData.map(d => `
    <div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;">${d.cat}</div>
      <div class="progress-track"><div class="progress-fill progress-orange" style="width:${Math.round(d.total/maxCat*100)}%"></div></div>
      <div class="progress-amount">${fmtMoneyShort(d.total)}</div>
    </div>`).join('') || '<p class="text-muted small-note">No expenses yet.</p>';

  // All invoices summary table
  const sortedInv = [...invoices].reverse();
  document.getElementById('report-inv-table').innerHTML = `
    <table style="min-width:auto;">
      <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>${sortedInv.map(inv => `
        <tr>
          <td>INV-${inv.id}</td>
          <td>${inv.client_name}</td>
          <td>${fmtDate(inv.invoice_date)}</td>
          <td>${fmtMoneyShort(invTotal(inv))}</td>
          <td>${statusBadge(inv.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

// =====================================================
//  USERS
// =====================================================
async function renderUsers() {
  if (currentUser.role !== 'Proprietor') {
    document.getElementById('panel-users').innerHTML = '<div class="card"><div class="card-body text-muted">Access restricted to Proprietor only.</div></div>';
    return;
  }
  const users = await sb('app_users?select=*&order=name.asc');
  if (!users) return;

  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.role}</td>
      <td>${statusBadge(u.is_active ? 'Active' : 'Inactive')}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editUser(${u.id})" title="Edit">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="toggleUserActive(${u.id},${u.is_active})" title="Toggle active">⚡</button>
          ${u.email !== currentUser.email ? `<button class="btn btn-icon btn-sm" onclick="deleteUser(${u.id})" title="Delete">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function openUserModal(id = null) {
  editingId.users = id;
  document.getElementById('modal-user-title').textContent = id ? 'Edit User' : 'Add User';
  document.getElementById('user-modal-alert').classList.add('d-none');

  if (id) {
    const rows = await sb(`app_users?id=eq.${id}&select=*`);
    if (!rows || !rows.length) return;
    const u = rows[0];
    document.getElementById('user-name').value  = u.name || '';
    document.getElementById('user-email').value = u.email || '';
    document.getElementById('user-pass').value  = '';
    document.getElementById('user-role').value  = u.role || 'Staff';
  } else {
    ['user-name','user-email','user-pass'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('user-role').value = 'Staff';
  }
  openModal('modal-user');
}

async function editUser(id) { await openUserModal(id); }

async function saveUser() {
  const name  = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const pass  = document.getElementById('user-pass').value;
  const alertEl = document.getElementById('user-modal-alert');
  alertEl.classList.add('d-none');

  if (!name || !email) { alertEl.textContent = 'Name and email are required.'; alertEl.classList.remove('d-none'); return; }
  if (!editingId.users && !pass) { alertEl.textContent = 'Password is required for new users.'; alertEl.classList.remove('d-none'); return; }

  if (!editingId.users) {
    // Create Supabase auth user via your backend or Supabase Admin API
    // In production: use Supabase Admin SDK on server or use Edge Functions
    // Here we just insert into app_users table
    await sb('app_users', 'POST', {
      name, email,
      role: document.getElementById('user-role').value,
      is_active: true,
    });
    // Note: To create actual auth user you need Supabase Admin API
    // Contact YaseerTech for setup
  } else {
    await sb(`app_users?id=eq.${editingId.users}`, 'PATCH', {
      name,
      role: document.getElementById('user-role').value,
    });
  }
  closeModal('modal-user');
  renderUsers();
}

async function toggleUserActive(id, current) {
  await sb(`app_users?id=eq.${id}`, 'PATCH', { is_active: !current });
  renderUsers();
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await sb(`app_users?id=eq.${id}`, 'DELETE');
  renderUsers();
}

// =====================================================
//  PROFILE
// =====================================================
function renderProfile() {
  const el = document.getElementById('profile-avatar');
  if (el) el.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();

  const info = document.getElementById('profile-info');
  if (info) info.innerHTML = `
    <div style="margin-bottom:1rem;">
      <div style="font-size:1.1rem;font-weight:700;">${currentUser.name}</div>
      <div style="font-size:13px;color:var(--gray-500);">${currentUser.email}</div>
      <div style="font-size:12px;color:var(--orange);margin-top:2px;">${currentUser.role}</div>
    </div>`;
}

async function changeMyPassword() {
  const newPass  = document.getElementById('profile-newpass').value;
  const confPass = document.getElementById('profile-confpass').value;
  const alertEl  = document.getElementById('profile-alert');
  const errorEl  = document.getElementById('profile-error');
  alertEl.classList.add('d-none');
  errorEl.classList.add('d-none');

  if (!newPass) { errorEl.textContent = 'Enter a new password.'; errorEl.classList.remove('d-none'); return; }
  if (newPass !== confPass) { errorEl.textContent = 'Passwords do not match.'; errorEl.classList.remove('d-none'); return; }

  const token = localStorage.getItem('ajigs_token');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPass }),
    });
    if (res.ok) {
      alertEl.classList.remove('d-none');
      document.getElementById('profile-newpass').value  = '';
      document.getElementById('profile-confpass').value = '';
    } else {
      const d = await res.json();
      errorEl.textContent = d.message || 'Failed to update password.';
      errorEl.classList.remove('d-none');
    }
  } catch(e) {
    errorEl.textContent = 'Connection error.';
    errorEl.classList.remove('d-none');
  }
}

// =====================================================
//  INIT
// =====================================================
document.addEventListener('DOMContentLoaded', initAuth);
