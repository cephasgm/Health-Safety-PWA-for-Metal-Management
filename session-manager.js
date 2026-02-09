// Session Manager - MMS Safety System
// Manages user sessions, timeout, and security

class MMSSessionManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.warningTimeout = 5 * 60 * 1000;  // 5 minutes warning
    this.checkInterval = 60 * 1000;       // Check every minute
    this.lastActivity = Date.now();
    this.sessionId = this.generateSessionId();
    this.isActive = false;
    this.warningShown = false;
    this.init();
  }

  init() {
    console.log('🔐 MMS Session Manager Initializing...');
    
    // Generate unique session ID
    this.sessionId = this.generateSessionId();
    
    // Start session monitoring
    this.startSessionMonitoring();
    
    // Track user activity
    this.setupActivityTracking();
    
    // Handle page visibility changes
    this.setupVisibilityHandling();
    
    // Setup beforeunload warning
    this.setupBeforeUnload();
    
    console.log(`✅ Session started: ${this.sessionId}`);
  }

  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const user = window.mmsAuth?.currentUser?.uid?.substr(0, 8) || 'guest';
    return `MMS-${timestamp}-${random}-${user}`;
  }

  startSessionMonitoring() {
    // Check session status regularly
    this.sessionTimer = setInterval(() => {
      this.checkSessionStatus();
    }, this.checkInterval);
    
    // Log session start
    this.logSessionEvent('session_started', {
      session_id: this.sessionId,
      user_id: window.mmsAuth?.currentUser?.uid,
      user_email: window.mmsAuth?.currentUser?.email,
      user_role: window.mmsAuth?.userRole,
      user_location: window.mmsAuth?.userLocation,
      browser: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }

  setupActivityTracking() {
    // Track user interactions
    const activityEvents = [
      'mousedown', 'mousemove', 'keydown', 
      'scroll', 'touchstart', 'click',
      'input', 'focus'
    ];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });
    
    // Also track window focus
    window.addEventListener('focus', () => {
      this.updateLastActivity();
    });
  }

  updateLastActivity() {
    this.lastActivity = Date.now();
    this.warningShown = false;
    
    // Reset warning timer if it was shown
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    
    // Log significant activity (throttled)
    if (!this.lastActivityLog || Date.now() - this.lastActivityLog > 60000) {
      this.logSessionEvent('user_activity', {
        session_id: this.sessionId,
        inactivity_duration: Date.now() - this.lastActivity
      });
      this.lastActivityLog = Date.now();
    }
  }

  checkSessionStatus() {
    const now = Date.now();
    const inactiveTime = now - this.lastActivity;
    
    // Show warning before timeout
    if (!this.warningShown && inactiveTime > this.sessionTimeout - this.warningTimeout) {
      this.showTimeoutWarning();
      this.warningShown = true;
    }
    
    // Auto-logout on timeout
    if (inactiveTime > this.sessionTimeout) {
      this.forceLogout('inactivity_timeout');
    }
    
    // Log session health periodically
    if (!this.lastHealthLog || now - this.lastHealthLog > 300000) { // 5 minutes
      this.logSessionHealth();
      this.lastHealthLog = now;
    }
  }

  showTimeoutWarning() {
    if (this.warningShown) return;
    
    const warningTime = Math.ceil(this.warningTimeout / 60000); // minutes
    
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.id = 'sessionWarningModal';
    warningModal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      ">
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 16px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          border-top: 6px solid #f59e0b;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h3 style="color: #92400e; margin-bottom: 0.5rem;">Session About to Expire</h3>
          <p style="color: #64748b; margin-bottom: 1.5rem;">
            Your session will expire in ${warningTime} minute${warningTime > 1 ? 's' : ''} due to inactivity.
            <br><br>
            <span style="font-weight: 500;">Click anywhere to continue working.</span>
          </p>
          <div style="
            background: #fef3c7;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 0.75rem;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            color: #92400e;
          ">
            <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <span>⏰</span>
              <span>Time remaining: <span id="countdownTimer">${warningTime}:00</span></span>
            </div>
          </div>
          <button onclick="window.sessionManager?.extendSession()" style="
            padding: 0.75rem 2rem;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            font-size: 1rem;
          ">
            🔄 Continue Session
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(warningModal);
    
    // Start countdown
    let seconds = warningTime * 60;
    const countdownElement = document.getElementById('countdownTimer');
    
    const countdown = setInterval(() => {
      seconds--;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      countdownElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
      
      if (seconds <= 0) {
        clearInterval(countdown);
      }
    }, 1000);
    
    // Close warning on any activity
    const closeOnActivity = () => {
      this.extendSession();
      document.removeEventListener('click', closeOnActivity);
      document.removeEventListener('keydown', closeOnActivity);
    };
    
    document.addEventListener('click', closeOnActivity, { once: true });
    document.addEventListener('keydown', closeOnActivity, { once: true });
    
    // Auto-remove warning after timeout
    this.warningTimer = setTimeout(() => {
      if (warningModal.parentNode) {
        warningModal.remove();
      }
      clearInterval(countdown);
    }, this.warningTimeout);
    
    // Log warning shown
    this.logSessionEvent('timeout_warning_shown', {
      session_id: this.sessionId,
      warning_duration: warningTime,
      remaining_session_time: this.sessionTimeout - (Date.now() - this.lastActivity)
    });
  }

  extendSession() {
    this.updateLastActivity();
    
    // Remove warning modal if exists
    const warningModal = document.getElementById('sessionWarningModal');
    if (warningModal) {
      warningModal.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => warningModal.remove(), 300);
    }
    
    // Show confirmation
    this.showToast('Session extended ✓', 'success', 2000);
    
    // Log extension
    this.logSessionEvent('session_extended', {
      session_id: this.sessionId,
      extended_by: 'user_action',
      new_expiry: Date.now() + this.sessionTimeout
    });
  }

  async forceLogout(reason = 'session_expired') {
    // Clear any warnings first
    const warningModal = document.getElementById('sessionWarningModal');
    if (warningModal) warningModal.remove();
    
    // Stop session monitoring
    this.stopSessionMonitoring();
    
    // Log forced logout
    await this.logSessionEvent('forced_logout', {
      session_id: this.sessionId,
      reason: reason,
      last_activity: this.lastActivity,
      session_duration: Date.now() - (this.sessionStart || Date.now()),
      user_id: window.mmsAuth?.currentUser?.uid,
      user_email: window.mmsAuth?.currentUser?.email
    });
    
    // Show logout message
    const messages = {
      'inactivity_timeout': 'Logged out due to inactivity',
      'session_expired': 'Your session has expired',
      'security_breach': 'Session terminated for security',
      'multiple_sessions': 'Logged out from another device'
    };
    
    this.showLogoutModal(messages[reason] || 'You have been logged out');
    
    // Perform logout after delay
    setTimeout(async () => {
      if (window.mmsAuth && window.mmsAuth.logout) {
        await window.mmsAuth.logout();
      } else {
        // Fallback redirect
        window.location.reload();
      }
    }, 3000);
  }

  showLogoutModal(message) {
    const logoutModal = document.createElement('div');
    logoutModal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.5s ease;
      ">
        <div style="
          background: white;
          padding: 2.5rem;
          border-radius: 16px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          border-top: 6px solid #dc2626;
        ">
          <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">🔒</div>
          <h3 style="color: #1e293b; margin-bottom: 1rem;">Session Ended</h3>
          <p style="color: #64748b; margin-bottom: 1.5rem; line-height: 1.6;">
            ${message}<br><br>
            You will be redirected to the login screen in a moment.
          </p>
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            color: #dc2626;
            font-weight: 500;
            margin-top: 1.5rem;
          ">
            <span class="spinner" style="
              width: 20px;
              height: 20px;
              border: 3px solid #f1f5f9;
              border-top: 3px solid #dc2626;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            "></span>
            <span>Redirecting...</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(logoutModal);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  setupVisibilityHandling() {
    // Handle tab/window visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logSessionEvent('session_backgrounded', {
          session_id: this.sessionId,
          background_time: Date.now()
        });
      } else {
        this.updateLastActivity();
        this.logSessionEvent('session_foregrounded', {
          session_id: this.sessionId,
          background_duration: Date.now() - this.lastBackgroundTime
        });
      }
    });
    
    // Handle page becoming visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateLastActivity();
      }
    });
  }

  setupBeforeUnload() {
    // Warn user before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      // Check if there are unsaved changes
      const hasUnsavedChanges = this.checkUnsavedChanges();
      
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
      
      // Log session end
      this.logSessionEvent('session_ended', {
        session_id: this.sessionId,
        reason: 'page_unload',
        session_duration: Date.now() - (this.sessionStart || Date.now()),
        user_id: window.mmsAuth?.currentUser?.uid
      });
    });
  }

  checkUnsavedChanges() {
    // Check for form changes
    const forms = document.querySelectorAll('form, [data-unsaved]');
    let hasChanges = false;
    
    forms.forEach(form => {
      // Check if form has been modified
      if (form.hasAttribute('data-modified')) {
        hasChanges = true;
      }
    });
    
    return hasChanges;
  }

  async logSessionEvent(eventType, details = {}) {
    try {
      if (window.mmsDB && window.mmsDB.logAction) {
        await window.mmsDB.logAction(`session_${eventType}`, {
          session_id: this.sessionId,
          ...details,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          page_url: window.location.href
        });
      } else {
        // Fallback to console
        console.log(`🔐 SESSION: ${eventType}`, {
          session_id: this.sessionId,
          ...details
        });
      }
    } catch (error) {
      console.error('Failed to log session event:', error);
    }
  }

  logSessionHealth() {
    const sessionDuration = Date.now() - (this.sessionStart || Date.now());
    const memory = performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      total: Math.round(performance.memory.totalJSHeapSize / 1048576),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
    } : null;
    
    this.logSessionEvent('health_check', {
      session_duration: sessionDuration,
      inactivity_time: Date.now() - this.lastActivity,
      memory_usage: memory,
      connection: navigator.connection ? {
        type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      page_visibility: document.visibilityState
    });
  }

  showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existing = document.getElementById('sessionToast');
    if (existing) existing.remove();
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    const toast = document.createElement('div');
    toast.id = 'sessionToast';
    toast.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s ease;
        max-width: 350px;
      ">
        <div style="font-size: 1.25rem;">
          ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </div>
        <div>${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
    
    // Add animations
    if (!document.getElementById('sessionToastStyles')) {
      const style = document.createElement('style');
      style.id = 'sessionToastStyles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  stopSessionMonitoring() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
    
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    
    this.isActive = false;
  }

  // Public methods
  getSessionInfo() {
    return {
      session_id: this.sessionId,
      user_id: window.mmsAuth?.currentUser?.uid,
      user_email: window.mmsAuth?.currentUser?.email,
      user_role: window.mmsAuth?.userRole,
      session_start: this.sessionStart || Date.now(),
      last_activity: this.lastActivity,
      inactive_time: Date.now() - this.lastActivity,
      time_remaining: this.sessionTimeout - (Date.now() - this.lastActivity),
      status: this.isActive ? 'active' : 'inactive'
    };
  }

  resetSession() {
    this.stopSessionMonitoring();
    this.sessionId = this.generateSessionId();
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.startSessionMonitoring();
    
    this.logSessionEvent('session_reset', {
      new_session_id: this.sessionId,
      reason: 'manual_reset'
    });
  }

  setSessionTimeout(minutes) {
    if (minutes < 5 || minutes > 480) { // 5 min to 8 hours
      throw new Error('Session timeout must be between 5 and 480 minutes');
    }
    
    this.sessionTimeout = minutes * 60 * 1000;
    this.warningTimeout = Math.min(5 * 60 * 1000, this.sessionTimeout * 0.2); // 5 min or 20%
    
    this.logSessionEvent('timeout_updated', {
      new_timeout: minutes,
      session_id: this.sessionId
    });
    
    return this.sessionTimeout;
  }

  // Detect multiple sessions (prevent concurrent logins)
  async checkConcurrentSessions() {
    try {
      // This would check with backend if user is logged in elsewhere
      // For now, we'll just log and warn
      
      const user = window.mmsAuth?.currentUser;
      if (!user) return;
      
      // Check local storage for existing session
      const lastSession = localStorage.getItem(`mms_session_${user.uid}`);
      const currentTime = Date.now();
      
      if (lastSession) {
        const lastSessionTime = parseInt(lastSession);
        const timeDiff = currentTime - lastSessionTime;
        
        // If last session was recent (< 5 min), might be concurrent
        if (timeDiff < 5 * 60 * 1000) {
          this.logSessionEvent('concurrent_session_detected', {
            user_id: user.uid,
            last_session: lastSessionTime,
            current_session: currentTime,
            time_difference: timeDiff
          });
          
          // Ask user what to do
          const choice = confirm(
            'Another session was detected recently.\n\n' +
            'Continue with this session?\n\n' +
            'Click OK to continue here, Cancel to stay on other device.'
          );
          
          if (!choice) {
            this.forceLogout('multiple_sessions');
          }
        }
      }
      
      // Update last session time
      localStorage.setItem(`mms_session_${user.uid}`, currentTime.toString());
      
    } catch (error) {
      console.error('Error checking concurrent sessions:', error);
    }
  }

  // Cleanup on logout
  async cleanup() {
    this.stopSessionMonitoring();
    
    // Clear session tracking
    const user = window.mmsAuth?.currentUser;
    if (user) {
      localStorage.removeItem(`mms_session_${user.uid}`);
    }
    
    // Log cleanup
    await this.logSessionEvent('session_cleanup', {
      session_id: this.sessionId,
      cleanup_time: Date.now()
    });
  }
}

// Initialize session manager when auth is ready
function initializeSessionManager() {
  // Wait for auth to be ready
  const checkAuth = setInterval(() => {
    if (window.mmsAuth && window.mmsAuth.currentUser !== undefined) {
      clearInterval(checkAuth);
      
      // Only initialize if user is logged in
      if (window.mmsAuth.currentUser) {
        window.sessionManager = new MMSSessionManager();
        
        // Check for concurrent sessions
        setTimeout(() => {
          window.sessionManager.checkConcurrentSessions();
        }, 2000);
      }
    }
  }, 100);
}

// Listen for auth state changes
if (window.mmsAuth) {
  // If auth is already loaded
  setTimeout(initializeSessionManager, 1000);
} else {
  // Wait for auth to be loaded
  window.addEventListener('mmsAuthReady', initializeSessionManager);
}

// Also initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSessionManager);
} else {
  setTimeout(initializeSessionManager, 1000);
}

// Export for use in other modules
console.log('✅ Session Manager Module Loaded');
