/* =============================================
   AJIGS CONNECT — pwa.js
   PWA Registration & Install Prompt
   ============================================= */

'use strict';

// ---- REGISTER SERVICE WORKER ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[AJIGS PWA] Service Worker registered. Scope:', reg.scope);

        // Check for updates on each load
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — show refresh banner
              showUpdateBanner();
            }
          });
        });
      })
      .catch(err => {
        console.warn('[AJIGS PWA] Service Worker registration failed:', err);
      });
  });
}

// ---- UPDATE BANNER ----
function showUpdateBanner() {
  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #0a0a0a; color: #fff; padding: 12px 20px; border-radius: 8px;
    font-family: 'Source Sans 3', sans-serif; font-size: 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,.35); z-index: 9999;
    display: flex; align-items: center; gap: 14px; white-space: nowrap;
  `;
  banner.innerHTML = `
    <span>🔄 New version available</span>
    <button onclick="location.reload()" style="
      background: #E87722; color: #fff; border: none; padding: 6px 14px;
      border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 600;
    ">Refresh</button>
    <button onclick="this.parentElement.remove()" style="
      background: none; color: #aaa; border: none; cursor: pointer; font-size: 18px; line-height: 1;
    ">×</button>
  `;
  document.body.appendChild(banner);
}

// ---- INSTALL PROMPT (Add to Home Screen) ----
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // Don't show if already dismissed
  if (localStorage.getItem('ajigs_pwa_dismissed')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position: fixed; bottom: 80px; right: 20px;
    background: #0a0a0a; color: #fff; padding: 14px 18px; border-radius: 10px;
    font-family: 'Source Sans 3', sans-serif; font-size: 13.5px;
    box-shadow: 0 4px 24px rgba(0,0,0,.4); z-index: 9998;
    max-width: 280px; border: 1px solid #2a2a2a;
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div style="background:#E87722;width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Oswald',sans-serif;font-size:.85rem;color:#fff;letter-spacing:1px;flex-shrink:0;">AJ</div>
      <div>
        <div style="font-weight:700;margin-bottom:2px;">Install AJIGS CONNECT</div>
        <div style="color:#aaa;font-size:12px;line-height:1.5;">Add to your home screen for quick access</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button onclick="triggerInstall()" style="
        flex:1;background:#E87722;color:#fff;border:none;padding:7px 12px;
        border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;
      ">Install</button>
      <button onclick="dismissInstall()" style="
        background:#1a1a1a;color:#aaa;border:1px solid #333;padding:7px 12px;
        border-radius:5px;cursor:pointer;font-size:13px;
      ">Not now</button>
    </div>
  `;
  document.body.appendChild(banner);
}

function triggerInstall() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') {
      console.log('[AJIGS PWA] User installed the app');
    }
    deferredInstallPrompt = null;
  });
}

function dismissInstall() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
  localStorage.setItem('ajigs_pwa_dismissed', '1');
}

// ---- INSTALLED EVENT ----
window.addEventListener('appinstalled', () => {
  console.log('[AJIGS PWA] App installed successfully');
  deferredInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
});
