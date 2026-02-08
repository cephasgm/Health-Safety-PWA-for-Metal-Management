// PWA Installation Handler for MMS Safety Dashboard
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        this.init();
    }

    init() {
        console.log('MMS Safety PWA Installer initialized');
        
        // Don't show install button if already installed
        if (this.isStandalone) {
            console.log('Already installed in standalone mode');
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Check if app was installed
        window.addEventListener('appinstalled', () => {
            console.log('MMS Safety App was installed');
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.showToast('MMS Safety App installed successfully! 🎉', 'success');
        });

        // Register service worker
        this.registerServiceWorker();
        
        // Set up install button click
        this.setupInstallButtons();
    }

    setupInstallButtons() {
        const headerBtn = document.getElementById('installBtn');
        const sidebarBtn = document.getElementById('sidebarInstallBtn');
        
        if (headerBtn) {
            headerBtn.addEventListener('click', () => this.installPWA());
        }
        if (sidebarBtn) {
            sidebarBtn.addEventListener('click', () => this.installPWA());
        }
    }

    showInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
            installBtn.style.animation = 'pulse 2s infinite';
        }
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    async installPWA() {
        if (this.isIOS) {
            this.showIOSInstructions();
            return;
        }

        if (!this.deferredPrompt) {
            this.showToast('Installation prompt not available. Try using Chrome or Edge.', 'info');
            return;
        }

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            this.deferredPrompt = null;
            
            if (outcome === 'accepted') {
                console.log('User accepted PWA installation');
                this.hideInstallButton();
            } else {
                console.log('User dismissed PWA installation');
                this.showToast('You can install later using the Install button', 'info');
            }
        } catch (error) {
            console.error('PWA installation failed:', error);
            this.showToast('Installation failed. Please try again.', 'error');
        }
    }

    showIOSInstructions() {
        const instructions = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 2rem;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                z-index: 10000;
                width: 90%;
                max-width: 450px;
                text-align: center;
                border: 3px solid #1a3568;
            ">
                <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">📱</div>
                <h3 style="color: #1a3568; margin-bottom: 1rem; font-weight: 800;">Install MMS Safety App</h3>
                <p style="margin-bottom: 1.5rem; color: #2c3e50; line-height: 1.6;">To install on your iOS device:</p>
                <ol style="text-align: left; margin-bottom: 2rem; padding-left: 1.5rem; color: #2c3e50;">
                    <li style="margin-bottom: 1rem; padding-left: 0.5rem; line-height: 1.5;">Tap the <strong style="color: #1a3568;">Share</strong> button <span style="display: inline-block; width: 28px; height: 28px; background: #1a3568; color: white; border-radius: 6px; text-align: center; line-height: 28px; margin: 0 6px; font-weight: bold;">↑</span> at the bottom of Safari</li>
                    <li style="margin-bottom: 1rem; padding-left: 0.5rem; line-height: 1.5;">Scroll down and tap <strong style="color: #1a3568;">"Add to Home Screen"</strong></li>
                    <li style="margin-bottom: 1rem; padding-left: 0.5rem; line-height: 1.5;">Tap <strong style="color: #1a3568;">"Add"</strong> in the top right corner</li>
                </ol>
                <button onclick="this.parentElement.remove(); document.getElementById('iosOverlay')?.remove();" style="
                    padding: 1rem 2rem;
                    background: linear-gradient(135deg, #1a3568, #2d5aa0);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 1rem;
                    width: 100%;
                ">Got it! 👍</button>
            </div>
        `;
        
        const overlay = document.createElement('div');
        overlay.id = 'iosOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;
        overlay.onclick = () => {
            overlay.remove();
            document.querySelector('#iosOverlay + div')?.remove();
        };
        
        document.body.appendChild(overlay);
        
        const div = document.createElement('div');
        div.innerHTML = instructions;
        document.body.appendChild(div);
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    showToast(message, type = 'info') {
        // Use existing toast system if available
        if (typeof window.showToast === 'function') {
            window.showToast(type === 'success' ? 'Success' : 'Info', message, type);
            return;
        }
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
            color: white;
            padding: 1.2rem 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            animation: slideIn 0.3s ease;
            font-weight: 600;
            min-width: 300px;
            text-align: center;
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        toast.innerHTML = `${icon} ${message}`;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not in iframe
    if (window.self === window.top) {
        window.pwaInstaller = new PWAInstaller();
    }
});
