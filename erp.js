/* =============================================
   AJIGS CONNECT — erp.js  v2
   Full ERP Logic — Supabase Backend
   Fixes: Invoice save, permissions, empty DB,
          staff access control, admin-only sections
   ============================================= */
'use strict';

const SUPABASE_URL = 'https://pelkootzjmcppuljgbqs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbGtvb3R6am1jcHB1bGpnYnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDY3NDEsImV4cCI6MjA5NTM4Mjc0MX0.rjuqM25Tx0pQNm-vZ9VdxkePimuUqYapU9bwmUhx2fw';

/* ── SUPABASE HELPER ───────────────────────── */
async function sb(path, method = 'GET', body = null) {
  const token = localStorage.getItem('ajigs_token');
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Prefer': 'return=representation',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    if (res.status === 401) { doLogout(); return null; }
    if (res.status === 204) return [];
    const text = await res.text();
    if (!text) return [];
    return JSON.parse(text);
  } catch (e) {
    console.error('Supabase error:', e);
    return null;
  }
}

/* ── STATE ─────────────────────────────────── */
let currentUser  = null;
let editingId    = {};
let invItemsArr  = [];

/* ── ALL AVAILABLE SECTIONS ────────────────── */
const ALL_SECTIONS = ['dashboard','jobs','invoices','clients','expenses','staff','reports','gallery'];
// Users and Profile are handled separately

/* ── HELPERS ───────────────────────────────── */
const fmtMoney = n =>
  '₦' + Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtShort = n =>
  '₦' + Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:0,maximumFractionDigits:0});
const fmtDate  = d => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
};
const today    = () => new Date().toISOString().split('T')[0];
const openModal  = id => document.getElementById(id).classList.add('open');
const closeModal = id => document.getElementById(id).classList.remove('open');
const isAdmin    = () => currentUser && currentUser.role === 'Proprietor';
const canDelete  = () => isAdmin();

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}
function statusBadge(s) {
  const map = {
    'Pending':'pending','In Progress':'progress',
    'Completed':'completed','Invoiced':'invoiced',
    'Paid':'paid','Unpaid':'unpaid',
    'Active':'active','Inactive':'inactive'
  };
  return badge(s, map[s]||'orange');
}
function invTotal(inv) {
  const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items||[]);
  return items.reduce((s,it) => s + (Number(it.qty)||1)*(Number(it.price)||0), 0);
}
function hasAccess(section) {
  if (isAdmin()) return true;
  if (!currentUser || !currentUser.permissions) return false;
  return currentUser.permissions.includes(section);
}

/* ── AUTH ──────────────────────────────────── */
async function initAuth() {
  const token = localStorage.getItem('ajigs_token');
  const email = localStorage.getItem('ajigs_user_email');
  if (!token || !email) { window.location.href = 'login.html'; return; }

  const rows = await sb(`ajigs_app_users?email=eq.${encodeURIComponent(email)}&select=*`);
  if (rows && rows.length) {
    currentUser = rows[0];
    // Parse permissions JSON if stored as string
    if (typeof currentUser.permissions === 'string') {
      try { currentUser.permissions = JSON.parse(currentUser.permissions); }
      catch(e) { currentUser.permissions = ALL_SECTIONS; }
    }
    if (!currentUser.permissions) currentUser.permissions = ALL_SECTIONS;
  } else {
    currentUser = { name: email.split('@')[0], email, role: 'Staff', permissions: [] };
  }

  // Set topbar
  document.getElementById('topbar-name').textContent   = currentUser.name;
  document.getElementById('topbar-role').textContent   = currentUser.role;
  document.getElementById('topbar-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

  // Build sidebar based on permissions
  buildSidebar();

  // Navigate to dashboard or first accessible section
  const firstNav = document.querySelector('.sidebar-item[data-panel]');
  if (firstNav) {
    const panel = firstNav.getAttribute('data-panel');
    navTo(panel, firstNav);
  }
}

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const sections = [
    { group: 'Overview',    items: [{ id:'dashboard', label:'Dashboard', icon:'grid' }] },
    { group: 'Operations',  items: [
      { id:'jobs',     label:'Jobs',     icon:'clipboard' },
      { id:'invoices', label:'Invoices', icon:'file'      },
      { id:'clients',  label:'Clients',  icon:'users'     },
      { id:'gallery',  label:'Gallery',  icon:'image'     },
    ]},
    { group: 'Finance',     items: [
      { id:'expenses', label:'Expenses', icon:'dollar' },
      { id:'reports',  label:'Reports',  icon:'bar'    },
    ]},
    { group: 'Admin',       items: [
      { id:'staff',   label:'Staff',      icon:'person' },
      ...(isAdmin() ? [{ id:'users', label:'Users', icon:'shield' }] : []),
      { id:'profile', label:'My Profile', icon:'user'   },
    ]},
  ];

  const icons = {
    grid:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>',
    file:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    users:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    dollar:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    bar:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    person:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></svg>',
    shield:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    user:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    image:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };

  let html = '';
  sections.forEach(group => {
    // Filter items by permission (profile and users always shown if eligible)
    const visible = group.items.filter(item => {
      if (item.id === 'profile') return true;
      if (item.id === 'users')   return isAdmin();
      if (item.id === 'dashboard') return true;
      return hasAccess(item.id);
    });
    if (!visible.length) return;

    html += `<div class="sidebar-section">${group.group}</div>`;
    visible.forEach(item => {
      html += `<div class="sidebar-item" data-panel="${item.id}" id="nav-${item.id}" onclick="navTo('${item.id}',this)">
        ${icons[item.icon]||''} ${item.label}
      </div>`;
    });
  });
  sidebar.innerHTML = html;
}

function doLogout() {
  localStorage.removeItem('ajigs_token');
  localStorage.removeItem('ajigs_refresh');
  localStorage.removeItem('ajigs_user_email');
  window.location.href = 'login.html';
}

/* ── NAVIGATION ────────────────────────────── */
function navTo(panel, el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + panel);
  if (target) target.classList.add('active');

  const loaders = {
    dashboard: renderDashboard,
    jobs:      renderJobs,
    invoices:  renderInvoices,
    clients:   renderClients,
    expenses:  renderExpenses,
    staff:     renderStaff,
    reports:   renderReports,
    gallery:   renderGalleryPanel,
    users:     renderUsers,
    profile:   renderProfile,
  };
  if (loaders[panel]) loaders[panel]();
}

