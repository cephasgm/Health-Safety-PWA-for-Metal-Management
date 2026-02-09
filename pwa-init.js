// PWA Installation Manager for MMS Safety
(function() {
    'use strict';
    
    class PWAInstaller {
        constructor() {
            this.deferredPrompt = null;
            this.isStandalone = false;
            this.installButtons = [];
            
            this.init();
        }
        
        init() {
            // Check if app is running in standalone mode
            this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                              window.navigator.standalone === true;
            
            console.log('PWA Installer initialized. Standalone mode:', this.isStandalone);
            
            this.setupEventListeners();
            this.setupInstallButtons();
            
            // Initial check
            setTimeout(() => this.checkInstallability(), 1000);
        }
        
        setupEventListeners() {
            // Listen for beforeinstallprompt event
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('🔔 beforeinstallprompt event fired');
                e.preventDefault();
                this.deferredPrompt = e;
                this.showInstallButtons();
                
                // Show a gentle prompt after a delay
                setTimeout(() => {
                    if (this.deferredPrompt && !this.isStandalone) {
                        this.showInstallPrompt();
                    }
                }, 3000);
            });
            
            // Listen for appinstalled event
            window.addEventListener('appinstalled', (e) => {
                console.log('✅ PWA was installed successfully');
                this.deferredPrompt = null;
                this.hideInstallButtons();
                this.showToast('App installed successfully! 🎉', 'success');
            });
            
            // Check if app is already installed
            window.addEventListener('load', () => {
                if (this.isStandalone) {
                    console.log('📱 App is running in standalone mode');
                    this.hideInstallButtons();
                }
            });
        }
        
        setupInstallButtons() {
            const headerBtn = document.getElementById('installBtn');
            const sidebarBtn = document.getElementById('sidebarInstallBtn');
            
            this.installButtons = [headerBtn, sidebarBtn].filter(btn => btn !== null);
            
            // Add click handlers to all install buttons
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', () => this.installPWA());
                    console.log('Install button found:', btn.id);
                }
            });
        }
        
        showInstallButtons() {
            console.log('Showing install buttons...');
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.style.display = 'inline-flex';
                    btn.style.animation = 'fadeIn 0.5s ease-in-out';
                }
            });
            
            // Add CSS animation
            if (!document.getElementById('install-animation')) {
                const style = document.createElement('style');
                style.id = 'install-animation';
                style.textContent = `
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        hideInstallButtons() {
            console.log('Hiding install buttons...');
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.style.display = 'none';
                }
            });
        }
        
        async installPWA() {
            if (!this.deferredPrompt) {
                console.log('Installation prompt not available');
                this.showToast('Installation is not available at this time.', 'info');
                return;
            }
            
            try {
                console.log('Showing installation prompt...');
                this.showToast('Opening installation dialog...', 'info', 2000);
                
                // Show the browser's install prompt
                this.deferredPrompt.prompt();
                
                // Wait for the user to respond
                const choiceResult = await this.deferredPrompt.userChoice;
                
                console.log('User choice result:', choiceResult.outcome);
                
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ User accepted installation');
                    this.showToast('Installation started! 🚀', 'success', 3000);
                } else {
                    console.log('❌ User dismissed installation');
                    this.showToast('Installation cancelled. You can install later from the menu.', 'warning', 3000);
                }
                
                // Clear the deferredPrompt
                this.deferredPrompt = null;
                
                // Hide buttons after a delay
                setTimeout(() => this.hideInstallButtons(), 3000);
                
            } catch (error) {
                console.error('Installation error:', error);
                this.showToast('Installation failed: ' + error.message, 'error');
            }
        }
        
        showInstallPrompt() {
            if (!this.deferredPrompt || this.isStandalone) {
                return;
            }
            
            // Create a custom install prompt
            const promptHtml = `
                <div class="install-prompt-overlay">
                    <div class="install-prompt">
                        <div class="install-icon">📱</div>
                        <h3>Install MMS Safety App</h3>
                        <p>Install for quick access and offline use</p>
                        <div class="prompt-buttons">
                            <button class="btn btn-primary" id="prompt-install">Install Now</button>
                            <button class="btn btn-outline" id="prompt-later">Maybe Later</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Check if prompt already exists
            if (!document.querySelector('.install-prompt-overlay')) {
                const promptDiv = document.createElement('div');
                promptDiv.innerHTML = promptHtml;
                document.body.appendChild(promptDiv);
                
                // Add styles
                const style = document.createElement('style');
                style.textContent = `
                    .install-prompt-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                        animation: fadeIn 0.3s ease-out;
                    }
                    
                    .install-prompt {
                        background: white;
                        border-radius: 12px;
                        padding: 2rem;
                        max-width: 400px;
                        width: 90%;
                        text-align: center;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                        animation: slideUp 0.4s ease-out;
                    }
                    
                    .install-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    
                    .install-prompt h3 {
                        margin: 0 0 0.5rem 0;
                        color: var(--primary, #dc2626);
                    }
                    
                    .install-prompt p {
                        color: var(--text-light, #64748b);
                        margin-bottom: 1.5rem;
                    }
                    
                    .prompt-buttons {
                        display: flex;
                        gap: 1rem;
                        justify-content: center;
                    }
                    
                    @keyframes slideUp {
                        from { transform: translateY(30px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
                
                // Add event listeners
                document.getElementById('prompt-install').addEventListener('click', () => {
                    this.installPWA();
                    promptDiv.remove();
                });
                
                document.getElementById('prompt-later').addEventListener('click', () => {
                    promptDiv.remove();
                    this.showToast('You can install from the menu anytime.', 'info', 3000);
                });
            }
        }
        
        checkInstallability() {
            // Basic check for PWA support
            const isPwaSupported = 'BeforeInstallPromptEvent' in window;
            const isSecure = window.location.protocol === 'https:';
            const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
            
            console.log('PWA Support Check:', {
                isPwaSupported,
                isSecure,
                hasManifest,
                isStandalone: this.isStandalone
            });
            
            if (!isSecure) {
                console.warn('⚠️ PWA requires HTTPS for installation');
            }
            
            if (!hasManifest) {
                console.warn('⚠️ Manifest not found');
            }
            
            // If already installed or not supported, hide buttons
            if (this.isStandalone || !isPwaSupported) {
                this.hideInstallButtons();
            }
        }
        
        showToast(message, type = 'info', duration = 3000) {
            // Use existing toast if available
            const existingToast = document.getElementById('pwa-toast');
            if (existingToast) {
                existingToast.remove();
            }
            
            const toast = document.createElement('div');
            toast.id = 'pwa-toast';
            toast.className = `pwa-toast pwa-toast-${type}`;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: var(--surface, white);
                border: 1px solid var(--border, #e2e8f0);
                border-left: 4px solid ${this.getColorForType(type)};
                border-radius: 8px;
                padding: 1rem;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                gap: 0.75rem;
                z-index: 9998;
                opacity: 0;
                transition: all 0.3s ease;
                max-width: 400px;
                width: 90%;
            `;
            
            const icon = document.createElement('div');
            icon.textContent = this.getIconForType(type);
            icon.style.fontSize = '1.25rem';
            
            const messageEl = document.createElement('div');
            messageEl.textContent = message;
            messageEl.style.flex = '1';
            messageEl.style.fontSize = '0.875rem';
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: var(--text-light, #64748b);
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
            toast.appendChild(messageEl);
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
    
    // Initialize Service Worker
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                const swUrl = './sw.js';
                
                navigator.serviceWorker.register(swUrl)
                    .then(function(registration) {
                        console.log('✅ Service Worker registered with scope:', registration.scope);
                        
                        // Check for updates
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('🔄 New service worker found:', newWorker);
                            
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('📦 New content is available; please refresh.');
                                    // Show update toast
                                    if (window.pwaInstaller) {
                                        window.pwaInstaller.showToast(
                                            'New version available! Refresh to update. 🔄',
                                            'info',
                                            5000,
                                            () => location.reload()
                                        );
                                    }
                                }
                            });
                        });
                    })
                    .catch(function(error) {
                        console.error('❌ Service Worker registration failed:', error);
                    });
            });
        } else {
            console.log('⚠️ Service Worker not supported');
        }
    }
    
    // Monitor online/offline status
    function initConnectionMonitor() {
        window.addEventListener('online', () => {
            console.log('🌐 App is online');
            if (window.pwaInstaller) {
                window.pwaInstaller.showToast('Back online! ✅', 'success', 2000);
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('📴 App is offline');
            if (window.pwaInstaller) {
                window.pwaInstaller.showToast('You are offline. Some features may not work. ⚠️', 'warning', 4000);
            }
        });
        
        // Initial status
        if (!navigator.onLine) {
            console.log('📴 App started offline');
            setTimeout(() => {
                if (window.pwaInstaller) {
                    window.pwaInstaller.showToast('App started offline. Using cached data. 📱', 'info', 3000);
                }
            }, 1000);
        }
    }
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Initializing PWA...');
        
        // Initialize PWA Installer
        window.pwaInstaller = new PWAInstaller();
        
        // Initialize Service Worker
        initServiceWorker();
        
        // Initialize Connection Monitor
        initConnectionMonitor();
        
        console.log('🎯 PWA initialization complete');
    });
    
})();
