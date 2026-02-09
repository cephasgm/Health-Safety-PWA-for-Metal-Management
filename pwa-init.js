// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone ||
                            document.referrer.includes('android-app://');
        
        this.init();
    }

    init() {
        console.log('MMS Safety PWA Installer initialized');
        
        // Don't show install button if already installed
        if (this.isStandalone) {
            console.log('Already installed in standalone mode');
            this.updateAppStatus('installed');
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPromotion();
        });

        // Check if app was installed
        window.addEventListener('appinstalled', () => {
            console.log('MMS Safety App was installed');
            this.deferredPrompt = null;
            this.updateAppStatus('installed');
            this.showNotification('MMS Safety App installed successfully! 🎉', 'success');
        });

        // Check for service worker updates
        this.checkForUpdates();
        
        // Register service worker
        this.registerServiceWorker();
        
        // Show install promotion after delay
        setTimeout(() => {
            if (!this.isStandalone && this.isIOS) {
                this.showIOSInstallPromotion();
            }
        }, 3000);
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Service Worker update found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    showInstallPromotion() {
        // Create install promotion banner
        const installBanner = document.createElement('div');
        installBanner.id = 'pwaInstallBanner';
        installBanner.style.cssText = `
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
            animation: slideInUp 0.3s ease;
            max-width: 500px;
            width: 90%;
        `;
        
        installBanner.innerHTML = `
            <div style="font-size: 2rem;">📱</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 1rem; margin-bottom: 4px;">Install MMS Safety App</div>
                <div style="font-size: 0.85rem; opacity: 0.9;">Access safety dashboard quickly from your home screen</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="installPWA" style="
                    padding: 8px 16px;
                    background: white;
                    color: #dc2626;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">Install</button>
                <button id="dismissInstall" style="
                    padding: 8px 16px;
                    background: transparent;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">Later</button>
            </div>
        `;
        
        document.body.appendChild(installBanner);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInUp {
                from { transform: translate(-50%, 100px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        document.getElementById('installPWA').addEventListener('click', () => this.installPWA());
        document.getElementById('dismissInstall').addEventListener('click', () => {
            installBanner.style.animation = 'slideInUp 0.3s ease reverse';
            setTimeout(() => installBanner.remove(), 300);
        });
    }

    showIOSInstallPromotion() {
        const iosBanner = document.createElement('div');
        iosBanner.id = 'iosInstallBanner';
        iosBanner.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #007AFF, #5856D6);
            color: white;
            padding: 16px 24px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 16px;
            animation: slideInUp 0.3s ease;
            max-width: 500px;
            width: 90%;
        `;
        
        iosBanner.innerHTML = `
            <div style="font-size: 2rem;">📱</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 1rem; margin-bottom: 4px;">Add to Home Screen</div>
                <div style="font-size: 0.85rem; opacity: 0.9;">Tap Share → "Add to Home Screen"</div>
            </div>
            <button id="dismissIOS" style="
                padding: 8px 16px;
                background: transparent;
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
            ">Got it</button>
        `;
        
        document.body.appendChild(iosBanner);
        
        document.getElementById('dismissIOS').addEventListener('click', () => {
            iosBanner.style.animation = 'slideInUp 0.3s ease reverse';
            setTimeout(() => iosBanner.remove(), 300);
        });
    }

    async installPWA() {
        if (this.isIOS) {
            this.showIOSInstructions();
            return;
        }

        if (!this.deferredPrompt) {
            this.showNotification('Installation not available in this browser', 'info');
            return;
        }

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('User accepted PWA installation');
                this.showNotification('App installation started...', 'success');
            } else {
                console.log('User dismissed PWA installation');
                this.showNotification('You can install later from the menu', 'info');
            }
            
            this.deferredPrompt = null;
            document.getElementById('pwaInstallBanner')?.remove();
            
        } catch (error) {
            console.error('PWA installation failed:', error);
            this.showNotification('Installation failed. Please try again.', 'error');
        }
    }

    showIOSInstructions() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 30px;
                max-width: 400px;
                width: 100%;
                text-align: center;
                position: relative;
            ">
                <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                ">×</button>
                
                <div style="font-size: 48px; margin-bottom: 20px;">📱</div>
                <h3 style="color: #333; margin-bottom: 15px;">Install MMS Safety App</h3>
                
                <div style="text-align: left; margin: 25px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: #007AFF;
                            color: white;
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-right: 15px;
                            font-weight: bold;
                        ">1</div>
                        <div>Tap the <strong>Share</strong> button <span style="display: inline-block; padding: 2px 8px; background: #f0f0f0; border-radius: 4px; margin: 0 5px;">↑</span></div>
                    </div>
                    
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: #007AFF;
                            color: white;
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-right: 15px;
                            font-weight: bold;
                        ">2</div>
                        <div>Scroll and tap <strong>"Add to Home Screen"</strong></div>
                    </div>
                    
                    <div style="display: flex; align-items: center;">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: #007AFF;
                            color: white;
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-right: 15px;
                            font-weight: bold;
                        ">3</div>
                        <div>Tap <strong>"Add"</strong> to confirm</div>
                    </div>
                </div>
                
                <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="
                    padding: 12px 30px;
                    background: #007AFF;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                ">Got it! 👍</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showUpdateNotification() {
        const updateBanner = document.createElement('div');
        updateBanner.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInDown 0.3s ease;
            max-width: 400px;
            width: 90%;
        `;
        
        updateBanner.innerHTML = `
            <div style="font-size: 1.5rem;">🔄</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.9rem;">App Update Available</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">New version ready to install</div>
            </div>
            <button id="refreshApp" style="
                padding: 6px 12px;
                background: white;
                color: #059669;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 0.85rem;
                cursor: pointer;
            ">Update</button>
        `;
        
        document.body.appendChild(updateBanner);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInDown {
                from { transform: translate(-50%, -100px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.getElementById('refreshApp').addEventListener('click', () => {
            window.location.reload();
        });
    }

    checkForUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    updateAppStatus(status) {
        // You can update UI based on app status
        console.log('App status:', status);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
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
            display: flex;
            align-items: center;
            gap: 10px;
            animation: fadeInUp 0.3s ease;
            max-width: 400px;
            width: 90%;
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        notification.innerHTML = `${icon} ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOutDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
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