/* ── DASHBOARD ─────────────────────────────── */
async function renderDashboard() {
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB',{
    weekday:'long', day:'2-digit', month:'long', year:'numeric'
  });

  const [invoices, jobs, expenses] = await Promise.all([
    sb('ajigs_invoices?select=*'),
    sb('ajigs_jobs?select=*&order=id.desc'),
    sb('ajigs_expenses?select=*'),
  ]);

  const inv  = invoices  || [];
  const jbs  = jobs      || [];
  const exps = expenses  || [];

  const totalRev   = inv.filter(i=>i.status==='Paid').reduce((s,i)=>s+invTotal(i),0);
  const pendingRev = inv.filter(i=>i.status==='Unpaid').reduce((s,i)=>s+invTotal(i),0);
  const totalExp   = exps.reduce((s,e)=>s+Number(e.amount||0),0);
  const activeJobs = jbs.filter(j=>j.status==='In Progress').length;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card orange"><div class="stat-label">Total Revenue</div><div class="stat-value">${fmtShort(totalRev)}</div><div class="stat-sub">Paid invoices</div></div>
    <div class="stat-card red"><div class="stat-label">Pending Payments</div><div class="stat-value">${fmtShort(pendingRev)}</div><div class="stat-sub">Outstanding</div></div>
    <div class="stat-card blue"><div class="stat-label">Total Expenses</div><div class="stat-value">${fmtShort(totalExp)}</div></div>
    <div class="stat-card green"><div class="stat-label">Net Profit</div><div class="stat-value">${fmtShort(totalRev-totalExp)}</div></div>
    <div class="stat-card purple"><div class="stat-label">Active Jobs</div><div class="stat-value">${activeJobs}</div></div>
    <div class="stat-card gray"><div class="stat-label">Total Invoices</div><div class="stat-value">${inv.length}</div></div>
  `;

  // Revenue by service
  const services = ['Construction','Building Materials Supply','Automobile Sales','Engineering Projects','Cleaning Services'];
  const colors   = ['progress-orange','progress-blue','progress-green','progress-purple','progress-orange'];
  const svcData  = services.map(svc => {
    const svcInv = inv.filter(i => {
      const items = typeof i.items==='string'?JSON.parse(i.items):(i.items||[]);
      return items.some(it=>(it.name||'').toUpperCase().includes(svc.toUpperCase()));
    });
    const paid   = svcInv.filter(i=>i.status==='Paid').reduce((s,i)=>s+invTotal(i),0);
    const unpaid = svcInv.filter(i=>i.status!=='Paid').reduce((s,i)=>s+invTotal(i),0);
    return { svc, paid, unpaid };
  });
  const maxSvc = Math.max(1,...svcData.map(d=>d.paid+d.unpaid));
  document.getElementById('dash-by-service').innerHTML = svcData.map((d,i)=>`
    <div class="progress-row">
      <div class="progress-label" style="width:160px;font-size:12.5px;font-weight:600;">${d.svc}</div>
      <div class="progress-track"><div class="progress-fill ${colors[i]}" style="width:${Math.round((d.paid+d.unpaid)/maxSvc*100)}%"></div></div>
      <div class="progress-amount">${fmtShort(d.paid)}</div>
      <div style="width:70px;text-align:right;font-size:11.5px;color:var(--gray-400);">${fmtShort(d.unpaid)} due</div>
    </div>`).join('');

  // Job status
  const statuses = ['Pending','In Progress','Completed','Invoiced'];
  document.getElementById('dash-job-status').innerHTML = statuses.map(s=>{
    const cnt = jbs.filter(j=>j.status===s).length;
    const pct = jbs.length ? Math.round(cnt/jbs.length*100) : 0;
    return `<div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;">${s}</div>
      <div class="progress-track"><div class="progress-fill progress-orange" style="width:${pct}%"></div></div>
      <div class="progress-amount">${cnt} job${cnt!==1?'s':''}</div>
    </div>`;
  }).join('');

  // Recent jobs
  const recent = jbs.slice(0,7);
  document.getElementById('dash-recent-jobs').innerHTML = recent.length
    ? `<table style="min-width:auto;">
        <thead><tr><th>Client</th><th>Service</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${recent.map(j=>`
          <tr>
            <td><strong>${j.client_name}</strong></td>
            <td>${j.service}</td>
            <td>${fmtDate(j.scheduled_date)}</td>
            <td>${fmtShort(j.amount)}</td>
            <td>${statusBadge(j.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p style="padding:1rem;color:var(--gray-400);font-size:13.5px;">No jobs yet. Create your first job.</p>';
}

/* ── JOBS ──────────────────────────────────── */
async function renderJobs() {
  const search  = (document.getElementById('job-search')||{value:''}).value;
  const fStatus = (document.getElementById('job-filter-status')||{value:''}).value;
  const fSvc    = (document.getElementById('job-filter-service')||{value:''}).value;

  let qs = 'ajigs_jobs?select=*&order=id.desc';
  if (fStatus) qs += `&status=eq.${encodeURIComponent(fStatus)}`;
  if (fSvc)    qs += `&service=eq.${encodeURIComponent(fSvc)}`;

  const jobs = await sb(qs) || [];
  const filtered = search
    ? jobs.filter(j=>(j.client_name||'').toLowerCase().includes(search.toLowerCase())||
                     (j.service||'').toLowerCase().includes(search.toLowerCase())||
                     (j.assigned_staff||'').toLowerCase().includes(search.toLowerCase()))
    : jobs;

  const sub = document.getElementById('jobs-subtitle');
  if (sub) sub.textContent = `${filtered.length} job(s)`;

  const tbody = document.getElementById('jobs-tbody');
  tbody.innerHTML = filtered.length
    ? filtered.map(j=>`<tr>
        <td><strong>#${j.id}</strong></td>
        <td><strong>${j.client_name}</strong>${j.client_phone?`<br><span class="text-muted" style="font-size:12px;">${j.client_phone}</span>`:''}</td>
        <td>${j.service}</td>
        <td>${fmtDate(j.scheduled_date)}</td>
        <td>${j.assigned_staff||'<span class="text-muted">—</span>'}</td>
        <td>${fmtShort(j.amount)}</td>
        <td>${statusBadge(j.status)}</td>
        <td><div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editJob(${j.id})" title="Edit">✏️</button>
          ${canDelete()?`<button class="btn btn-icon btn-sm" onclick="deleteJob(${j.id})" title="Delete">🗑️</button>`:''}
        </div></td>
      </tr>`).join('')
    : '<tr class="td-empty"><td colspan="8">No jobs found. Click + New Job to add one.</td></tr>';
}

async function openJobModal(id=null) {
  editingId.jobs = id;
  document.getElementById('modal-job-title').textContent = id ? 'Edit Job' : 'New Job';

  const staff = await sb('ajigs_staff?status=eq.Active&select=name&order=name.asc') || [];
  const staffEl = document.getElementById('job-staff');
  staffEl.innerHTML = '<option value="">-- Unassigned --</option>' +
    staff.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');

  if (id) {
    const rows = await sb(`ajigs_jobs?id=eq.${id}&select=*`) || [];
    if (!rows.length) return;
    const j = rows[0];
    document.getElementById('job-client').value  = j.client_name||'';
    document.getElementById('job-phone').value   = j.client_phone||'';
    document.getElementById('job-address').value = j.client_address||'';
    document.getElementById('job-service').value = j.service||'';
    document.getElementById('job-date').value    = j.scheduled_date||'';
    document.getElementById('job-staff').value   = j.assigned_staff||'';
    document.getElementById('job-amount').value  = j.amount||'';
    document.getElementById('job-status').value  = j.status||'Pending';
    document.getElementById('job-desc').value    = j.description||'';
  } else {
    ['job-client','job-phone','job-address','job-amount','job-desc'].forEach(i=>{ document.getElementById(i).value=''; });
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
    client_name:    client,
    client_phone:   document.getElementById('job-phone').value.trim(),
    client_address: document.getElementById('job-address').value.trim(),
    service,
    scheduled_date: document.getElementById('job-date').value || null,
    assigned_staff: document.getElementById('job-staff').value || null,
    amount:         Number(document.getElementById('job-amount').value)||0,
    status:         document.getElementById('job-status').value,
    description:    document.getElementById('job-desc').value.trim(),
    created_by:     currentUser.name,
  };

  let result;
  if (editingId.jobs) {
    result = await sb(`ajigs_jobs?id=eq.${editingId.jobs}`, 'PATCH', data);
  } else {
    result = await sb('ajigs_jobs', 'POST', { ...data, created_at: new Date().toISOString() });
  }

  if (result === null) { alert('Failed to save job. Please try again.'); return; }
  closeModal('modal-job');
  renderJobs();
}

async function deleteJob(id) {
  if (!confirm('Delete this job?')) return;
  await sb(`ajigs_jobs?id=eq.${id}`, 'DELETE');
  renderJobs();
}

/* ── INVOICES ──────────────────────────────── */
async function renderInvoices() {
  const search  = (document.getElementById('inv-search')||{value:''}).value;
  const fStatus = (document.getElementById('inv-filter-status')||{value:''}).value;

  let qs = 'ajigs_invoices?select=*&order=id.desc';
  if (fStatus) qs += `&status=eq.${encodeURIComponent(fStatus)}`;

  const invoices = await sb(qs) || [];
  const filtered = search
    ? invoices.filter(i=>(i.client_name||'').toLowerCase().includes(search.toLowerCase())||
                         String(i.id).includes(search))
    : invoices;

  const sub = document.getElementById('inv-subtitle');
  if (sub) sub.textContent = `${filtered.length} invoice(s)`;

  const tbody = document.getElementById('invoices-tbody');
  tbody.innerHTML = filtered.length
    ? filtered.map(inv=>{
        const items = typeof inv.items==='string'?JSON.parse(inv.items):(inv.items||[]);
        const names = items.map(it=>it.name).join(', ');
        const total = invTotal(inv);
        return `<tr>
          <td><strong>INV-${inv.id}</strong></td>
          <td>${inv.client_name}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${names}">${names||'—'}</td>
          <td>${fmtDate(inv.invoice_date)}</td>
          <td><strong>${fmtShort(total)}</strong></td>
          <td>${statusBadge(inv.status)}</td>
          <td><div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="viewInvoice(${inv.id})" title="View">👁</button>
            <button class="btn btn-icon btn-sm" onclick="toggleInvStatus(${inv.id},'${inv.status}')" title="Toggle paid">${inv.status==='Paid'?'↩️':'✅'}</button>
            <button class="btn btn-icon btn-sm" onclick="editInvoice(${inv.id})" title="Edit">✏️</button>
            ${canDelete()?`<button class="btn btn-icon btn-sm" onclick="deleteInvoice(${inv.id})" title="Delete">🗑️</button>`:''}
          </div></td>
        </tr>`;
      }).join('')
    : '<tr class="td-empty"><td colspan="7">No invoices yet. Click + New Invoice to create one.</td></tr>';
}

function openInvoiceModal(id=null) {
  editingId.invoices = id;
  invItemsArr = [];
  document.getElementById('modal-inv-title').textContent = id ? 'Edit Invoice' : 'New Invoice';

  if (!id) {
    document.getElementById('cinv-client').value = '';
    document.getElementById('cinv-caddr').value  = '';
    document.getElementById('cinv-date').value   = today();
    document.getElementById('cinv-due').value    = today();
    document.getElementById('cinv-status').value = 'Unpaid';
    invItemsArr = [{ name:'', desc:'', qty:1, price:0 }];
    refreshInvItems();
    openModal('modal-invoice-create');
    return;
  }

  sb(`ajigs_invoices?id=eq.${id}&select=*`).then(rows => {
    if (!rows||!rows.length) return;
    const inv = rows[0];
    document.getElementById('cinv-client').value = inv.client_name||'';
    document.getElementById('cinv-caddr').value  = inv.client_address||'';
    document.getElementById('cinv-date').value   = inv.invoice_date||today();
    document.getElementById('cinv-due').value    = inv.due_date||today();
    document.getElementById('cinv-status').value = inv.status||'Unpaid';
    invItemsArr = typeof inv.items==='string' ? JSON.parse(inv.items) : (inv.items||[]);
    refreshInvItems();
    openModal('modal-invoice-create');
  });
}

function editInvoice(id) { openInvoiceModal(id); }

function addInvItem() {
  invItemsArr.push({ name:'', desc:'', qty:1, price:0 });
  refreshInvItems();
}

function removeInvItem(idx) {
  invItemsArr.splice(idx,1);
  refreshInvItems();
}

function refreshInvItems() {
  const wrap = document.getElementById('cinv-items-wrap');
  if (!wrap) return;
  wrap.innerHTML = invItemsArr.map((item,i)=>`
    <div class="inv-item-row">
      <div class="inv-item-header">
        <div class="inv-item-num">Item ${i+1}</div>
        ${invItemsArr.length>1?`<button class="btn btn-danger btn-xs" onclick="removeInvItem(${i})">Remove</button>`:''}
      </div>
      <div class="form-group">
        <label class="form-label">Service / Item Name</label>
        <input class="form-control" id="inv-name-${i}" value="${item.name||''}"
          oninput="invItemsArr[${i}].name=this.value"
          placeholder="e.g. CLEANING SERVICES" style="text-transform:uppercase;">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" rows="2" id="inv-desc-${i}"
          oninput="invItemsArr[${i}].desc=this.value"
          placeholder="Describe the service...">${item.desc||''}</textarea>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Qty</label>
          <input class="form-control" type="number" min="1" id="inv-qty-${i}" value="${item.qty||1}"
            oninput="invItemsArr[${i}].qty=Number(this.value)||1; updateInvTotal();">
        </div>
        <div class="form-group">
          <label class="form-label">Unit Price (₦)</label>
          <input class="form-control" type="number" min="0" id="inv-price-${i}" value="${item.price||0}"
            oninput="invItemsArr[${i}].price=Number(this.value)||0; updateInvTotal();">
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input class="form-control" readonly id="inv-line-${i}"
            value="${fmtMoney((item.qty||1)*(item.price||0))}">
        </div>
      </div>
    </div>`).join('');
  updateInvTotal();
}

function updateInvTotal() {
  const total = invItemsArr.reduce((s,it)=>s+(Number(it.qty)||1)*(Number(it.price)||0),0);
  const el = document.getElementById('cinv-running-total');
  if (el) el.textContent = fmtMoney(total);
  invItemsArr.forEach((_,i)=>{
    const lineEl = document.getElementById(`inv-line-${i}`);
    if (lineEl) lineEl.value = fmtMoney((invItemsArr[i].qty||1)*(invItemsArr[i].price||0));
  });
}

async function saveInvoice() {
  const client = document.getElementById('cinv-client').value.trim();
  if (!client) { alert('Client name is required.'); return; }
  if (!invItemsArr.length) { alert('Add at least one line item.'); return; }

  // Collect latest values from inputs
  invItemsArr = invItemsArr.map((item,i)=>({
    name:  (document.getElementById(`inv-name-${i}`)  ? document.getElementById(`inv-name-${i}`).value  : item.name  ).trim().toUpperCase(),
    desc:  (document.getElementById(`inv-desc-${i}`)  ? document.getElementById(`inv-desc-${i}`).value  : item.desc  ).trim(),
    qty:   Number(document.getElementById(`inv-qty-${i}`)   ? document.getElementById(`inv-qty-${i}`).value   : item.qty  )||1,
    price: Number(document.getElementById(`inv-price-${i}`) ? document.getElementById(`inv-price-${i}`).value : item.price)||0,
  }));

  const data = {
    client_name:    client,
    client_address: document.getElementById('cinv-caddr').value.trim(),
    invoice_date:   document.getElementById('cinv-date').value || today(),
    due_date:       document.getElementById('cinv-due').value  || today(),
    items:          JSON.stringify(invItemsArr),
    status:         document.getElementById('cinv-status').value,
    created_by:     currentUser.name,
  };

  let result;
  if (editingId.invoices) {
    result = await sb(`ajigs_invoices?id=eq.${editingId.invoices}`, 'PATCH', data);
  } else {
    result = await sb('ajigs_invoices', 'POST', { ...data, created_at: new Date().toISOString() });
  }

  if (result === null) { alert('Failed to save invoice. Please try again.'); return; }
  closeModal('modal-invoice-create');
  renderInvoices();
}

async function toggleInvStatus(id, current) {
  await sb(`ajigs_invoices?id=eq.${id}`, 'PATCH', { status: current==='Paid'?'Unpaid':'Paid' });
  renderInvoices();
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  await sb(`ajigs_invoices?id=eq.${id}`, 'DELETE');
  renderInvoices();
}

async function viewInvoice(id) {
  const rows = await sb(`ajigs_invoices?id=eq.${id}&select=*`) || [];
  if (!rows.length) return;
  const inv   = rows[0];
  const items = typeof inv.items==='string'?JSON.parse(inv.items):(inv.items||[]);
  const total = items.reduce((s,it)=>s+(Number(it.qty)||1)*(Number(it.price)||0),0);
  const fN    = n => '₦'+Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});

  const itemRows = items.map(it=>`<tr>
    <td><span class="inv-item-name">${it.name||''}</span>${it.desc?`<span class="inv-item-desc">${it.desc}</span>`:''}</td>
    <td>${it.qty||1}</td>
    <td>${fN(it.price)}</td>
    <td>${fN((it.qty||1)*(it.price||0))}</td>
  </tr>`).join('');

  document.getElementById('invoice-view-area').innerHTML = `
  <div class="invoice-doc" id="printable-invoice">
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
        <div class="inv-company-meta">Kaduna Kaduna<br>NG<br><br>No. 5 Aliyu Asio Street New Extension Kawo, Kaduna, U/Rimi,<br>Kaduna State<br>08069051403<br>aris.jib.global.services@gmail.com</div>
      </div>
    </div>
    <div class="inv-bill-row">
      <div>
        <div class="inv-bill-label">Bill To</div>
        <div class="inv-bill-name">${inv.client_name}</div>
        <div class="inv-bill-addr">${inv.client_address||''}</div>
      </div>
      <div>
        <div class="inv-meta-grid">
          <div class="inv-meta-key">Invoice #</div><div class="inv-meta-val">${inv.id}</div>
          <div class="inv-meta-key">Date</div><div class="inv-meta-val">${fmtDate(inv.invoice_date)}</div>
          <div class="inv-meta-key">Due date</div><div class="inv-meta-val">${fmtDate(inv.due_date)}</div>
        </div>
      </div>
    </div>
    <table class="inv-table">
      <thead><tr><th>Item</th><th>Quantity</th><th>Price</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="inv-totals-wrap">
      <div class="inv-totals-box">
        <div class="inv-total-line"><span>Subtotal</span><span>${fN(total)}</span></div>
        <div class="inv-total-line"><span>Net</span><span>${fN(total)}</span></div>
        <div class="inv-total-line"><span>Total</span><span>${fN(total)}</span></div>
      </div>
    </div>
    <div class="inv-amount-due">
      <div class="inv-amount-due-box">
        <div class="inv-amount-due-label">Amount Due</div>
        <div class="inv-amount-due-value">${fN(total)}</div>
      </div>
    </div>
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
  const win = window.open('','_blank','width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Invoice — AJIGS CONNECT</title>
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Source Sans 3',sans-serif;background:#fff;}
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
      .inv-meta-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:12px;text-align:right;}
      .inv-meta-key{font-weight:700;color:#333;text-align:right;}
      .inv-meta-val{color:#000;text-align:right;}
      .inv-table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      .inv-table th{border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#000;text-align:left;}
      .inv-table th:nth-child(2){text-align:center;}.inv-table th:nth-child(3),.inv-table th:nth-child(4){text-align:right;}
      .inv-table td{padding:9px 10px;font-size:12.5px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#000;}
      .inv-table td:nth-child(2){text-align:center;}.inv-table td:nth-child(3),.inv-table td:nth-child(4){text-align:right;}
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
      @media print{body{margin:0;}@page{margin:0;}}
    </style>
  </head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(()=>win.print(),800);
}

/* ── CLIENTS ───────────────────────────────── */
async function renderClients() {
  const search  = (document.getElementById('client-search')||{value:''}).value;
  const clients = await sb('ajigs_clients?select=*&order=name.asc') || [];
  const filtered = search
    ? clients.filter(c=>(c.name||'').toLowerCase().includes(search.toLowerCase())||
                        (c.phone||'').includes(search))
    : clients;

  const sub = document.getElementById('clients-subtitle');
  if (sub) sub.textContent = `${filtered.length} client(s)`;

  const [jobs, invoices] = await Promise.all([
    sb('ajigs_jobs?select=client_name'),
    sb('ajigs_invoices?select=client_name,items'),
  ]);

  const tbody = document.getElementById('clients-tbody');
  tbody.innerHTML = filtered.length
    ? filtered.map((c,i)=>{
        const jobCount  = (jobs||[]).filter(j=>j.client_name===c.name).length;
        const invAmt    = (invoices||[]).filter(inv=>inv.client_name===c.name).reduce((s,inv)=>s+invTotal(inv),0);
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${c.name}</strong></td>
          <td>${c.phone||''}</td>
          <td>${c.location||c.address||''}</td>
          <td>${jobCount}</td>
          <td>${fmtShort(invAmt)}</td>
          <td><div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="editClient(${c.id})" title="Edit">✏️</button>
            ${canDelete()?`<button class="btn btn-icon btn-sm" onclick="deleteClient(${c.id})" title="Delete">🗑️</button>`:''}
          </div></td>
        </tr>`;
      }).join('')
    : '<tr class="td-empty"><td colspan="7">No clients yet. Click + Add Client.</td></tr>';
}

async function openClientModal(id=null) {
  editingId.clients = id;
  document.getElementById('modal-client-title').textContent = id ? 'Edit Client' : 'Add Client';
  if (id) {
    const rows = await sb(`ajigs_clients?id=eq.${id}&select=*`) || [];
    if (!rows.length) return;
    const c = rows[0];
    document.getElementById('client-name').value  = c.name||'';
    document.getElementById('client-phone').value = c.phone||'';
    document.getElementById('client-loc').value   = c.location||'';
    document.getElementById('client-addr').value  = c.address||'';
  } else {
    ['client-name','client-phone','client-loc','client-addr'].forEach(i=>{ document.getElementById(i).value=''; });
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
  let result;
  if (editingId.clients) {
    result = await sb(`ajigs_clients?id=eq.${editingId.clients}`, 'PATCH', data);
  } else {
    result = await sb('ajigs_clients', 'POST', { ...data, created_by: currentUser.name });
  }
  if (result===null) { alert('Failed to save client.'); return; }
  closeModal('modal-client');
  renderClients();
}
async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  await sb(`ajigs_clients?id=eq.${id}`, 'DELETE');
  renderClients();
}

/* ── EXPENSES ──────────────────────────────── */
async function renderExpenses() {
  const search = (document.getElementById('exp-search')||{value:''}).value;
  const fCat   = (document.getElementById('exp-filter-cat')||{value:''}).value;
  let qs = 'ajigs_expenses?select=*&order=expense_date.desc';
  if (fCat) qs += `&category=eq.${encodeURIComponent(fCat)}`;
  const expenses = await sb(qs) || [];
  const filtered = search
    ? expenses.filter(e=>(e.description||'').toLowerCase().includes(search.toLowerCase()))
    : expenses;
  const total = filtered.reduce((s,e)=>s+Number(e.amount||0),0);
  const sub = document.getElementById('exp-subtitle');
  if (sub) sub.textContent = `${filtered.length} expense(s) · Total: ${fmtShort(total)}`;
  const tbody = document.getElementById('expenses-tbody');
  tbody.innerHTML = filtered.length
    ? filtered.map(e=>`<tr>
        <td>${fmtDate(e.expense_date)}</td>
        <td>${e.description}</td>
        <td><span class="badge badge-orange">${e.category}</span></td>
        <td><strong>${fmtShort(e.amount)}</strong></td>
        <td>${e.added_by||''}</td>
        <td><div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editExpense(${e.id})" title="Edit">✏️</button>
          ${canDelete()?`<button class="btn btn-icon btn-sm" onclick="deleteExpense(${e.id})" title="Delete">🗑️</button>`:''}
        </div></td>
      </tr>`).join('')
    : '<tr class="td-empty"><td colspan="6">No expenses yet. Click + Add Expense.</td></tr>';
}

async function openExpenseModal(id=null) {
  editingId.expenses = id;
  document.getElementById('modal-exp-title').textContent = id ? 'Edit Expense' : 'Add Expense';
  if (id) {
    const rows = await sb(`ajigs_expenses?id=eq.${id}&select=*`) || [];
    if (!rows.length) return;
    const e = rows[0];
    document.getElementById('exp-desc').value   = e.description||'';
    document.getElementById('exp-cat').value    = e.category||'Fuel';
    document.getElementById('exp-amount').value = e.amount||'';
    document.getElementById('exp-date').value   = e.expense_date||today();
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
  if (!desc||!amount) { alert('Description and amount are required.'); return; }
  const data = {
    description:  desc,
    category:     document.getElementById('exp-cat').value,
    amount,
    expense_date: document.getElementById('exp-date').value||today(),
    added_by:     currentUser.name,
  };
  let result;
  if (editingId.expenses) {
    result = await sb(`ajigs_expenses?id=eq.${editingId.expenses}`, 'PATCH', data);
  } else {
    result = await sb('ajigs_expenses', 'POST', data);
  }
  if (result===null) { alert('Failed to save expense.'); return; }
  closeModal('modal-expense');
  renderExpenses();
}
async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  await sb(`ajigs_expenses?id=eq.${id}`, 'DELETE');
  renderExpenses();
}

/* ── STAFF ─────────────────────────────────── */
async function renderStaff() {
  const staff = await sb('ajigs_staff?select=*&order=name.asc') || [];
  const jobs  = await sb('ajigs_jobs?select=assigned_staff') || [];
  const sub   = document.getElementById('staff-subtitle');
  if (sub) sub.textContent = `${staff.length} staff member(s)`;
  const tbody = document.getElementById('staff-tbody');
  tbody.innerHTML = staff.length
    ? staff.map((s,i)=>{
        const assigned = jobs.filter(j=>j.assigned_staff===s.name).length;
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${s.name}</strong></td>
          <td>${s.role||''}</td>
          <td>${s.phone||''}</td>
          <td>${statusBadge(s.status||'Active')}</td>
          <td>${assigned} job(s)</td>
          <td><div class="td-actions">
            <button class="btn btn-icon btn-sm" onclick="editStaff(${s.id})" title="Edit">✏️</button>
            ${canDelete()?`<button class="btn btn-icon btn-sm" onclick="deleteStaff(${s.id})" title="Delete">🗑️</button>`:''}
          </div></td>
        </tr>`;
      }).join('')
    : '<tr class="td-empty"><td colspan="7">No staff yet. Click + Add Staff.</td></tr>';
}

async function openStaffModal(id=null) {
  editingId.staff = id;
  document.getElementById('modal-staff-title').textContent = id ? 'Edit Staff' : 'Add Staff';
  if (id) {
    const rows = await sb(`ajigs_staff?id=eq.${id}&select=*`) || [];
    if (!rows.length) return;
    const s = rows[0];
    document.getElementById('staff-name').value   = s.name||'';
    document.getElementById('staff-role').value   = s.role||'';
    document.getElementById('staff-phone').value  = s.phone||'';
    document.getElementById('staff-status').value = s.status||'Active';
  } else {
    ['staff-name','staff-role','staff-phone'].forEach(i=>{ document.getElementById(i).value=''; });
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
  let result;
  if (editingId.staff) {
    result = await sb(`ajigs_staff?id=eq.${editingId.staff}`, 'PATCH', data);
  } else {
    result = await sb('ajigs_staff', 'POST', data);
  }
  if (result===null) { alert('Failed to save staff.'); return; }
  closeModal('modal-staff');
  renderStaff();
}
async function deleteStaff(id) {
  if (!confirm('Delete this staff member?')) return;
  await sb(`ajigs_staff?id=eq.${id}`, 'DELETE');
  renderStaff();
}

/* ── REPORTS ───────────────────────────────── */
async function renderReports() {
  const [invoices, expenses] = await Promise.all([
    sb('ajigs_invoices?select=*'),
    sb('ajigs_expenses?select=*'),
  ]);
  const inv  = invoices||[];
  const exps = expenses||[];

  const totalRev   = inv.filter(i=>i.status==='Paid').reduce((s,i)=>s+invTotal(i),0);
  const pendingRev = inv.filter(i=>i.status!=='Paid').reduce((s,i)=>s+invTotal(i),0);
  const totalExp   = exps.reduce((s,e)=>s+Number(e.amount||0),0);

  document.getElementById('report-stats').innerHTML = `
    <div class="stat-card orange"><div class="stat-label">Revenue (Paid)</div><div class="stat-value">${fmtShort(totalRev)}</div></div>
    <div class="stat-card red"><div class="stat-label">Pending Revenue</div><div class="stat-value">${fmtShort(pendingRev)}</div></div>
    <div class="stat-card blue"><div class="stat-label">Total Expenses</div><div class="stat-value">${fmtShort(totalExp)}</div></div>
    <div class="stat-card green"><div class="stat-label">Net Profit</div><div class="stat-value">${fmtShort(totalRev-totalExp)}</div></div>
  `;

  const services = ['Construction','Building Materials Supply','Automobile Sales','Engineering Projects','Cleaning Services'];
  const sColors  = ['progress-orange','progress-blue','progress-green','progress-purple','progress-orange'];
  const svcData  = services.map(svc=>({
    svc,
    total: inv.filter(i=>{
      const items=typeof i.items==='string'?JSON.parse(i.items):(i.items||[]);
      return items.some(it=>(it.name||'').toUpperCase().includes(svc.toUpperCase()));
    }).reduce((s,i)=>s+invTotal(i),0)
  }));
  const maxSvc = Math.max(1,...svcData.map(d=>d.total));
  document.getElementById('report-by-service').innerHTML = svcData.map((d,i)=>`
    <div class="progress-row">
      <div class="progress-label" style="width:160px;font-size:12.5px;font-weight:600;">${d.svc}</div>
      <div class="progress-track"><div class="progress-fill ${sColors[i]}" style="width:${Math.round(d.total/maxSvc*100)}%"></div></div>
      <div class="progress-amount">${fmtShort(d.total)}</div>
    </div>`).join('') || '<p class="text-muted small-note">No data yet.</p>';

  const cats    = ['Fuel','Equipment','Chemicals','Salaries','Rent','Utilities','Marketing','Other'];
  const catData = cats.map(c=>({ cat:c, total:exps.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount||0),0) })).filter(d=>d.total>0);
  const maxCat  = Math.max(1,...catData.map(d=>d.total));
  document.getElementById('report-by-cat').innerHTML = catData.map(d=>`
    <div class="progress-row">
      <div class="progress-label" style="width:90px;font-size:12.5px;">${d.cat}</div>
      <div class="progress-track"><div class="progress-fill progress-orange" style="width:${Math.round(d.total/maxCat*100)}%"></div></div>
      <div class="progress-amount">${fmtShort(d.total)}</div>
    </div>`).join('') || '<p class="text-muted small-note">No expenses yet.</p>';

  // Invoice table
  document.getElementById('report-inv-table').innerHTML = inv.length
    ? `<table style="min-width:auto;">
        <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${[...inv].reverse().map(i=>`<tr>
          <td>INV-${i.id}</td><td>${i.client_name}</td>
          <td>${fmtDate(i.invoice_date)}</td>
          <td>${fmtShort(invTotal(i))}</td>
          <td>${statusBadge(i.status)}</td>
        </tr>`).join('')}</tbody>
      </table>`
    : '<p style="padding:1rem;color:var(--gray-400);">No invoices yet.</p>';
}

/* ── USERS (Admin only) ────────────────────── */
async function renderUsers() {
  if (!isAdmin()) {
    document.getElementById('panel-users').innerHTML =
      '<div class="card"><div class="card-body text-muted" style="padding:2rem;">Access restricted to Proprietor only.</div></div>';
    return;
  }
  const users = await sb('ajigs_app_users?select=*&order=name.asc') || [];
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = users.length
    ? users.map(u=>`<tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${statusBadge(u.is_active?'Active':'Inactive')}</td>
        <td>${u.role==='Proprietor'?'Full Access':(u.permissions?(typeof u.permissions==='string'?JSON.parse(u.permissions):u.permissions):[]).join(', ')||'None'}</td>
        <td><div class="td-actions">
          <button class="btn btn-icon btn-sm" onclick="editUser(${u.id})" title="Edit">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="toggleUserActive(${u.id},${u.is_active})" title="Toggle">${u.is_active?'🔒':'🔓'}</button>
          ${u.email!==currentUser.email?`<button class="btn btn-icon btn-sm" onclick="deleteUser(${u.id})" title="Delete">🗑️</button>`:''}
        </div></td>
      </tr>`).join('')
    : '<tr class="td-empty"><td colspan="6">No users yet.</td></tr>';
}

async function openUserModal(id=null) {
  editingId.users = id;
  document.getElementById('modal-user-title').textContent = id ? 'Edit User' : 'Add User';
  document.getElementById('user-modal-alert').classList.add('d-none');

  // Build permissions checkboxes
  const permWrap = document.getElementById('user-permissions-wrap');
  let existingPerms = [];

  if (id) {
    const rows = await sb(`ajigs_app_users?id=eq.${id}&select=*`) || [];
    if (!rows.length) return;
    const u = rows[0];
    document.getElementById('user-name').value  = u.name||'';
    document.getElementById('user-email').value = u.email||'';
    document.getElementById('user-pass').value  = '';
    document.getElementById('user-role').value  = u.role||'Staff';
    existingPerms = u.permissions
      ? (typeof u.permissions==='string' ? JSON.parse(u.permissions) : u.permissions)
      : ALL_SECTIONS;
  } else {
    ['user-name','user-email','user-pass'].forEach(i=>{ document.getElementById(i).value=''; });
    document.getElementById('user-role').value = 'Staff';
    existingPerms = [];
  }

  if (permWrap) {
    permWrap.innerHTML = `
      <div style="margin-top:.5rem;">
        <div style="font-size:11.5px;color:var(--gray-500);margin-bottom:.75rem;">
          Tick the sections this staff member can access. Proprietor always has full access.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
          ${ALL_SECTIONS.map(s=>`
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;padding:6px 10px;border:1px solid var(--gray-200);border-radius:5px;background:var(--gray-50);">
              <input type="checkbox" value="${s}" id="perm-${s}"
                ${existingPerms.includes(s)?'checked':''}
                style="accent-color:var(--orange);width:16px;height:16px;">
              ${s.charAt(0).toUpperCase()+s.slice(1)}
            </label>`).join('')}
        </div>
        <div style="margin-top:.75rem;display:flex;gap:.5rem;">
          <button class="btn btn-secondary btn-xs" onclick="setAllPerms(true)">Select All</button>
          <button class="btn btn-secondary btn-xs" onclick="setAllPerms(false)">Clear All</button>
        </div>
      </div>`;
  }
  openModal('modal-user');
}

function setAllPerms(checked) {
  ALL_SECTIONS.forEach(s => {
    const el = document.getElementById(`perm-${s}`);
    if (el) el.checked = checked;
  });
}

async function editUser(id) { await openUserModal(id); }

async function saveUser() {
  const name  = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const pass  = document.getElementById('user-pass').value;
  const role  = document.getElementById('user-role').value;
  const alertEl = document.getElementById('user-modal-alert');
  alertEl.classList.add('d-none');

  if (!name||!email) {
    alertEl.textContent = 'Name and email are required.';
    alertEl.classList.remove('d-none');
    return;
  }
  if (!editingId.users && !pass) {
    alertEl.textContent = 'Password is required for new users.';
    alertEl.classList.remove('d-none');
    return;
  }

  // Collect permissions from checkboxes
  const permissions = role==='Proprietor'
    ? ALL_SECTIONS
    : ALL_SECTIONS.filter(s => {
        const el = document.getElementById(`perm-${s}`);
        return el && el.checked;
      });

  const data = { name, email, role, permissions: JSON.stringify(permissions), is_active: true };

  let result;
  if (editingId.users) {
    result = await sb(`ajigs_app_users?id=eq.${editingId.users}`, 'PATCH', { name, role, permissions: JSON.stringify(permissions) });
  } else {
    result = await sb('ajigs_app_users', 'POST', data);
  }
  if (result===null) {
    alertEl.textContent = 'Failed to save user. Try again.';
    alertEl.classList.remove('d-none');
    return;
  }
  closeModal('modal-user');
  renderUsers();
}

async function toggleUserActive(id, current) {
  await sb(`ajigs_app_users?id=eq.${id}`, 'PATCH', { is_active: !current });
  renderUsers();
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await sb(`ajigs_app_users?id=eq.${id}`, 'DELETE');
  renderUsers();
}

/* ── GALLERY ───────────────────────────────── */
const GALLERY_CATEGORIES = ['Construction','Building Materials Supply','Automobile Sales','Engineering Projects','Cleaning Services'];

async function renderGalleryPanel() {
  const items = await sb('ajigs_gallery?select=*&order=created_at.desc') || [];

  const sub = document.getElementById('gallery-subtitle');
  if (sub) sub.textContent = `${items.length} photo(s)`;

  const grid = document.getElementById('gallery-admin-grid');
  if (!grid) return;

  grid.innerHTML = items.length
    ? items.map(item => `
        <div class="card" style="overflow:hidden;">
          <div style="aspect-ratio:4/3;background:var(--gray-100);overflow:hidden;">
            ${item.image_url
              ? `<img src="${item.image_url}" alt="${item.title||''}" style="width:100%;height:100%;object-fit:cover;">`
              : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2.5rem;color:var(--gray-300);">📷</div>`
            }
          </div>
          <div class="card-body" style="padding:.75rem;">
            <div style="font-weight:700;font-size:13.5px;margin-bottom:2px;">${item.title||'Untitled'}</div>
            <div style="font-size:11.5px;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${item.category||''}</div>
            ${item.description?`<div style="font-size:12px;color:var(--gray-500);margin-bottom:8px;">${item.description}</div>`:''}
            <div style="font-size:11px;color:var(--gray-400);margin-bottom:8px;">By ${item.uploaded_by||'—'}</div>
            <button class="btn btn-danger btn-sm" style="width:100%;justify-content:center;" onclick="deleteGalleryItem(${item.id})">🗑️ Delete</button>
          </div>
        </div>`).join('')
    : '<div class="td-empty" style="padding:2rem;text-align:center;color:var(--gray-400);grid-column:1/-1;">No gallery photos yet. Click + Add Photo to upload one.</div>';
}

function openGalleryModal() {
  document.getElementById('gallery-title').value = '';
  document.getElementById('gallery-desc').value  = '';
  document.getElementById('gallery-category').value = GALLERY_CATEGORIES[0];
  document.getElementById('gallery-file').value = '';
  document.getElementById('gallery-preview').innerHTML = '';
  document.getElementById('gallery-modal-alert').classList.add('d-none');
  openModal('modal-gallery');
}

function previewGalleryImage(input) {
  const preview = document.getElementById('gallery-preview');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:160px;border-radius:6px;margin-top:8px;">`;
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    preview.innerHTML = '';
  }
}

async function saveGalleryItem() {
  const title    = document.getElementById('gallery-title').value.trim();
  const category = document.getElementById('gallery-category').value;
  const desc     = document.getElementById('gallery-desc').value.trim();
  const fileInput= document.getElementById('gallery-file');
  const alertEl  = document.getElementById('gallery-modal-alert');
  const saveBtn  = document.getElementById('gallery-save-btn');
  alertEl.classList.add('d-none');

  if (!title) { alertEl.textContent = 'Title is required.'; alertEl.classList.remove('d-none'); return; }
  if (!fileInput.files || !fileInput.files[0]) { alertEl.textContent = 'Please choose a photo to upload.'; alertEl.classList.remove('d-none'); return; }

  const file = fileInput.files[0];
  if (file.size > 5 * 1024 * 1024) { alertEl.textContent = 'Image too large. Max 5MB.'; alertEl.classList.remove('d-none'); return; }

  saveBtn.textContent = 'Uploading...';
  saveBtn.disabled = true;

  try {
    // Upload to Supabase Storage bucket "ajigs-gallery"
    const ext = file.name.split('.').pop();
    const fileName = `gallery_${Date.now()}.${ext}`;
    const token = localStorage.getItem('ajigs_token');

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/ajigs-gallery/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error('Upload failed: ' + errText);
    }

    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/ajigs-gallery/${fileName}`;

    const result = await sb('ajigs_gallery', 'POST', {
      title, category, description: desc,
      image_url: imageUrl,
      uploaded_by: currentUser.name,
    });

    if (result === null) throw new Error('Failed to save gallery record.');

    closeModal('modal-gallery');
    renderGalleryPanel();
  } catch (e) {
    console.error(e);
    alertEl.textContent = 'Upload failed. Please check your connection and try again.';
    alertEl.classList.remove('d-none');
  } finally {
    saveBtn.textContent = 'Upload Photo';
    saveBtn.disabled = false;
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Delete this photo? It will be removed from the public gallery.')) return;
  await sb(`ajigs_gallery?id=eq.${id}`, 'DELETE');
  renderGalleryPanel();
}

/* ── PROFILE ───────────────────────────────── */
function renderProfile() {
  const el = document.getElementById('profile-avatar');
  if (el) el.textContent = (currentUser.name||'U').charAt(0).toUpperCase();
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

  if (!newPass) { errorEl.textContent='Enter a new password.'; errorEl.classList.remove('d-none'); return; }
  if (newPass!==confPass) { errorEl.textContent='Passwords do not match.'; errorEl.classList.remove('d-none'); return; }

  const token = localStorage.getItem('ajigs_token');
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_KEY, 'Authorization':`Bearer ${token}` },
      body: JSON.stringify({ password: newPass }),
    });
    if (res.ok) {
      alertEl.classList.remove('d-none');
      document.getElementById('profile-newpass').value  = '';
      document.getElementById('profile-confpass').value = '';
    } else {
      const d = await res.json();
      errorEl.textContent = d.message||'Failed to update password.';
      errorEl.classList.remove('d-none');
    }
  } catch(e) {
    errorEl.textContent = 'Connection error.';
    errorEl.classList.remove('d-none');
  }
}

/* ── INIT ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initAuth);
