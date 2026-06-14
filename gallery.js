/* =============================================
   AJIGS CONNECT — gallery.js
   Public Gallery Page — loads images from Supabase
   ============================================= */
'use strict';

const GALLERY_SUPABASE_URL = 'https://pelkootzjmcppuljgbqs.supabase.co';
const GALLERY_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbGtvb3R6am1jcHB1bGpnYnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDY3NDEsImV4cCI6MjA5NTM4Mjc0MX0.rjuqM25Tx0pQNm-vZ9VdxkePimuUqYapU9bwmUhx2fw';

let galleryItems = [];
let activeCategory = '';

const categoryIcons = {
  'Construction': '🏗️',
  'Building Materials Supply': '🧱',
  'Automobile Sales': '🚗',
  'Engineering Projects': '⚙️',
  'Cleaning Services': '🏠',
};

async function loadGallery() {
  try {
    const res = await fetch(`${GALLERY_SUPABASE_URL}/rest/v1/ajigs_gallery?select=*&order=created_at.desc`, {
      headers: { 'apikey': GALLERY_SUPABASE_KEY }
    });
    galleryItems = await res.json();
    if (!Array.isArray(galleryItems)) galleryItems = [];
  } catch (e) {
    console.error('Gallery load error:', e);
    galleryItems = [];
  }
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const filtered = activeCategory
    ? galleryItems.filter(item => item.category === activeCategory)
    : galleryItems;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="gallery-empty" style="grid-column:1/-1;">
        <div style="font-size:3rem;margin-bottom:1rem;">📷</div>
        <p>No photos in this category yet. Check back soon — we're adding more project photos regularly.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((item, i) => `
    <div class="gallery-item" onclick="openLightbox(${i})">
      ${item.image_url
        ? `<img src="${item.image_url}" alt="${item.title || ''}" loading="lazy">`
        : `<div class="gallery-placeholder">${categoryIcons[item.category] || '📷'}</div>`
      }
      <div class="gallery-item-overlay">
        <div class="gallery-item-title">${item.title || 'Untitled'}</div>
        <div class="gallery-item-cat">${item.category || ''}</div>
      </div>
    </div>`).join('');

  // Store filtered list for lightbox navigation
  window._galleryFiltered = filtered;
}

function openLightbox(idx) {
  const item = window._galleryFiltered[idx];
  if (!item) return;
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = item.image_url || '';
  document.getElementById('lightbox-caption').innerHTML =
    `<strong>${item.title || ''}</strong><br><span style="color:#E87722;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${item.category || ''}</span>` +
    (item.description ? `<br><span style="color:#aaa;font-size:13px;">${item.description}</span>` : '');
  lb.classList.add('open');
}

function closeLightbox(e) {
  if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close')) {
    document.getElementById('lightbox').classList.remove('open');
  }
}

// Filter buttons
document.addEventListener('DOMContentLoaded', () => {
  loadGallery();
  document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderGallery();
    });
  });
});

// Close lightbox on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('lightbox').classList.remove('open');
});
