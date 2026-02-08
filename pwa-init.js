// PWA Installation and Service Worker Registration
class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = document.getElementById('installBtn');
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone;
    
    this.init();
  }

  init() {
    // Register Service Worker
    this.registerServiceWorker();
    
    // Set up install prompt
    this.setupInstallPrompt();
    
    // Check if already installed
    this.checkIfInstalled();
    
    // Setup beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      this.handleBeforeInstallPrompt(e);
    });
    
    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.handleAppInstalled();
    });
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('ServiceWorker registration successful:', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              console.log('New service worker found:', newWorker);
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.showUpdateNotification();
                }
              });
            });
          })
          .catch(error => {
            console.log('ServiceWorker registration failed:', error);
          });
      });
    }
  }

  setupInstallPrompt() {
    if (this.installButton) {
      this.installButton.addEventListener('click', () => {
        this.installPWA();
      });
      
      // Hide install button if already installed
      if (this.isStandalone) {
        this.installButton.style.display = 'none';
      }
    }
  }

  handleBeforeInstallPrompt(e) {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    this.deferredPrompt = e;
    
    // Show install button if not in standalone mode
    if (!this.isStandalone && this.installButton) {
      this.installButton.style.display = 'inline-flex';
      
      // Update button text
      this.installButton.innerHTML = '⬇️ Install App';
      this.installButton.onclick = () => this.installPWA();
    }
  }

  async installPWA() {
    if (!this.deferredPrompt) {
      // Already installed or browser doesn't support install
      this.showAlreadyInstalledMessage();
      return;
    }
    
    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, discard it
    this.deferredPrompt = null;
    
    // Hide the install button
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      this.showToast('App installed successfully! 🎉', 'success');
    } else {
      console.log('User dismissed the install prompt');
      this.showToast('Installation cancelled. You can install later.', 'info');
    }
  }

  handleAppInstalled() {
    console.log('PWA was installed');
    this.deferredPrompt = null;
    
    // Hide install button
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
    
    // Show welcome message
    this.showToast('Welcome to MMS Safety App! 🎉', 'success');
    
    // Track installation
    this.trackInstallation();
  }

  checkIfInstalled() {
    // Check display mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone;
    
    if (isStandalone && this.installButton) {
      this.installButton.style.display = 'none';
    }
    
    // Check for web app capabilities
    const hasInstallPrompt = 'BeforeInstallPromptEvent' in window;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    
    // Show iOS installation instructions if needed
    if (isIOS && !isStandalone && !isChrome) {
      this.showIOSInstallInstructions();
    }
  }

  showIOSInstallInstructions() {
    const instructions = `
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
        <h4 style="margin: 0 0 0.5rem 0;">📱 Install on iOS</h4>
        <p style="margin: 0; font-size: 0.9rem;">
          1. Tap the Share button <span style="font-size: 1.2rem;">⎙</span><br>
          2. Scroll down and tap "Add to Home Screen"<br>
          3. Tap "Add" in the top right
        </p>
      </div>
    `;
    
    const header = document.querySelector('.header');
    if (header) {
      header.insertAdjacentHTML('afterend', instructions);
    }
  }

  showUpdateNotification() {
    if (confirm('A new version of MMS Safety App is available. Reload to update?')) {
      window.location.reload();
    }
  }

  showAlreadyInstalledMessage() {
    this.showToast('App is already installed! ✅', 'info');
  }

  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">${type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  trackInstallation() {
    // Track installation in localStorage
    localStorage.setItem('mms_app_installed', new Date().toISOString());
    
    // Send analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', 'app_installed', {
        'event_category': 'pwa',
        'event_label': 'installation'
      });
    }
  }
}

// Initialize PWA when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create install button if not exists
  if (!document.getElementById('installBtn')) {
    const header = document.querySelector('.header');
    if (header) {
      const installBtn = document.createElement('button');
      installBtn.id = 'installBtn';
      installBtn.className = 'btn btn-success';
      installBtn.innerHTML = '⬇️ Download as App';
      installBtn.style.marginLeft = '0.5rem';
      header.querySelector('div:last-child').appendChild(installBtn);
    }
  }
  
  // Initialize PWA installer
  window.pwaInstaller = new PWAInstaller();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
