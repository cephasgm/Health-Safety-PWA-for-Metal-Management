// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;
        this.init();
    }

    init() {
        // Check if already installed
        if (this.isStandalone) {
            console.log('App is running in standalone mode');
            this.setupStandaloneUI();
            return;
        }

        // Register Service Worker
        this.registerServiceWorker();

        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('Install prompt available');
            
            // Show install button after a delay
            setTimeout(() => {
                if (!this.isIOS) {
                    this.showInstallButton();
                } else {
                    this.showIOSInstructions();
                }
            }, 3000);
        });

        // Check if already installed
        window.addEventListener('appinstalled', () => {
            console.log('App was installed successfully');
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.showToast('MMS Safety App installed successfully! 🎉', 'success');
        });

        // Setup periodic service worker updates
        this.setupUpdateChecks();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Check every hour
                    
                    // Listen for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New service worker found:', newWorker.state);
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateAvailable();
                            }
                        });
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                    this.showToast('Offline features unavailable', 'warning');
                });
        }
    }

    showInstallButton() {
        // Remove existing button if any
        this.hideInstallButton();
        
        // Create install button
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.className = 'btn btn-success';
        installBtn.innerHTML = '⬇️ Install App';
        installBtn.style.marginLeft = '0.5rem';
        installBtn.onclick = () => this.installPWA();
        
        // Add to header
        const headerActions = document.querySelector('.header div:last-child');
        if (headerActions) {
            headerActions.appendChild(installBtn);
        }
        
        // Also add to mobile menu if exists
        this.addInstallToMobileMenu();
    }

    addInstallToMobileMenu() {
        // Create mobile install button
        const mobileInstallBtn = document.createElement('button');
        mobileInstallBtn.id = 'mobileInstallBtn';
        mobileInstallBtn.className = 'btn btn-success';
        mobileInstallBtn.innerHTML = '⬇️ Install Safety App';
        mobileInstallBtn.style.width = '100%';
        mobileInstallBtn.style.marginTop = '1rem';
        mobileInstallBtn.onclick = () => this.installPWA();
        
        // Add to sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const lastSection = sidebar.querySelector('.nav-section:last-child');
            if (lastSection) {
                lastSection.appendChild(mobileInstallBtn);
            }
        }
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        const mobileInstallBtn = document.getElementById('mobileInstallBtn');
        
        if (installBtn) installBtn.remove();
        if (mobileInstallBtn) mobileInstallBtn.remove();
    }

    async installPWA() {
        if (!this.deferredPrompt) {
            if (this.isIOS) {
                this.showIOSInstructions();
            } else {
                this.showToast('App is already installed or installation not supported', 'info');
            }
            return;
        }
        
        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            this.deferredPrompt = null;
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.hideInstallButton();
            } else {
                console.log('User dismissed the install prompt');
            }
        } catch (error) {
            console.error('Installation failed:', error);
            this.showToast('Installation failed. Please try again.', 'error');
        }
    }

    showIOSInstructions() {
        const instructions = document.createElement('div');
        instructions.id = 'iosInstructions';
        instructions.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            right: 20px;
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            border: 2px solid var(--primary);
        `;
        
        instructions.innerHTML = `
            <h3 style="color: var(--primary); margin-bottom: 1rem;">📱 Install MMS Safety App</h3>
            <p style="margin-bottom: 1rem;">To install this app on your iOS device:</p>
            <ol style="margin-left: 1.5rem; margin-bottom: 1.5rem;">
                <li style="margin-bottom: 0.5rem;">Tap the <strong>Share</strong> button <span style="color: var(--primary);">⎋</span></li>
                <li style="margin-bottom: 0.5rem;">Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li style="margin-bottom: 0.5rem;">Tap <strong>"Add"</strong> in the top right</li>
            </ol>
            <div style="display: flex; gap: 1rem;">
                <button onclick="pwaInstaller.hideIOSInstructions()" class="btn btn-outline" style="flex: 1;">Close</button>
                <button onclick="pwaInstaller.showToast('Follow the steps above to install', 'info')" class="btn btn-primary" style="flex: 1;">Got it!</button>
            </div>
        `;
        
        document.body.appendChild(instructions);
    }

    hideIOSInstructions() {
        const instructions = document.getElementById('iosInstructions');
        if (instructions) {
            instructions.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => instructions.remove(), 300);
        }
    }

    showUpdateAvailable() {
        if (document.getElementById('updateNotification')) return;
        
        const updateNotification = document.createElement('div');
        updateNotification.id = 'updateNotification';
        updateNotification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            animation: slideIn 0.3s ease;
        `;
        
        updateNotification.innerHTML = `
            <span style="font-size: 1.5rem;">🔄</span>
            <div>
                <div style="font-weight: 600;">New version available!</div>
                <div style="font-size: 0.875rem; opacity: 0.9;">Refresh to update the app</div>
            </div>
            <button onclick="pwaInstaller.refreshApp()" style="margin-left: auto; padding: 0.5rem 1rem; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; cursor: pointer;">Refresh</button>
        `;
        
        document.body.appendChild(updateNotification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (updateNotification.parentNode) {
                updateNotification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => updateNotification.remove(), 300);
            }
        }, 10000);
    }

    refreshApp() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'SKIP_WAITING' });
        }
        window.location.reload();
    }

    setupStandaloneUI() {
        // Hide install button in standalone mode
        this.hideInstallButton();
        
        // Add standalone indicator
        const standaloneIndicator = document.createElement('div');
        standaloneIndicator.id = 'standaloneIndicator';
        standaloneIndicator.innerHTML = '📱 App Mode';
        standaloneIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: var(--success);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            z-index: 100;
        `;
        document.body.appendChild(standaloneIndicator);
        
        // Remove after 3 seconds
        setTimeout(() => {
            standaloneIndicator.style.opacity = '0';
            setTimeout(() => standaloneIndicator.remove(), 300);
        }, 3000);
    }

    setupUpdateChecks() {
        // Check for updates every 6 hours
        setInterval(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(registration => {
                    if (registration) {
                        registration.update();
                    }
                });
            }
        }, 6 * 60 * 60 * 1000);
    }

    showToast(message, type = 'info') {
        // Use existing toast system if available
        if (window.showToast) {
            const titles = {
                'success': 'Success',
                'error': 'Error',
                'warning': 'Warning',
                'info': 'Info'
            };
            window.showToast(titles[type], message, type);
            return;
        }
        
        // Fallback toast
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
            border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            animation: slideIn 0.3s ease;
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if running in iframe (prevent duplicate initialization)
    if (window.self !== window.top) {
        console.log('Running in iframe, skipping PWA initialization');
        return;
    }
    
    // Initialize PWA Installer
    window.pwaInstaller = new PWAInstaller();
    
    // Add PWA install button to header if needed
    setTimeout(() => {
        if (window.pwaInstaller && !window.pwaInstaller.isStandalone) {
            const existingBtn = document.getElementById('installBtn');
            if (!existingBtn && !window.pwaInstaller.isIOS) {
                window.pwaInstaller.showInstallButton();
            }
        }
    }, 2000);
});

// Listen for service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.action === 'UPDATE_AVAILABLE') {
            window.pwaInstaller?.showUpdateAvailable();
        }
    });
}

// Add CSS animations if not present
if (!document.getElementById('pwa-animations')) {
    const style = document.createElement('style');
    style.id = 'pwa-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(100px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
