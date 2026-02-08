// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;
        this.hasInstallPrompt = false;
        this.init();
    }

    init() {
        console.log('MMS Safety PWA Installer initialized');
        console.log('Platform:', this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Other');
        console.log('Standalone mode:', this.isStandalone);

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
            console.log('beforeinstallprompt event fired');
            e.preventDefault();
            this.deferredPrompt = e;
            this.hasInstallPrompt = true;
            
            // Show install button after a delay
            setTimeout(() => {
                this.showInstallButton();
            }, 2000);
        });

        // Check if already installed
        window.addEventListener('appinstalled', () => {
            console.log('App was installed successfully');
            this.deferredPrompt = null;
            this.hasInstallPrompt = false;
            this.hideInstallButton();
            this.showToast('MMS Safety App installed successfully! 🎉', 'success');
            
            // Track installation
            if (window.gtag) {
                gtag('event', 'pwa_installed');
            }
        });

        // Setup periodic service worker updates
        this.setupUpdateChecks();
        
        // Check for existing install button in header
        setTimeout(() => {
            this.checkAndAddInstallButton();
        }, 1000);
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/Health-Safety-PWA-for-Metal-Management/sw.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);
                        
                        // Check for updates periodically
                        setInterval(() => {
                            registration.update();
                        }, 60 * 60 * 1000);
                        
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
            });
        } else {
            console.log('Service Worker not supported');
        }
    }

    checkAndAddInstallButton() {
        // Check if we should show install button
        if (!this.isStandalone && (this.hasInstallPrompt || this.isIOS)) {
            this.showInstallButton();
        }
    }

    showInstallButton() {
        // Remove existing button if any
        this.hideInstallButton();
        
        // Don't show if already in standalone mode
        if (this.isStandalone) return;
        
        // Create install button
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.className = 'btn btn-success';
        installBtn.innerHTML = '⬇️ Install App';
        installBtn.style.marginLeft = '0.5rem';
        installBtn.style.marginTop = '0.5rem';
        installBtn.onclick = (e) => {
            e.stopPropagation();
            this.installPWA();
        };
        
        // Add to header
        const headerActions = document.querySelector('.header > div:last-child');
        if (headerActions) {
            headerActions.appendChild(installBtn);
        } else {
            // Fallback: add to main header area
            const header = document.querySelector('.header');
            if (header) {
                header.appendChild(installBtn);
            }
        }
        
        // Also add to mobile menu
        this.addInstallToMobileMenu();
    }

    addInstallToMobileMenu() {
        // Remove existing mobile install button
        const existingMobileBtn = document.getElementById('mobileInstallBtn');
        if (existingMobileBtn) existingMobileBtn.remove();
        
        // Create mobile install button
        const mobileInstallBtn = document.createElement('button');
        mobileInstallBtn.id = 'mobileInstallBtn';
        mobileInstallBtn.className = 'nav-item';
        mobileInstallBtn.style.cssText = `
            background: linear-gradient(135deg, var(--success), #059669) !important;
            color: white !important;
            margin-top: 1rem;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        mobileInstallBtn.innerHTML = `
            <span class="nav-icon">⬇️</span>
            Install Safety App
        `;
        mobileInstallBtn.onclick = (e) => {
            e.stopPropagation();
            this.installPWA();
        };
        
        // Add to sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const lastSection = sidebar.querySelector('.nav-section:last-child');
            if (lastSection) {
                lastSection.appendChild(mobileInstallBtn);
            } else {
                // Create new section if none exists
                const newSection = document.createElement('div');
                newSection.className = 'nav-section';
                newSection.innerHTML = '<div class="nav-title">Install App</div>';
                newSection.appendChild(mobileInstallBtn);
                sidebar.appendChild(newSection);
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
        if (this.isIOS) {
            this.showIOSInstructions();
            return;
        }
        
        if (!this.deferredPrompt) {
            this.showToast('Installation not available. Try using Chrome or Edge browser.', 'info');
            return;
        }
        
        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            this.deferredPrompt = null;
            this.hasInstallPrompt = false;
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.hideInstallButton();
                
                // Track installation acceptance
                if (window.gtag) {
                    gtag('event', 'pwa_install_accepted');
                }
            } else {
                console.log('User dismissed the install prompt');
                // Show toast that they can install later
                this.showToast('You can install the app anytime using the Install button', 'info');
                
                // Track installation dismissal
                if (window.gtag) {
                    gtag('event', 'pwa_install_dismissed');
                }
            }
        } catch (error) {
            console.error('Installation failed:', error);
            this.showToast('Installation failed. Please try again.', 'error');
        }
    }

    showIOSInstructions() {
        // Remove existing instructions if any
        this.hideIOSInstructions();
        
        const instructions = document.createElement('div');
        instructions.id = 'iosInstructions';
        instructions.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            border: 2px solid var(--primary);
            max-width: 500px;
            margin: 0 auto;
        `;
        
        instructions.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                <span style="font-size: 2rem; margin-right: 1rem;">📱</span>
                <h3 style="color: var(--primary); margin: 0;">Install MMS Safety App</h3>
            </div>
            <p style="margin-bottom: 1.5rem; color: var(--text);">To install this app on your iOS device:</p>
            <ol style="margin-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text);">
                <li style="margin-bottom: 0.75rem; padding-left: 0.5rem;">Tap the <strong style="color: var(--primary);">Share</strong> button <span style="display: inline-block; width: 24px; height: 24px; background: var(--primary); color: white; border-radius: 4px; text-align: center; line-height: 24px; margin: 0 4px;">↑</span></li>
                <li style="margin-bottom: 0.75rem; padding-left: 0.5rem;">Scroll down and tap <strong style="color: var(--primary);">"Add to Home Screen"</strong></li>
                <li style="margin-bottom: 0.75rem; padding-left: 0.5rem;">Tap <strong style="color: var(--primary);">"Add"</strong> in the top right corner</li>
            </ol>
            <div style="display: flex; gap: 1rem;">
                <button onclick="window.pwaInstaller.hideIOSInstructions()" class="btn btn-outline" style="flex: 1;">Close</button>
                <button onclick="window.pwaInstaller.hideIOSInstructions(); window.pwaInstaller.showToast('Follow the steps above to install', 'info');" class="btn btn-primary" style="flex: 1;">Got it!</button>
            </div>
        `;
        
        document.body.appendChild(instructions);
        
        // Add overlay
        const overlay = document.createElement('div');
        overlay.id = 'iosInstructionsOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        overlay.onclick = () => this.hideIOSInstructions();
        document.body.appendChild(overlay);
    }

    hideIOSInstructions() {
        const instructions = document.getElementById('iosInstructions');
        const overlay = document.getElementById('iosInstructionsOverlay');
        
        if (instructions) {
            instructions.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => instructions.remove(), 300);
        }
        if (overlay) overlay.remove();
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
            max-width: 90%;
            min-width: 300px;
        `;
        
        updateNotification.innerHTML = `
            <span style="font-size: 1.5rem;">🔄</span>
            <div style="flex: 1;">
                <div style="font-weight: 600;">Update Available!</div>
                <div style="font-size: 0.875rem; opacity: 0.9;">New version of MMS Safety App is ready</div>
            </div>
            <button onclick="window.pwaInstaller.refreshApp()" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; color: white; cursor: pointer; white-space: nowrap;">Update Now</button>
        `;
        
        document.body.appendChild(updateNotification);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (updateNotification.parentNode) {
                updateNotification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => updateNotification.remove(), 300);
            }
        }, 15000);
    }

    refreshApp() {
        // Remove update notification
        const updateNotification = document.getElementById('updateNotification');
        if (updateNotification) updateNotification.remove();
        
        // Show updating message
        this.showToast('Updating app...', 'info');
        
        // Post message to service worker and reload
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'SKIP_WAITING' });
            
            // Listen for controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        } else {
            // Fallback reload
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    setupStandaloneUI() {
        // Hide install button in standalone mode
        this.hideInstallButton();
        
        // Add standalone indicator briefly
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
            opacity: 0.9;
        `;
        document.body.appendChild(standaloneIndicator);
        
        // Remove after 3 seconds
        setTimeout(() => {
            standaloneIndicator.style.opacity = '0';
            setTimeout(() => standaloneIndicator.remove(), 300);
        }, 3000);
        
        // Adjust UI for standalone mode if needed
        if (this.isIOS) {
            // Add iOS standalone mode adjustments
            document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
            document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
        }
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
        if (typeof window.showToast === 'function') {
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
        const toastId = 'pwa-toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
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
            max-width: 90%;
            min-width: 200px;
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span style="font-size: 1.25rem;">${icon}</span><span>${message}</span>`;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
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
    
    // Check if we're on a secure context (required for PWA)
    if (!window.isSecureContext) {
        console.warn('Not running in secure context. PWA features may be limited.');
    }
    
    // Initialize PWA Installer
    try {
        window.pwaInstaller = new PWAInstaller();
        console.log('PWA Installer initialized successfully');
    } catch (error) {
        console.error('Failed to initialize PWA Installer:', error);
    }
});

// Listen for service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.action === 'UPDATE_AVAILABLE') {
            if (window.pwaInstaller) {
                window.pwaInstaller.showUpdateAvailable();
            }
        }
        
        if (event.data && event.data.action === 'INSTALLED') {
            console.log('Service Worker installed successfully');
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

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstaller;
}
