// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    this.init();
  }

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPromotion();
    });

    window.addEventListener('appinstalled', () => {
      console.log('MMS Safety App installed');
      this.deferredPrompt = null;
    });

    this.registerServiceWorker();
    
    if (this.isIOS && !this.isStandalone) {
      setTimeout(() => this.showIOSInstallPromotion(), 5000);
    }
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered');
      } catch (error) {
        console.error('Service Worker failed:', error);
      }
    }
  }

  showInstallPromotion() {
    if (this.isStandalone) return;
    
    const installBtn = document.getElementById('installBtn');
    const sidebarBtn = document.getElementById('sidebarInstallBtn');
    
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      installBtn.addEventListener('click', () => this.installPWA());
    }
    if (sidebarBtn) {
      sidebarBtn.style.display = 'block';
      sidebarBtn.addEventListener('click', () => this.installPWA());
    }
  }

  async installPWA() {
    if (this.isIOS) {
      this.showIOSInstructions();
      return;
    }

    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
    }
  }

  showIOSInstallPromotion() {
    // Simple iOS instruction alert
    setTimeout(() => {
      if (!this.isStandalone && confirm('Install MMS Safety App?\nTap Share → "Add to Home Screen"')) {
        this.showIOSInstructions();
      }
    }, 7000);
  }

  showIOSInstructions() {
    alert('To install MMS Safety App:\n\n1. Tap the Share button (📤)\n2. Scroll down\n3. Tap "Add to Home Screen"\n4. Tap "Add"');
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pwaInstaller = new PWAInstaller();
  });
} else {
  window.pwaInstaller = new PWAInstaller();
}
