// PWA Installation Handler for MMS Safety Dashboard
console.log('🚀 MMS Safety PWA System Initializing...');

let deferredPrompt = null;
let isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                   window.navigator.standalone;

// 1. SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      console.log('✅ Service Worker registered:', registration.scope);
    } catch (error) {
      console.warn('⚠️ Service Worker failed:', error);
    }
  });
}

// 2. INSTALL PROMPT HANDLER
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 PWA Install Prompt Available');
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install buttons IMMEDIATELY
  showInstallButtons();
  
  // Auto-show install banner after 3 seconds
  setTimeout(() => {
    if (!isStandalone && deferredPrompt) {
      showInstallBanner();
    }
  }, 3000);
});

// 3. APP INSTALLED EVENT
window.addEventListener('appinstalled', () => {
  console.log('🎉 MMS Safety App Installed!');
  deferredPrompt = null;
  hideInstallButtons();
  showToast('App installed successfully! 🎉', 'success');
});

// 4. SHOW INSTALL BUTTONS FUNCTION
function showInstallButtons() {
  const headerBtn = document.getElementById('installBtn');
  const sidebarBtn = document.getElementById('sidebarInstallBtn');
  
  if (headerBtn) {
    headerBtn.style.display = 'inline-flex';
    headerBtn.onclick = installPWA;
  }
  
  if (sidebarBtn) {
    sidebarBtn.style.display = 'block';
    sidebarBtn.onclick = installPWA;
  }
}

// 5. HIDE INSTALL BUTTONS FUNCTION
function hideInstallButtons() {
  const headerBtn = document.getElementById('installBtn');
  const sidebarBtn = document.getElementById('sidebarInstallBtn');
  
  if (headerBtn) headerBtn.style.display = 'none';
  if (sidebarBtn) sidebarBtn.style.display = 'none';
}

// 6. INSTALL PWA FUNCTION
function installPWA() {
  if (!deferredPrompt) {
    showToast('Installation not available. Try manual install.', 'info');
    showManualInstallInstructions();
    return;
  }
  
  deferredPrompt.prompt();
  
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('✅ User accepted install');
      showToast('Installing app...', 'success');
    } else {
      console.log('❌ User declined install');
      showToast('Installation cancelled', 'info');
    }
    deferredPrompt = null;
  });
}

// 7. AUTO-SHOW INSTALL BANNER
function showInstallBanner() {
  // Don't show if already installed or banner exists
  if (isStandalone || document.getElementById('autoInstallBanner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'autoInstallBanner';
  banner.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: white;
      padding: 16px 24px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideInUp 0.5s ease;
      max-width: 500px;
      width: 90%;
      border: 2px solid rgba(255,255,255,0.2);
    ">
      <div style="font-size: 2rem;">📱</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 1rem;">Install MMS Safety App</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">Quick access from home screen</div>
      </div>
      <button id="installNowBtn" style="
        padding: 8px 16px;
        background: white;
        color: #dc2626;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      ">Install</button>
      <button id="dismissBanner" style="
        padding: 8px 12px;
        background: transparent;
        color: white;
        border: none;
        font-weight: 600;
        cursor: pointer;
      ">×</button>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInUp {
      from { transform: translate(-50%, 100px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideOutDown {
      from { transform: translate(-50%, 0); opacity: 1; }
      to { transform: translate(-50%, 100px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  // Event listeners
  document.getElementById('installNowBtn').onclick = installPWA;
  document.getElementById('dismissBanner').onclick = () => {
    banner.style.animation = 'slideOutDown 0.3s ease forwards';
    setTimeout(() => banner.remove(), 300);
  };
  
  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.animation = 'slideOutDown 0.3s ease forwards';
      setTimeout(() => banner.remove(), 300);
    }
  }, 30000);
}

// 8. MANUAL INSTALL INSTRUCTIONS
function showManualInstallInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  let instructions = '';
  
  if (isIOS) {
    instructions = `
      <strong>iOS Installation:</strong><br>
      1. Tap the Share button (📤)<br>
      2. Scroll down<br>
      3. Tap "Add to Home Screen"<br>
      4. Tap "Add"
    `;
  } else if (isAndroid) {
    instructions = `
      <strong>Android Installation:</strong><br>
      1. Tap the menu (⋮)<br>
      2. Tap "Install app" or "Add to Home screen"
    `;
  } else {
    instructions = `
      <strong>Desktop Installation:</strong><br>
      1. Look for the install icon (⎙) in the address bar<br>
      2. Or check Chrome/Edge menu for "Install MMS Safety"
    `;
  }
  
  showToast(instructions, 'info', 8000);
}

// 9. TOAST NOTIFICATION FUNCTION
function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toast
  const existing = document.getElementById('pwaToast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'pwaToast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      z-index: 9999;
      max-width: 400px;
      width: 90%;
      text-align: center;
      animation: fadeInUp 0.3s ease;
    ">
      ${message}
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'fadeOutDown 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// 10. CHECK IF ALREADY INSTALLED
if (isStandalone) {
  console.log('✅ App already installed in standalone mode');
  hideInstallButtons();
} else {
  console.log('📱 App not installed - ready for installation');
}

console.log('✅ PWA System Ready');
