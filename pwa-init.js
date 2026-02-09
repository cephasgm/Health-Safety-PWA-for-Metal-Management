// PWA Installation Manager for MMS Safety
(function() {
    'use strict';
    
    console.log('🔧 PWA Installer loading...');
    
    class PWAInstaller {
        constructor() {
            this.deferredPrompt = null;
            this.isStandalone = false;
            this.installButtons = [];
            this.isInstalled = false;
            
            this.init();
        }
        
        init() {
            console.log('🚀 PWA Installer initializing...');
            
            // Check installation status
            this.checkInstallStatus();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup install buttons
            this.setupInstallButtons();
            
            // Initial check after delay
            setTimeout(() => {
                this.checkPWARequirements();
                this.checkInstallability();
            }, 2000);
        }
        
        checkInstallStatus() {
            // Check if app is running in standalone mode
            this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            
            // Check for iOS standalone
            if (window.navigator.standalone === true) {
                this.isStandalone = true;
            }
            
            // Check URL for standalone mode
            if (window.location.search.includes('source=pwa') || 
                document.referrer.includes('android-app://')) {
                this.isStandalone = true;
            }
            
            console.log('📱 Installation status:', {
                isStandalone: this.isStandalone,
                displayMode: this.getDisplayMode(),
                referrer: document.referrer
            });
        }
        
        getDisplayMode() {
            if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
            if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
            if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
            return 'browser';
        }
        
        setupEventListeners() {
            console.log('🔔 Setting up PWA event listeners...');
            
            // 1. BEFORE INSTALL PROMPT (Chrome/Edge)
            window.addEventListener('beforeinstallprompt', (e) => {
                console.log('🎉 beforeinstallprompt event fired!');
                e.preventDefault();
                this.deferredPrompt = e;
                this.showInstallButtons();
                
                // Show custom prompt after delay
                setTimeout(() => {
                    if (this.deferredPrompt && !this.isStandalone) {
                        this.showInstallPrompt();
                    }
                }, 3000);
            });
            
            // 2. APP INSTALLED (Chrome/Edge)
            window.addEventListener('appinstalled', (e) => {
                console.log('✅ PWA was installed successfully!');
                this.isInstalled = true;
                this.deferredPrompt = null;
                this.hideInstallButtons();
                this.showToast('App installed successfully! 🎉', 'success');
                
                // Track installation
                this.trackInstallation();
            });
            
            // 3. PAGE VISIBILITY
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.checkInstallStatus();
                }
            });
            
            // 4. ONLINE/OFFLINE
            window.addEventListener('online', () => {
                console.log('🌐 App is online');
                this.showToast('Back online! ✅', 'success', 2000);
            });
            
            window.addEventListener('offline', () => {
                console.log('📴 App is offline');
                this.showToast('You are offline. Some features may not work. ⚠️', 'warning', 4000);
            });
        }
        
        setupInstallButtons() {
            console.log('🔄 Setting up install buttons...');
            
            const headerBtn = document.getElementById('installBtn');
            const sidebarBtn = document.getElementById('sidebarInstallBtn');
            
            this.installButtons = [headerBtn, sidebarBtn].filter(btn => btn !== null);
            
            console.log('📌 Found buttons:', this.installButtons.length);
            
            // Add click handlers
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.installPWA();
                    });
                }
            });
            
            // Show/hide based on initial state
            if (this.isStandalone) {
                this.hideInstallButtons();
            }
        }
        
        showInstallButtons() {
            console.log('👁️ Showing install buttons...');
            
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.style.display = 'inline-flex';
                    btn.style.opacity = '0';
                    btn.style.transform = 'translateY(10px)';
                    btn.style.transition = 'all 0.3s ease';
                    
                    // Animate in
                    setTimeout(() => {
                        btn.style.opacity = '1';
                        btn.style.transform = 'translateY(0)';
                    }, 100);
                }
            });
            
            // Add install badge
            this.addInstallBadge();
        }
        
        hideInstallButtons() {
            console.log('👻 Hiding install buttons...');
            
            this.installButtons.forEach(btn => {
                if (btn) {
                    btn.style.display = 'none';
                }
            });
        }
        
        addInstallBadge() {
            // Add a badge to indicate installability
            if (!document.getElementById('install-badge')) {
                const badge = document.createElement('div');
                badge.id = 'install-badge';
                badge.innerHTML = '📱 Installable';
                badge.style.cssText = `
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    background: #10b981;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: bold;
                    z-index: 9999;
                    animation: pulse 2s infinite;
                `;
                
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                `;
                
                document.head.appendChild(style);
                document.body.appendChild(badge);
                
                // Remove after 10 seconds
                setTimeout(() => {
                    if (badge.parentNode) {
                        badge.parentNode.removeChild(badge);
                    }
                }, 10000);
            }
        }
        
        async installPWA() {
            console.log('🔄 Starting installation process...');
            
            // Method 1: Use deferred prompt (Chrome/Edge)
            if (this.deferredPrompt) {
                try {
                    console.log('📱 Using native install prompt...');
                    this.showToast('Opening installation...', 'info', 2000);
                    
                    this.deferredPrompt.prompt();
                    
                    const choiceResult = await this.deferredPrompt.userChoice;
                    
                    console.log('User choice:', choiceResult.outcome);
                    
                    if (choiceResult.outcome === 'accepted') {
                        console.log('✅ User accepted installation');
                        this.showToast('Installation started! 🚀', 'success', 3000);
                    } else {
                        console.log('❌ User dismissed installation');
                        this.showToast('Installation cancelled.', 'warning', 3000);
                    }
                    
                    this.deferredPrompt = null;
                    return;
                    
                } catch (error) {
                    console.error('Native install error:', error);
                }
            }
            
            // Method 2: Manual installation instructions
            this.showManualInstallGuide();
        }
        
        showManualInstallGuide() {
            console.log('📖 Showing manual install guide...');
            
            const guide = `
                <div class="install-guide-overlay">
                    <div class="install-guide">
                        <button class="close-guide">×</button>
                        <h3>📱 Install MMS Safety App</h3>
                        
                        <div class="platform-instructions">
                            <!-- Chrome/Edge -->
                            <div class="platform">
                                <h4>Chrome / Edge (Desktop)</h4>
                                <p>Click <strong>Install</strong> button in address bar</p>
                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMWY1ZjkiLz4KICA8dGV4dCB4PSIxMDAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzY0NzQ4YiI+QWRkIHRvIERlc2t0b3A8L3RleHQ+Cjwvc3ZnPg==" alt="Chrome Install">
                            </div>
                            
                            <!-- Safari iOS -->
                            <div class="platform">
                                <h4>Safari (iPhone/iPad)</h4>
                                <p>Tap <strong>Share → Add to Home Screen</strong></p>
                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMWY1ZjkiLz4KICA8dGV4dCB4PSIxMDAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzY0NzQ4YiI+QWRkIHRvIEhvbWUgU2NyZWVuPC90ZXh0Pgo8L3N2Zz4=" alt="iOS Install">
                            </div>
                            
                            <!-- Chrome Android -->
                            <div class="platform">
                                <h4>Chrome (Android)</h4>
                                <p>Tap <strong>Menu → Install App</strong></p>
                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMWY1ZjkiLz4KICA8dGV4dCB4PSIxMDAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzY0NzQ4YiI+SW5zdGFsbCBBcHA8L3RleHQ+Cjwvc3ZnPg==" alt="Android Install">
                            </div>
                        </div>
                        
                        <div class="guide-footer">
                            <p><small>Once installed, the app will work offline and launch like a native app.</small></p>
                        </div>
                    </div>
                </div>
            `;
            
            if (!document.querySelector('.install-guide-overlay')) {
                const guideDiv = document.createElement('div');
                guideDiv.innerHTML = guide;
                document.body.appendChild(guideDiv);
                
                // Add styles
                const style = document.createElement('style');
                style.textContent = `
                    .install-guide-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        animation: fadeIn 0.3s ease;
                    }
                    
                    .install-guide {
                        background: white;
                        border-radius: 16px;
                        padding: 2rem;
                        max-width: 500px;
                        width: 90%;
                        max-height: 80vh;
                        overflow-y: auto;
                        position: relative;
                        animation: slideUp 0.4s ease;
                    }
                    
                    .close-guide {
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #64748b;
                    }
                    
                    .install-guide h3 {
                        color: #dc2626;
                        margin-bottom: 1.5rem;
                        text-align: center;
                    }
                    
                    .platform-instructions {
                        display: grid;
                        gap: 1.5rem;
                        margin: 2rem 0;
                    }
                    
                    .platform {
                        background: #f8fafc;
                        border-radius: 8px;
                        padding: 1rem;
                        border: 1px solid #e2e8f0;
                    }
                    
                    .platform h4 {
                        margin: 0 0 0.5rem 0;
                        color: #1e293b;
                    }
                    
                    .platform p {
                        margin: 0.5rem 0;
                        color: #64748b;
                    }
                    
                    .platform img {
                        width: 100%;
                        height: 60px;
                        background: #f1f5f9;
                        border-radius: 4px;
                        margin-top: 0.5rem;
                    }
                    
                    .guide-footer {
                        text-align: center;
                        margin-top: 1.5rem;
                        padding-top: 1rem;
                        border-top: 1px solid #e2e8f0;
                        color: #64748b;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    @keyframes slideUp {
                        from { transform: translateY(30px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
                
                // Close button
                guideDiv.querySelector('.close-guide').addEventListener('click', () => {
                    guideDiv.remove();
                });
                
                // Close on overlay click
                guideDiv.querySelector('.install-guide-overlay').addEventListener('click', (e) => {
                    if (e.target === e.currentTarget) {
                        guideDiv.remove();
                    }
                });
            }
        }
        
        showInstallPrompt() {
            if (this.isStandalone || !this.deferredPrompt) return;
            
            console.log('💡 Showing install prompt...');
            
            this.showToast(
                'Install MMS Safety for quick access! 📱',
                'info',
                5000,
                () => this.installPWA()
            );
        }
        
        checkPWARequirements() {
            console.log('📋 Checking PWA requirements...');
            
            const checks = {
                https: window.location.protocol === 'https:',
                manifest: document.querySelector('link[rel="manifest"]') !== null,
                serviceWorker: 'serviceWorker' in navigator,
                beforeInstallPrompt: 'BeforeInstallPromptEvent' in window
            };
            
            console.log('PWA Requirements:', checks);
            
            if (!checks.https) {
                console.warn('⚠️ PWA requires HTTPS for installation');
            }
            
            if (!checks.manifest) {
                console.warn('⚠️ Web app manifest not found');
            }
            
            return checks;
        }
        
        checkInstallability() {
            console.log('🔍 Checking installability...');
            
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobile = /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
            const isIOS = /iphone|ipad|ipod/.test(userAgent);
            const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
            const isEdge = /edg/.test(userAgent);
            const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
            
            const installInfo = {
                isMobile,
                isIOS,
                isChrome,
                isEdge,
                isSafari,
                userAgent: navigator.userAgent.substring(0, 100)
            };
            
            console.log('Device/Browser Info:', installInfo);
            
            // Show manual install button on iOS/Safari
            if (isIOS || isSafari) {
                console.log('📱 iOS/Safari detected - showing manual install');
                setTimeout(() => {
                    if (!this.isStandalone) {
                        this.showInstallButtons();
                    }
                }, 3000);
            }
        }
        
        trackInstallation() {
            // Track installation in localStorage
            localStorage.setItem('mms-pwa-installed', new Date().toISOString());
            
            // Send analytics (in production)
            console.log('📊 Installation tracked');
        }
        
        showToast(message, type = 'info', duration = 3000, action = null) {
            const toast = document.createElement('div');
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
                z-index: 9999;
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
            
            toast.appendChild(icon);
            toast.appendChild(messageEl);
            
            if (action) {
                const actionBtn = document.createElement('button');
                actionBtn.textContent = 'Install';
                actionBtn.style.cssText = `
                    margin-left: 10px;
                    padding: 4px 12px;
                    background: var(--primary, #dc2626);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.75rem;
                `;
                actionBtn.onclick = action;
                toast.appendChild(actionBtn);
            }
            
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
            closeBtn.onclick = () => this.removeToast(toast);
            toast.appendChild(closeBtn);
            
            document.body.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            }, 100);
            
            // Auto remove
            if (duration > 0) {
                setTimeout(() => this.removeToast(toast), duration);
            }
        }
        
        removeToast(toast) {
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
            console.log('🔧 Service Worker supported, registering...');
            
            window.addEventListener('load', function() {
                const swUrl = './sw.js';
                
                navigator.serviceWorker.register(swUrl)
                    .then(function(registration) {
                        console.log('✅ Service Worker registered successfully');
                        console.log('Scope:', registration.scope);
                        
                        // Check for updates
                        if (registration.waiting) {
                            console.log('🔄 Service Worker update waiting');
                        }
                        
                        if (registration.installing) {
                            console.log('📦 Service Worker installing');
                        }
                        
                        if (registration.active) {
                            console.log('⚡ Service Worker active');
                        }
                        
                        // Listen for updates
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('🔄 New Service Worker found:', newWorker.state);
                            
                            newWorker.addEventListener('statechange', () => {
                                console.log('🔄 Service Worker state changed:', newWorker.state);
                                
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('📦 New content available');
                                    
                                    // Show update notification
                                    if (window.pwaInstaller) {
                                        window.pwaInstaller.showToast(
                                            'Update available! Refresh to get the latest version. 🔄',
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
            console.log('⚠️ Service Worker not supported in this browser');
        }
    }
    
    // Initialize everything when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🏁 DOM ready, starting PWA initialization...');
        
        // Initialize PWA Installer
        window.pwaInstaller = new PWAInstaller();
        
        // Initialize Service Worker
        initServiceWorker();
        
        console.log('🎉 PWA System initialized successfully');
        
        // Show welcome message
        setTimeout(() => {
            if (window.pwaInstaller && !window.pwaInstaller.isStandalone) {
                console.log('👋 Welcome to MMS Safety PWA!');
            }
        }, 1000);
    });
    
    // Export for debugging
    window.debugPWA = function() {
        return {
            installer: window.pwaInstaller,
            checks: window.pwaInstaller ? window.pwaInstaller.checkPWARequirements() : null,
            isStandalone: window.pwaInstaller ? window.pwaInstaller.isStandalone : false
        };
    };
    
})();
