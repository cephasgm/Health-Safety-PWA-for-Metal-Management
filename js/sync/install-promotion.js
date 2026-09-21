// Enhanced PWA Install Promotion System - MMS Safety
// Smart install prompts based on user behavior and platform

class EnhancedInstallPromotion {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone;
        this.visitCount = parseInt(localStorage.getItem('mms_visit_count') || '0');
        this.installDismissed = localStorage.getItem('mms_install_dismissed') === 'true';
        this.installShownCount = parseInt(localStorage.getItem('mms_install_shown') || '0');
        this.lastInstallPrompt = localStorage.getItem('mms_last_install_prompt');
        
        this.installTriggers = {
            visits: 3,           // Show after 3 visits
            timeOnSite: 30000,   // 30 seconds on site
            interactions: 5,     // 5 interactions
            reportsMade: 1       // After first incident report
        };
        
        this.init();
    }

    init() {
        console.log('🎯 Enhanced Install Promotion Initializing...');
        
        // Track visits
        this.trackVisit();
        
        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Track platform for analytics
            this.trackPlatform();
            
            // Show smart promotion (delayed based on behavior)
            this.scheduleSmartPromotion();
        });

        // Track if app was installed
        window.addEventListener('appinstalled', () => {
            console.log('🎉 MMS Safety App Installed!');
            this.trackInstallation('success');
            this.deferredPrompt = null;
            this.removeAllPromotions();
            this.showPostInstallGuide();
        });

        // Track user interactions
        this.setupInteractionTracking();
        
        // Monitor time on site
        this.startTimeTracking();
        
        // Check for existing buttons and enhance them
        this.enhanceExistingButtons();
        
        console.log('✅ Enhanced Install Promotion Ready');
    }

    trackVisit() {
        this.visitCount++;
        localStorage.setItem('mms_visit_count', this.visitCount.toString());
        localStorage.setItem('mms_last_visit', new Date().toISOString());
        
        console.log(`👤 Visit #${this.visitCount}`);
        
        // Reset dismissed flag after 7 days
        const lastDismissed = localStorage.getItem('mms_last_dismissed');
        if (lastDismissed) {
            const daysSinceDismiss = (new Date() - new Date(lastDismissed)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismiss > 7) {
                this.installDismissed = false;
                localStorage.removeItem('mms_install_dismissed');
            }
        }
    }

    trackPlatform() {
        const platform = this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop';
        console.log(`📱 Platform detected: ${platform}`);
        
        // Store for analytics
        localStorage.setItem('mms_user_platform', platform);
    }

    scheduleSmartPromotion() {
        if (this.isStandalone || this.installDismissed) {
            console.log('⚠️ Install promotion skipped: already installed or dismissed');
            return;
        }

        // Calculate delay based on user behavior
        let delay = 5000; // Default 5 seconds
        
        if (this.visitCount >= 3) {
            delay = 3000; // Faster for returning users
        }
        
        if (localStorage.getItem('mms_incident_reported')) {
            delay = 2000; // Even faster if they reported incident
        }

        console.log(`⏰ Scheduling install promotion in ${delay/1000}s`);
        
        setTimeout(() => {
            if (this.deferredPrompt && !this.isStandalone) {
                this.showSmartInstallPrompt();
            }
        }, delay);
    }

    showSmartInstallPrompt() {
        if (this.installShownCount >= 3) {
            console.log('⚠️ Install prompt shown too many times, skipping');
            return;
        }

        this.installShownCount++;
        localStorage.setItem('mms_install_shown', this.installShownCount.toString());
        localStorage.setItem('mms_last_install_prompt', new Date().toISOString());
        
        console.log(`🔄 Install prompt shown ${this.installShownCount} times`);
        
        // Choose prompt type based on platform and behavior
        if (this.isIOS) {
            this.showIOSInstallGuide();
        } else if (this.isAndroid && this.visitCount >= 2) {
            this.showAndroidNativePrompt();
        } else {
            this.showCustomInstallModal();
        }
    }

    showCustomInstallModal() {
        // Don't show if modal already exists
        if (document.getElementById('enhancedInstallModal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'enhancedInstallModal';
        modal.innerHTML = `
            <div style="
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
                animation: fadeIn 0.3s ease;
            ">
                <div style="
                    background: white;
                    border-radius: 20px;
                    padding: 2.5rem;
                    max-width: 500px;
                    width: 100%;
                    position: relative;
                    border: 3px solid #dc2626;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                ">
                    <button onclick="window.enhancedInstaller?.closeInstallModal()" style="
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        color: #64748b;
                        cursor: pointer;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                        ×
                    </button>
                    
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div style="font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite;">📱</div>
                        <h2 style="color: #1e293b; margin-bottom: 0.5rem; font-size: 1.8rem;">Install MMS Safety App</h2>
                        <p style="color: #64748b; line-height: 1.6; margin-bottom: 0.5rem;">Get quick access to safety reports from your home screen</p>
                    </div>
                    
                    <div style="
                        background: #f8fafc;
                        border-radius: 12px;
                        padding: 1.5rem;
                        margin-bottom: 2rem;
                        border: 1px solid #e2e8f0;
                    ">
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <div style="
                                width: 40px;
                                height: 40px;
                                background: #10b981;
                                color: white;
                                border-radius: 10px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                            ">⚡</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b;">Instant Access</div>
                                <div style="font-size: 0.9rem; color: #64748b;">One tap from home screen</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                            <div style="
                                width: 40px;
                                height: 40px;
                                background: #3b82f6;
                                color: white;
                                border-radius: 10px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                            ">📱</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b;">Works Offline</div>
                                <div style="font-size: 0.9rem; color: #64748b;">Report incidents without internet</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center;">
                            <div style="
                                width: 40px;
                                height: 40px;
                                background: #8b5cf6;
                                color: white;
                                border-radius: 10px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                            ">🔔</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b;">Push Notifications</div>
                                <div style="font-size: 0.9rem; color: #64748b;">Get instant safety alerts</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <button onclick="window.enhancedInstaller?.triggerInstall()" style="
                            padding: 1rem;
                            background: linear-gradient(135deg, #dc2626, #ef4444);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-size: 1.1rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 0.75rem;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(220, 38, 38, 0.4)'"
                          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            <span>📱</span>
                            Install MMS Safety App
                        </button>
                        
                        <button onclick="window.enhancedInstaller?.remindLater()" style="
                            padding: 0.875rem;
                            background: transparent;
                            color: #64748b;
                            border: 2px solid #e2e8f0;
                            border-radius: 12px;
                            font-size: 1rem;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.3s;
                        " onmouseover="this.style.borderColor='#94a3b8'; this.style.color='#475569'"
                          onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b'">
                            Remind me later
                        </button>
                    </div>
                    
                    <div style="
                        margin-top: 1.5rem;
                        text-align: center;
                        font-size: 0.85rem;
                        color: #94a3b8;
                        border-top: 1px solid #f1f5f9;
                        padding-top: 1rem;
                    ">
                        Already installed? <a href="#" onclick="window.enhancedInstaller?.hideInstallModal(); return false;" style="color: #3b82f6; text-decoration: none;">Close this message</a>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            @keyframes slideOut {
                from { transform: scale(1); opacity: 1; }
                to { transform: scale(0.9); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        // Track modal view
        this.trackEvent('install_modal_shown');
    }

    showIOSInstallGuide() {
        const modal = document.createElement('div');
        modal.id = 'iosInstallGuide';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 23, 42, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            ">
                <div style="
                    background: white;
                    border-radius: 24px;
                    padding: 2.5rem;
                    max-width: 400px;
                    width: 100%;
                    position: relative;
                    border: 3px solid #007AFF;
                    box-shadow: 0 25px 80px rgba(0,0,0,0.5);
                ">
                    <div style="text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">📱</div>
                        <h2 style="color: #1e293b; margin-bottom: 0.5rem; font-size: 1.8rem;">Add to Home Screen</h2>
                        <p style="color: #64748b; margin-bottom: 2rem;">Quick access for iPhone & iPad</p>
                    </div>
                    
                    <!-- iOS Steps -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                            <div style="
                                width: 48px;
                                height: 48px;
                                background: linear-gradient(135deg, #007AFF, #5856D6);
                                color: white;
                                border-radius: 12px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                                font-size: 1.2rem;
                                flex-shrink: 0;
                            ">1</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">Tap Share Button</div>
                                <div style="font-size: 0.95rem; color: #64748b;">Tap the <span style="
                                    display: inline-block;
                                    background: #f1f5f9;
                                    padding: 0.25rem 0.5rem;
                                    border-radius: 6px;
                                    font-weight: 600;
                                    color: #007AFF;
                                    margin: 0 0.25rem;
                                ">Share</span> icon at bottom</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                            <div style="
                                width: 48px;
                                height: 48px;
                                background: linear-gradient(135deg, #007AFF, #5856D6);
                                color: white;
                                border-radius: 12px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                                font-size: 1.2rem;
                                flex-shrink: 0;
                            ">2</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">Find "Add to Home Screen"</div>
                                <div style="font-size: 0.95rem; color: #64748b;">Scroll down in the share menu</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center;">
                            <div style="
                                width: 48px;
                                height: 48px;
                                background: linear-gradient(135deg, #007AFF, #5856D6);
                                color: white;
                                border-radius: 12px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 1rem;
                                font-weight: bold;
                                font-size: 1.2rem;
                                flex-shrink: 0;
                            ">3</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;">Tap "Add"</div>
                                <div style="font-size: 0.95rem; color: #64748b;">Confirm to add to home screen</div>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="window.enhancedInstaller?.closeIOSGuide()" style="
                        width: 100%;
                        padding: 1rem;
                        background: linear-gradient(135deg, #007AFF, #5856D6);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 1.1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(0, 122, 255, 0.4)'"
                      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        Got it! 👍
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.trackEvent('ios_guide_shown');
    }

    showAndroidNativePrompt() {
        if (this.deferredPrompt) {
            // Show native Android prompt
            this.deferredPrompt.prompt();
            
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ User accepted native install prompt');
                    this.trackInstallation('native_prompt_accepted');
                } else {
                    console.log('❌ User dismissed native prompt');
                    this.trackEvent('native_prompt_dismissed');
                    // Show custom modal as fallback
                    setTimeout(() => this.showCustomInstallModal(), 2000);
                }
                this.deferredPrompt = null;
            });
        } else {
            // Fallback to custom modal
            this.showCustomInstallModal();
        }
    }

    closeInstallModal() {
        const modal = document.getElementById('enhancedInstallModal');
        if (modal) {
            modal.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => modal.remove(), 300);
            this.trackEvent('install_modal_dismissed');
        }
    }

    closeIOSGuide() {
        const guide = document.getElementById('iosInstallGuide');
        if (guide) {
            guide.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => guide.remove(), 300);
            this.trackEvent('ios_guide_closed');
        }
    }

    triggerInstall() {
        if (this.isIOS) {
            this.closeInstallModal();
            this.showIOSInstallGuide();
        } else if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ User accepted install from modal');
                    this.trackInstallation('modal_prompt_accepted');
                } else {
                    console.log('❌ User declined install from modal');
                    this.trackEvent('modal_prompt_declined');
                }
                this.deferredPrompt = null;
            });
        } else {
            alert('Installation not available in this browser. Try Chrome or Edge.');
        }
    }

    remindLater() {
        this.installDismissed = true;
        localStorage.setItem('mms_install_dismissed', 'true');
        localStorage.setItem('mms_last_dismissed', new Date().toISOString());
        
        this.closeInstallModal();
        this.trackEvent('install_remind_later');
        
        // Show toast notification
        this.showToast('We\'ll remind you later!', 'info');
    }

    hideInstallModal() {
        this.closeInstallModal();
    }

    setupInteractionTracking() {
        // Track button clicks
        document.addEventListener('click', (e) => {
            const interactions = parseInt(localStorage.getItem('mms_interactions') || '0');
            localStorage.setItem('mms_interactions', (interactions + 1).toString());
            
            // Check if incident report button was clicked
            if (e.target.closest('[onclick*="reportIncident"]') || 
                e.target.closest('[onclick*="openModal.*report"]')) {
                localStorage.setItem('mms_incident_reported', 'true');
                console.log('📝 Incident reported - qualifying for faster install prompt');
            }
        });
        
        // Track form submissions
        document.addEventListener('submit', () => {
            const formSubmissions = parseInt(localStorage.getItem('mms_form_submissions') || '0');
            localStorage.setItem('mms_form_submissions', (formSubmissions + 1).toString());
        });
    }

    startTimeTracking() {
        let startTime = Date.now();
        
        window.addEventListener('beforeunload', () => {
            const timeSpent = Date.now() - startTime;
            const totalTime = parseInt(localStorage.getItem('mms_total_time') || '0');
            localStorage.setItem('mms_total_time', (totalTime + timeSpent).toString());
            
            console.log(`⏱️ Time spent: ${Math.round(timeSpent/1000)}s`);
        });
    }

    enhanceExistingButtons() {
        // Find existing install buttons and enhance them
        const installButtons = document.querySelectorAll('[id*="install"], [onclick*="install"]');
        
        installButtons.forEach(button => {
            if (!button.hasAttribute('data-enhanced')) {
                button.setAttribute('data-enhanced', 'true');
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.triggerInstall();
                });
                console.log('🔧 Enhanced existing install button');
            }
        });
        
        // Add install button to sidebar if not exists
        this.addSidebarInstallButton();
    }

    addSidebarInstallButton() {
        const sidebar = document.querySelector('.sidebar .nav-section');
        if (sidebar && !document.getElementById('enhancedSidebarInstall')) {
            const installItem = document.createElement('button');
            installItem.id = 'enhancedSidebarInstall';
            installItem.className = 'nav-item';
            installItem.innerHTML = `
                <span class="nav-icon">📱</span>
                Install Safety App
            `;
            installItem.onclick = () => this.triggerInstall();
            
            // Insert after first nav-section or at appropriate place
            sidebar.parentNode.insertBefore(installItem, sidebar.nextSibling);
            
            // Add a new nav-section for it
            const section = document.createElement('div');
            section.className = 'nav-section';
            section.innerHTML = '<div class="nav-title">App</div>';
            section.appendChild(installItem);
            sidebar.parentNode.insertBefore(section, sidebar.nextSibling);
        }
    }

    removeAllPromotions() {
        this.closeInstallModal();
        this.closeIOSGuide();
        
        // Hide all install buttons
        document.querySelectorAll('[id*="install"], [onclick*="install"]').forEach(btn => {
            btn.style.display = 'none';
        });
    }

    showPostInstallGuide() {
        // Show welcome guide after installation
        setTimeout(() => {
            if (this.isStandalone) {
                this.showToast('🎉 Welcome to MMS Safety App!', 'success');
                
                // Show quick tips after 5 seconds
                setTimeout(() => {
                    const tips = [
                        '💡 Tip: You can report incidents offline',
                        '💡 Tip: Enable notifications for safety alerts',
                        '💡 Tip: Use search to find safety standards'
                    ];
                    
                    const randomTip = tips[Math.floor(Math.random() * tips.length)];
                    this.showToast(randomTip, 'info', 5000);
                }, 5000);
            }
        }, 1000);
    }

    showToast(message, type = 'info', duration = 3000) {
        // Remove existing toast
        const existing = document.getElementById('enhancedToast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.id = 'enhancedToast';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 9999;
            max-width: 400px;
            width: 90%;
            text-align: center;
            animation: slideUp 0.3s ease;
            font-weight: 500;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Auto-remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideDown 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
        
        // Add animations
        if (!document.getElementById('toastAnimations')) {
            const style = document.createElement('style');
            style.id = 'toastAnimations';
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translate(-50%, 20px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                @keyframes slideDown {
                    from { transform: translate(-50%, 0); opacity: 1; }
                    to { transform: translate(-50%, 20px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    trackEvent(eventName, data = {}) {
        console.log(`📊 Event: ${eventName}`, data);
        
        // Send to analytics if available
        if (window.gtag) {
            window.gtag('event', eventName, {
                event_category: 'pwa_installation',
                event_label: this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop',
                ...data
            });
        }
        
        // Store locally
        const events = JSON.parse(localStorage.getItem('mms_install_events') || '[]');
        events.push({
            event: eventName,
            timestamp: new Date().toISOString(),
            platform: this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop',
            ...data
        });
        localStorage.setItem('mms_install_events', JSON.stringify(events.slice(-50))); // Keep last 50 events
    }

    trackInstallation(source) {
        const installData = {
            installed_at: new Date().toISOString(),
            source: source,
            platform: this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop',
            visits_before_install: this.visitCount,
            prompts_shown: this.installShownCount
        };
        
        localStorage.setItem('mms_app_installed', JSON.stringify(installData));
        this.trackEvent('app_installed', installData);
        
        // Clear install tracking data
        localStorage.removeItem('mms_install_dismissed');
        localStorage.removeItem('mms_last_install_prompt');
    }

    // Analytics method to get installation stats
    getInstallationStats() {
        return {
            visits: this.visitCount,
            platform: this.isIOS ? 'ios' : this.isAndroid ? 'android' : 'desktop',
            isStandalone: this.isStandalone,
            installShown: this.installShownCount,
            lastPrompt: this.lastInstallPrompt,
            totalTime: parseInt(localStorage.getItem('mms_total_time') || '0'),
            interactions: parseInt(localStorage.getItem('mms_interactions') || '0'),
            formSubmissions: parseInt(localStorage.getItem('mms_form_submissions') || '0'),
            incidentReported: localStorage.getItem('mms_incident_reported') === 'true'
        };
    }
}

// Initialize and make globally available
const enhancedInstaller = new EnhancedInstallPromotion();
window.enhancedInstaller = enhancedInstaller;

// Export install stats for dashboard
window.getPWAStats = () => enhancedInstaller.getInstallationStats();

console.log('🚀 Enhanced Install Promotion System Ready');
