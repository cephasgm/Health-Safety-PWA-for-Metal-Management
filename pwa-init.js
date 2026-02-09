// PWA Installation Manager
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://');
        
        this.setupListeners();
        this.checkInstallability();
    }
    
    setupListeners() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButtons();
            this.showInstallPrompt();
        });
        
        // Listen for appinstalled event
        window.addEventListener('appinstalled', (e) => {
            console.log('PWA was installed');
            this.hideInstallButtons();
            this.showToast('App installed successfully!', 'success');
            this.deferredPrompt = null;
        });
        
        // Check if already installed
        if (this.isStandalone) {
            console.log('App is running in standalone mode');
            this.hideInstallButtons();
        }
    }
    
    showInstallButtons() {
        const headerBtn = document.getElementById('installBtn');
        const sidebarBtn = document.getElementById('sidebarInstallBtn');
        
        if (headerBtn) headerBtn.style.display = 'inline-flex';
        if (sidebarBtn) sidebarBtn.style.display = 'flex';
    }
    
    hideInstallButtons() {
        const headerBtn = document.getElementById('installBtn');
        const sidebarBtn = document.getElementById('sidebarInstallBtn');
        
        if (headerBtn) headerBtn.style.display = 'none';
        if (sidebarBtn) sidebarBtn.style.display = 'none';
    }
    
    showInstallPrompt() {
        // Show a custom install prompt after 5 seconds if not already installed
        setTimeout(() => {
            if (this.deferredPrompt && !this.isStandalone) {
                this.showToast(
                    'Install MMS Safety App for quick access!',
                    'info',
                    5000,
                    () => this.installPWA()
                );
            }
        }, 5000);
    }
    
    async installPWA() {
        if (!this.deferredPrompt) {
            this.showToast('Installation not available', 'error');
            return;
        }
        
        try {
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const choiceResult = await this.deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.showToast('Installing...', 'success');
            } else {
                console.log('User dismissed the install prompt');
                this.showToast('Installation cancelled', 'warning');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButtons();
            
        } catch (error) {
            console.error('Installation error:', error);
            this.showToast('Installation failed. Please try again.', 'error');
        }
    }
    
    checkInstallability() {
        // Check if the app meets installation criteria
        const isInstallable = () => {
            // Check if app is not already installed
            if (this.isStandalone) return false;
            
            // Check if beforeinstallprompt event might fire
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isEdge = /Edg/.test(navigator.userAgent);
            const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            
            return isChrome || isEdge || isSafari;
        };
        
        if (isInstallable()) {
            console.log('App is installable on this device');
        } else {
            console.log('App may not be installable on this device/browser');
            this.hideInstallButtons();
        }
    }
    
    showToast(message, type = 'info', duration = 3000, action = null) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: var(--surface);
            border: 1px solid var(--border);
            border-left: 4px solid ${this.getColorForType(type)};
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 1000;
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 400px;
            width: 90%;
        `;
        
        const icon = document.createElement('div');
        icon.textContent = this.getIconForType(type);
        icon.style.fontSize = '1.25rem';
        
        const content = document.createElement('div');
        content.style.flex = '1';
        
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.fontSize = '0.875rem';
        
        content.appendChild(messageEl);
        
        if (action) {
            const actionBtn = document.createElement('button');
            actionBtn.textContent = 'Install';
            actionBtn.style.cssText = `
                margin-left: 10px;
                padding: 4px 12px;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.75rem;
            `;
            actionBtn.onclick = action;
            content.appendChild(actionBtn);
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            font-size: 1.25rem;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => this.hideToast(toast);
        
        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        }, 100);
        
        // Auto hide
        if (duration > 0) {
            setTimeout(() => this.hideToast(toast), duration);
        }
    }
    
    hideToast(toast) {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    getColorForType(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }
    
    getIconForType(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
}

// Initialize PWA Installer
window.pwaInstaller = new PWAInstaller();

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = './sw.js';
        
        navigator.serviceWorker.register(swUrl)
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New content is available; please refresh.');
                            window.pwaInstaller.showToast(
                                'New version available! Refresh to update.',
                                'info',
                                5000,
                                () => location.reload()
                            );
                        }
                    });
                });
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });
    });
}

// Detect if app is running in standalone mode
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('Running in standalone PWA mode');
    document.documentElement.classList.add('standalone-mode');
}

// Handle offline/online events
window.addEventListener('online', () => {
    console.log('App is online');
    window.pwaInstaller.showToast('Back online', 'success', 2000);
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    window.pwaInstaller.showToast('You are offline. Some features may not work.', 'warning', 5000);
});

// Check initial connection status
if (!navigator.onLine) {
    console.log('App started offline');
    window.pwaInstaller.showToast('App started offline. Using cached data.', 'warning', 3000);
}
