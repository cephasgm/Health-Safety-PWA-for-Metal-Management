// PWA Installation Handler
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.init();
  }

  init() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('Service Worker Registration Failed:', err));
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.hideInstallButton();
      this.showToast('App installed successfully!', 'success');
    });
  }

  showInstallButton() {
    let installBtn = document.getElementById('installBtn');
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'installBtn';
      installBtn.className = 'btn btn-success';
      installBtn.innerHTML = '⬇️ Install App';
      installBtn.style.marginLeft = '0.5rem';
      installBtn.onclick = () => this.installPWA();
      
      const header = document.querySelector('.header div:last-child');
      if (header) {
        header.appendChild(installBtn);
      }
    }
    installBtn.style.display = 'inline-flex';
  }

  hideInstallButton() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  async installPWA() {
    if (!this.deferredPrompt) {
      this.showToast('App is already installed or installation not supported', 'info');
      return;
    }
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    this.deferredPrompt = null;
    
    if (outcome === 'accepted') {
      this.showToast('App installed successfully! 🎉', 'success');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      animation: slideIn 0.3s ease;
    `;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaInstaller = new PWAInstaller();
  });
} else {
  window.pwaInstaller = new PWAInstaller();
}
