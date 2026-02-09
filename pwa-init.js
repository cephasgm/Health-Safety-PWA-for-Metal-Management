// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone ||
                            document.referrer.includes('android-app://');
        
        console.log('%c🚀 MMS Safety PWA System', 'color: #dc2626; font-size: 16px; font-weight: bold;');
        console.log('%c📱 App Version: 1.0.0', 'color: #3b82f6;');
        console.log('%c✅ Service Worker: ' + ('serviceWorker' in navigator), 'color: #10b981;');
        console.log('%c📄 Manifest: ' + (document.querySelector('link[rel="manifest"]') ? 'Loaded' : 'Missing'), 'color: #10b981;');
        
        this.init();
    }

    init() {
        console.log('🔧 MMS Safety PWA Installer initialized');
        
        // Don't show install button if already installed
        if (this.isStandalone) {
            console.log('✅ Already installed in standalone mode');
            this.updateAppStatus('installed');
            this.updatePWAStatusCard('installed');
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Show install promotion after 5 seconds delay
            setTimeout(() => {
                this.showInstallPromotion();
            }, 5000);
        });

        // Check if app was installed
        window.addEventListener('appinstalled', () => {
            console.log('🎉 MMS Safety App was installed');
            this.deferredPrompt = null;
            this.updateAppStatus('installed');
            this.updatePWAStatusCard('installed');
            this.showNotification('MMS Safety App installed successfully! 🎉', 'success');
        });

        // Check for service worker updates
        this.checkForUpdates();
        
        // Register service worker
        this.registerServiceWorker();
        
        // Show iOS install promotion after delay
        setTimeout(() => {
            if (!this.isStandalone && this.isIOS) {
                this.showIOSInstallPromotion();
            }
        }, 7000);
        
        // Check PWA requirements
        this.checkPWARequirements();
        
        // Update PWA status card
        this.updatePWAStatusCard('checking');
        
        console.log('🎉 PWA System initialized successfully');
    }

    checkPWARequirements() {
        const requirements = {
            https: window.location.protocol === 'https:',
            serviceWorker: 'serviceWorker' in navigator,
            manifest: document.querySelector('link[rel="manifest"]') !== null,
            installPrompt: 'onbeforeinstallprompt' in window,
            standalone: this.isStandalone,
            ios: this.isIOS,
            android: this.isAndroid
        };

        console.log('📋 PWA Requirements:', requirements);
        
        // Check each requirement
        const passed = Object.values(requirements).filter(v => v === true).length;
        const total = Object.keys(requirements).length;
        
        console.log(`✅ ${passed}/${total} requirements met`);
        
        return requirements;
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('✅ Service Worker registered successfully');
                console.log('Scope:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('⚡ Service Worker update found:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
    }

    showInstallPromotion() {
        // Don't show if already showing or if installed
        if (document.getElementById('pwaInstallBanner') || this.isStandalone) {
            return;
        }
        
        console.log('📢 Showing install promotion banner');
        
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
            animation: slideInUp 0.5s ease;
            max-width: 500px;
            width: 90%;
            border: 2px solid rgba(255,255,255,0.2);
        `;
        
        installBanner.innerHTML = `
            <div style="font-size: 2rem; animation: bounce 2s infinite;">📱</div>
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
                    transition: all 0.3s ease;
                ">Install</button>
                <button id="dismissInstall" style="
                    padding: 8px 16px;
                    background: transparent;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Later</button>
            </div>
        `;
        
        document.body.appendChild(installBanner);
        
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
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
        `;
        document.head.appendChild(style);
        
        // Add event listeners
        document.getElementById('installPWA').addEventListener('click', () => this.installPWA());
        document.getElementById('dismissInstall').addEventListener('click', () => {
            installBanner.style.animation = 'slideOutDown 0.3s ease forwards';
            setTimeout(() => installBanner.remove(), 300);
        });
        
        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (installBanner.parentNode) {
                installBanner.style.animation = 'slideOutDown 0.3s ease forwards';
                setTimeout(() => installBanner.remove(), 300);
            }
        }, 30000);
    }

    showIOSInstallPromotion() {
        if (document.getElementById('iosInstallBanner') || this.isStandalone) {
            return;
        }
        
        console.log('📱 Showing iOS install promotion');
        
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
            animation: slideInUp 0.5s ease;
            max-width: 500px;
            width: 90%;
            border: 2px solid rgba(255,255,255,0.2);
        `;
        
        iosBanner.innerHTML = `
            <div style="font-size: 2rem; animation: pulse 2s infinite;">📱</div>
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
                transition: all 0.3s ease;
            ">Got it</button>
        `;
        
        document.body.appendChild(iosBanner);
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        document.getElementById('dismissIOS').addEventListener('click', () => {
            iosBanner.style.animation = 'slideOutDown 0.3s ease forwards';
            setTimeout(() => iosBanner.remove(), 300);
        });
        
        // Auto-dismiss after 30 seconds
        setTimeout(() => {
            if (iosBanner.parentNode) {
                iosBanner.style.animation = 'slideOutDown 0.3s ease forwards';
                setTimeout(() => iosBanner.remove(), 300);
            }
        }, 30000);
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
                console.log('✅ User accepted PWA installation');
                this.showNotification('App installation started...', 'success');
            } else {
                console.log('❌ User dismissed PWA installation');
                this.showNotification('You can install later from the menu', 'info');
            }
            
            this.deferredPrompt = null;
            document.getElementById('pwaInstallBanner')?.remove();
            
        } catch (error) {
            console.error('❌ PWA installation failed:', error);
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
            background: rgba(0,0,0,0.9);
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
                border: 3px solid #007AFF;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                ">×</button>
                
                <div style="font-size: 48px; margin-bottom: 20px; animation: bounce 2s infinite;">📱</div>
                <h3 style="color: #333; margin-bottom: 15px; font-weight: 700;">Install MMS Safety App</h3>
                
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
                            font-size: 1.2rem;
                        ">1</div>
                        <div style="font-size: 0.95rem;">Tap the <strong style="color: #007AFF;">Share</strong> button <span style="display: inline-block; padding: 2px 8px; background: #f0f0f0; border-radius: 4px; margin: 0 5px; font-weight: bold;">↑</span></div>
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
                            font-size: 1.2rem;
                        ">2</div>
                        <div style="font-size: 0.95rem;">Scroll and tap <strong style="color: #007AFF;">"Add to Home Screen"</strong></div>
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
                            font-size: 1.2rem;
                        ">3</div>
                        <div style="font-size: 0.95rem;">Tap <strong style="color: #007AFF;">"Add"</strong> to confirm</div>
                    </div>
                </div>
                
                <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="
                    padding: 12px 30px;
                    background: linear-gradient(135deg, #007AFF, #5856D6);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s ease;
                ">Got it! 👍</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add hover effects
        const buttons = modal.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
        });
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
            animation: slideInDown 0.5s ease;
            max-width: 400px;
            width: 90%;
            border: 2px solid rgba(255,255,255,0.2);
        `;
        
        updateBanner.innerHTML = `
            <div style="font-size: 1.5rem; animation: spin 1s linear infinite;">🔄</div>
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
                transition: all 0.3s ease;
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
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
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
        console.log('📱 App status:', status);
        // Update UI based on app status
        const installBtn = document.getElementById('installBtn');
        const sidebarInstallBtn = document.getElementById('sidebarInstallBtn');
        
        if (status === 'installed') {
            if (installBtn) installBtn.style.display = 'none';
            if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
        } else {
            if (installBtn) installBtn.style.display = 'inline-flex';
            if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'block';
        }
    }

    updatePWAStatusCard(status) {
        // Find or create PWA status card
        let statusCard = document.getElementById('pwaStatusCard');
        if (!statusCard) return;
        
        const statusIcon = document.getElementById('pwaStatusIcon');
        const statusText = document.getElementById('pwaStatusText');
        const statusDetails = document.getElementById('pwaStatusDetails');
        
        if (!statusIcon || !statusText || !statusDetails) return;
        
        switch(status) {
            case 'installed':
                statusIcon.textContent = '✅';
                statusText.textContent = 'Installed';
                statusDetails.innerHTML = `
                    <div>App is installed as PWA</div>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #10b981;">
                        Running in standalone mode
                    </div>
                `;
                break;
                
            case 'available':
                statusIcon.textContent = '📱';
                statusText.textContent = 'Install Available';
                statusDetails.innerHTML = `
                    <div>Ready to install</div>
                    <button class="btn btn-sm btn-primary" onclick="window.pwaInstaller?.installPWA()" 
                            style="margin-top: 0.5rem; width: 100%; padding: 0.5rem; font-size: 0.85rem;">
                        📱 Install App
                    </button>
                `;
                break;
                
            case 'checking':
            default:
                statusIcon.textContent = '⏳';
                statusText.textContent = 'Checking...';
                statusDetails.innerHTML = `
                    <div>Checking PWA status...</div>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #6b7280;">
                        Please wait
                    </div>
                `;
                
                // Update after checking
                setTimeout(() => {
                    if (this.isStandalone) {
                        this.updatePWAStatusCard('installed');
                    } else if (this.deferredPrompt) {
                        this.updatePWAStatusCard('available');
                    } else {
                        this.updatePWAStatusCard('checking');
                    }
                }, 1000);
                break;
        }
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
            border: 2px solid rgba(255,255,255,0.2);
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        notification.innerHTML = `${icon} ${message}`;
        
        document.body.appendChild(notification);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from { transform: translate(-50%, 20px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes fadeOutDown {
                from { transform: translate(-50%, 0); opacity: 1; }
                to { transform: translate(-50%, 20px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOutDown 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaInstaller = new PWAInstaller();
        console.log('👋 Welcome to MMS Safety PWA!');
    });
} else {
    window.pwaInstaller = new PWAInstaller();
    console.log('👋 Welcome to MMS Safety PWA!');
}
