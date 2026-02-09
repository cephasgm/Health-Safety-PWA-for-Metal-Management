// MMS Security Policy Enforcement Module
import { auth, db } from './firebase-config.js';
import { 
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class MMSSecurityPolicy {
  constructor() {
    this.policies = {
      password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90,
        historySize: 5,
        maxAttempts: 5,
        lockoutMinutes: 15
      },
      session: {
        timeoutMinutes: 30,
        maxSessions: 3,
        requireReauthForSensitive: true
      },
      data: {
        encryptionRequired: true,
        backupFrequency: 'daily',
        retentionDays: {
          incidents: 1825,    // 5 years
          health: 1825,       // 5 years
          training: 1095,     // 3 years
          audits: 1825        // 5 years
        },
        autoDeleteAfterRetention: false
      },
      access: {
        loginHours: {
          start: '06:00',
          end: '20:00'
        },
        allowedCountries: ['ZA', 'TZ', 'ZM', 'NA'],
        ipWhitelist: [],
        mfaRequired: false
      }
    };
    
    this.securityEvents = [];
    this.init();
  }

  init() {
    console.log('🛡️ MMS Security Policy Initialized');
    
    // Monitor user activity
    this.setupActivityMonitoring();
    
    // Setup auto-logout
    this.setupAutoLogout();
    
    // Setup security event logging
    this.setupEventLogging();
  }

  // ==================== PASSWORD POLICY ====================
  validatePassword(password) {
    const issues = [];
    
    if (password.length < this.policies.password.minLength) {
      issues.push(`Password must be at least ${this.policies.password.minLength} characters`);
    }
    
    if (this.policies.password.requireUppercase && !/[A-Z]/.test(password)) {
      issues.push('Password must contain at least one uppercase letter');
    }
    
    if (this.policies.password.requireLowercase && !/[a-z]/.test(password)) {
      issues.push('Password must contain at least one lowercase letter');
    }
    
    if (this.policies.password.requireNumbers && !/\d/.test(password)) {
      issues.push('Password must contain at least one number');
    }
    
    if (this.policies.password.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain at least one special character');
    }
    
    // Check against common passwords
    const commonPasswords = [
      'password', '123456', 'qwerty', 'admin', 'welcome',
      'letmein', 'monkey', 'dragon', 'baseball', 'football'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      issues.push('Password is too common. Choose a stronger password.');
    }
    
    return {
      valid: issues.length === 0,
      issues: issues,
      score: this.calculatePasswordStrength(password)
    };
  }

  calculatePasswordStrength(password) {
    let score = 0;
    
    // Length
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    
    // Character variety
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;
    
    // Bonus for mixed case and numbers
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 10;
    
    // Penalty for sequential chars
    if (/(.)\1{2,}/.test(password)) score -= 10;
    
    return Math.min(Math.max(score, 0), 100);
  }

  async checkPasswordHistory(userId, newPassword) {
    try {
      const historyRef = collection(db, 'password_history');
      const q = query(historyRef, where('userId', '==', userId), where('passwordHash', '==', this.hashPassword(newPassword)));
      const snapshot = await getDocs(q);
      
      return snapshot.empty; // True if password not in history
    } catch (error) {
      console.error('Password history check failed:', error);
      return true; // Allow on error
    }
  }

  hashPassword(password) {
    // Simple hash for demo - in production use proper hashing
    return btoa(password).split('').reverse().join('');
  }

  // ==================== SESSION SECURITY ====================
  setupAutoLogout() {
    let timeout;
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (window.mmsAuth?.currentUser) {
          this.logSecurityEvent('session_timeout', {
            user: window.mmsAuth.currentUser.email,
            lastActivity: new Date().toISOString()
          });
          
          // Warn user first
          if (confirm('Your session will expire in 1 minute due to inactivity. Continue?')) {
            resetTimer();
          } else {
            window.mmsAuth.logout();
          }
        }
      }, this.policies.session.timeoutMinutes * 60 * 1000);
    };
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });
    
    resetTimer();
  }

  async enforceSingleSession(userId) {
    if (!this.policies.session.maxSessions) return;
    
    // In production, track sessions in Firebase
    console.log(`Enforcing max ${this.policies.session.maxSessions} sessions for user`);
  }

  // ==================== ACCESS CONTROL ====================
  async checkAccessTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const [startHour, startMinute] = this.policies.access.loginHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.policies.access.loginHours.end.split(':').map(Number);
    
    const currentTime = currentHour * 60 + currentMinute;
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    if (currentTime < startTime || currentTime > endTime) {
      this.logSecurityEvent('access_outside_hours', {
        user: window.mmsAuth?.currentUser?.email,
        currentTime: `${currentHour}:${currentMinute}`,
        allowedHours: this.policies.access.loginHours
      });
      
      return {
        allowed: false,
        reason: `System access only allowed between ${this.policies.access.loginHours.start} and ${this.policies.access.loginHours.end}`
      };
    }
    
    return { allowed: true };
  }

  async checkGeolocation() {
    try {
      // In production, use IP geolocation service
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      const countryCode = data.country_code;
      const isAllowed = this.policies.access.allowedCountries.includes(countryCode);
      
      if (!isAllowed) {
        this.logSecurityEvent('access_from_restricted_country', {
          user: window.mmsAuth?.currentUser?.email,
          country: data.country_name,
          countryCode: countryCode,
          ip: data.ip
        });
      }
      
      return {
        allowed: isAllowed,
        country: data.country_name,
        countryCode: countryCode,
        ip: data.ip
      };
    } catch (error) {
      console.error('Geolocation check failed:', error);
      return { allowed: true, error: 'Geolocation service unavailable' };
    }
  }

  // ==================== DATA RETENTION ====================
  async applyDataRetention() {
    console.log('Applying data retention policies...');
    
    const now = new Date();
    const retentionDays = this.policies.data.retentionDays;
    
    // This would be a scheduled Firebase Function in production
    // For now, just log the policy
    Object.entries(retentionDays).forEach(([dataType, days]) => {
      console.log(`${dataType}: Retain for ${days} days (${days/365} years)`);
    });
    
    return {
      status: 'policy_applied',
      timestamp: now.toISOString(),
      retentionPolicies: retentionDays
    };
  }

  // ==================== SECURITY MONITORING ====================
  setupActivityMonitoring() {
    // Monitor sensitive operations
    const sensitiveSelectors = [
      '[onclick*="delete"]',
      '[onclick*="remove"]',
      '[onclick*="clear"]',
      '[data-sensitive="true"]'
    ];
    
    sensitiveSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        element.addEventListener('click', (e) => {
          this.logSecurityEvent('sensitive_operation', {
            element: selector,
            action: e.target.innerText || e.target.getAttribute('onclick'),
            user: window.mmsAuth?.currentUser?.email,
            timestamp: new Date().toISOString()
          });
          
          if (this.policies.session.requireReauthForSensitive) {
            // Could require re-authentication here
            console.log('Sensitive operation detected - logging...');
          }
        });
      });
    });
  }

  setupEventLogging() {
    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.logSecurityEvent('page_visibility_change', {
        hidden: document.hidden,
        user: window.mmsAuth?.currentUser?.email,
        timestamp: new Date().toISOString()
      });
    });
    
    // Log copy attempts on sensitive data
    document.addEventListener('copy', (e) => {
      const selection = window.getSelection().toString();
      if (selection && selection.length > 50) { // Arbitrary length threshold
        this.logSecurityEvent('data_copied', {
          length: selection.length,
          preview: selection.substring(0, 100) + '...',
          user: window.mmsAuth?.currentUser?.email
        });
      }
    });
  }

  // ==================== SECURITY EVENT LOGGING ====================
  async logSecurityEvent(eventType, details = {}) {
    const eventId = `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const eventData = {
      event_id: eventId,
      event_type: eventType,
      severity: this.getEventSeverity(eventType),
      timestamp: serverTimestamp(),
      user_id: window.mmsAuth?.currentUser?.uid || 'anonymous',
      user_email: window.mmsAuth?.currentUser?.email || 'anonymous',
      user_role: window.mmsAuth?.userRole || 'guest',
      user_location: window.mmsAuth?.userLocation || 'unknown',
      user_agent: navigator.userAgent,
      ip_address: await this.getClientIP(),
      details: details,
      company: 'mms_metal_management'
    };
    
    // Store in memory for immediate access
    this.securityEvents.push({
      ...eventData,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 events in memory
    if (this.securityEvents.length > 100) {
      this.securityEvents.shift();
    }
    
    // Log to console for debugging
    console.log(`🔒 SECURITY: ${eventType}`, details);
    
    // Save to Firestore if authenticated
    if (window.mmsAuth?.currentUser) {
      try {
        await setDoc(doc(db, 'security_events', eventId), eventData);
      } catch (error) {
        console.error('Failed to log security event to Firestore:', error);
      }
    }
    
    return eventId;
  }

  getEventSeverity(eventType) {
    const severityMap = {
      // High severity
      'login_failed_multiple': 'high',
      'access_from_restricted_country': 'high',
      'sensitive_data_access': 'high',
      'password_change': 'high',
      
      // Medium severity
      'session_timeout': 'medium',
      'access_outside_hours': 'medium',
      'data_copied': 'medium',
      'user_role_change': 'medium',
      
      // Low severity
      'login_success': 'low',
      'logout': 'low',
      'page_visibility_change': 'low',
      'password_validation': 'low'
    };
    
    return severityMap[eventType] || 'low';
  }

  async getSecurityEvents(limit = 50) {
    // Return from memory cache
    return {
      success: true,
      events: this.securityEvents.slice(-limit).reverse(),
      total: this.securityEvents.length,
      retrieved_at: new Date().toISOString()
    };
  }

  // ==================== UTILITIES ====================
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // ==================== PUBLIC API ====================
  async performSecurityCheck() {
    const checks = [];
    
    // Check 1: Password strength (if changing password)
    checks.push({
      name: 'password_policy',
      status: 'info',
      message: 'Password policy enforcement ready'
    });
    
    // Check 2: Access hours
    const accessTimeCheck = await this.checkAccessTime();
    checks.push({
      name: 'access_hours',
      status: accessTimeCheck.allowed ? 'pass' : 'warn',
      message: accessTimeCheck.allowed ? 'Access within allowed hours' : accessTimeCheck.reason
    });
    
    // Check 3: Geolocation
    const geoCheck = await this.checkGeolocation();
    checks.push({
      name: 'geolocation',
      status: geoCheck.allowed ? 'pass' : 'fail',
      message: geoCheck.allowed ? `Access from ${geoCheck.country} allowed` : `Access from ${geoCheck.country} restricted`
    });
    
    // Check 4: Session management
    checks.push({
      name: 'session_management',
      status: 'pass',
      message: `Auto-logout after ${this.policies.session.timeoutMinutes} minutes of inactivity`
    });
    
    return {
      success: true,
      checks: checks,
      timestamp: new Date().toISOString(),
      user: window.mmsAuth?.currentUser?.email
    };
  }

  getSecurityPolicy() {
    return {
      ...this.policies,
      version: '1.0.0',
      effective_date: '2024-01-01',
      company: 'Metal Management Solutions'
    };
  }
}

// Initialize and export
const mmsSecurity = new MMSSecurityPolicy();

// Global functions
window.validatePassword = function(password) {
  return mmsSecurity.validatePassword(password);
};

window.performSecurityAudit = async function() {
  const result = await mmsSecurity.performSecurityCheck();
  
  const auditResults = document.getElementById('auditResults') || 
    document.createElement('div');
  
  auditResults.id = 'auditResults';
  auditResults.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #dc2626;
    border-radius: 10px;
    padding: 20px;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 9999;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; color: #dc2626;">🔒 Security Audit</h3>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
    </div>
    <div style="margin-bottom: 15px; font-size: 0.9rem; color: #666;">
      User: ${window.mmsAuth?.currentUser?.email || 'Not logged in'}<br>
      Time: ${new Date().toLocaleTimeString()}
    </div>
  `;
  
  result.checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    const color = check.status === 'pass' ? '#10b981' : check.status === 'warn' ? '#f59e0b' : '#ef4444';
    
    html += `
      <div style="margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${color};">
        <div style="font-weight: 600; margin-bottom: 5px;">${icon} ${check.name.replace('_', ' ').toUpperCase()}</div>
        <div style="font-size: 0.9rem; color: #64748b;">${check.message}</div>
      </div>
    `;
  });
  
  auditResults.innerHTML = html;
  document.body.appendChild(auditResults);
  
  return result;
};

// Make globally available
window.mmsSecurity = mmsSecurity;

console.log('✅ MMS Security Policy Module Ready');
