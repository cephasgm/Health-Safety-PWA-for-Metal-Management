// MMS Safety - Enhanced Audit Logger
// Tracks ALL data changes and user actions

class SafetyAuditLogger {
  constructor() {
    this.logLevels = {
      DEBUG: 'debug',
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      SECURITY: 'security'
    };
    
    this.MAX_LOG_RETENTION = 1000; // Keep last 1000 logs in memory
    this.localLogs = [];
    
    console.log('📝 Audit Logger Initialized');
  }

  async log(logData) {
    try {
      const auditLog = {
        // Basic info
        id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        level: logData.level || this.logLevels.INFO,
        
        // User context
        user_id: window.mmsAuth?.currentUser?.uid || 'anonymous',
        user_email: window.mmsAuth?.currentUser?.email || 'anonymous',
        user_role: window.mmsAuth?.userRole || 'guest',
        user_location: window.mmsAuth?.userLocation || 'unknown',
        
        // Action details
        action: logData.action || 'unknown_action',
        module: logData.module || 'general',
        entity_type: logData.entity_type,
        entity_id: logData.entity_id,
        
        // Changes
        old_value: logData.old_value ? this.sanitizeData(logData.old_value) : null,
        new_value: logData.new_value ? this.sanitizeData(logData.new_value) : null,
        changes: logData.changes || [],
        
        // Context
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        device_info: this.getDeviceInfo(),
        page_url: window.location.href,
        
        // Metadata
        company: 'mms_metal_management',
        session_id: this.getSessionId(),
        browser_session: sessionStorage.getItem('browser_session') || 'unknown'
      };
      
      // 1. Save to local memory (for immediate display)
      this.saveToLocalMemory(auditLog);
      
      // 2. Save to Firebase (for permanent storage)
      await this.saveToFirebase(auditLog);
      
      // 3. Console output (for debugging)
      this.outputToConsole(auditLog);
      
      return { success: true, log_id: auditLog.id };
      
    } catch (error) {
      console.error('❌ Failed to log audit:', error);
      return { success: false, error: error.message };
    }
  }

  saveToLocalMemory(log) {
    // Add to beginning of array (newest first)
    this.localLogs.unshift(log);
    
    // Limit array size
    if (this.localLogs.length > this.MAX_LOG_RETENTION) {
      this.localLogs = this.localLogs.slice(0, this.MAX_LOG_RETENTION);
    }
    
    // Update UI if audit panel exists
    this.updateAuditUI(log);
  }

  async saveToFirebase(log) {
    try {
      if (!window.mmsDB) {
        console.warn('Firebase not available for audit logging');
        return false;
      }
      
      // Use database service to save
      const result = await window.mmsDB.logAction('audit_log', {
        log_id: log.id,
        action: log.action,
        user: log.user_email,
        level: log.level
      });
      
      return result;
      
    } catch (error) {
      console.warn('Failed to save audit to Firebase:', error);
      return false;
    }
  }

  outputToConsole(log) {
    const colors = {
      debug: '#6b7280',
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      security: '#dc2626'
    };
    
    const color = colors[log.level] || '#6b7280';
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      security: '🔒'
    }[log.level] || '📝';
    
    console.log(
      `%c${emoji} AUDIT ${log.level.toUpperCase()}: ${log.action}`,
      `color: ${color}; font-weight: bold;`,
      log
    );
  }

  sanitizeData(data) {
    if (!data) return data;
    
    // Don't log sensitive information
    if (typeof data === 'object') {
      const sanitized = { ...data };
      
      // Remove sensitive fields
      const sensitiveFields = [
        'password', 'token', 'secret', 'key',
        'blood_group', 'allergies', 'medical_conditions',
        'emergency_contact', 'phone', 'email'
      ];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    // Check if string contains sensitive info
    if (typeof data === 'string') {
      if (data.includes('@') || /\d{10,}/.test(data)) {
        return '[REDACTED_SENSITIVE_INFO]';
      }
    }
    
    return data;
  }

  // Specific audit methods
  async logDataChange(entityType, entityId, oldValue, newValue, changes) {
    return this.log({
      level: this.logLevels.INFO,
      action: 'data_changed',
      module: 'database',
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
      changes: changes
    });
  }

  async logLoginAttempt(email, success, reason = '') {
    return this.log({
      level: success ? this.logLevels.INFO : this.logLevels.SECURITY,
      action: success ? 'login_success' : 'login_failed',
      module: 'authentication',
      entity_type: 'user',
      entity_id: email,
      details: { success, reason }
    });
  }

  async logExportAction(exportType, dataCount) {
    return this.log({
      level: this.logLevels.INFO,
      action: 'data_exported',
      module: 'reports',
      entity_type: 'export',
      details: { export_type: exportType, record_count: dataCount }
    });
  }

  async logSecurityEvent(event, details) {
    return this.log({
      level: this.logLevels.SECURITY,
      action: `security_${event}`,
      module: 'security',
      details: details
    });
  }

  // UI Methods
  updateAuditUI(log) {
    // Update audit panel if it exists
    const auditPanel = document.getElementById('auditLogPanel');
    if (auditPanel) {
      this.addLogToPanel(auditPanel, log);
    }
    
    // Show toast for important events
    if (log.level === this.logLevels.SECURITY || log.level === this.logLevels.ERROR) {
      this.showAuditToast(log);
    }
  }

  addLogToPanel(panel, log) {
    const logEntry = document.createElement('div');
    logEntry.className = `audit-log-entry audit-${log.level}`;
    logEntry.innerHTML = `
      <div class="audit-log-header">
        <span class="audit-log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        <span class="audit-log-action">${log.action}</span>
        <span class="audit-log-user">${log.user_email}</span>
      </div>
      <div class="audit-log-details">${JSON.stringify(log.details || {}, null, 2)}</div>
    `;
    
    panel.prepend(logEntry);
    
    // Limit panel entries
    const entries = panel.querySelectorAll('.audit-log-entry');
    if (entries.length > 50) {
      entries[entries.length - 1].remove();
    }
  }

  showAuditToast(log) {
    const toast = document.createElement('div');
    toast.className = `audit-toast audit-toast-${log.level}`;
    toast.innerHTML = `
      <div class="audit-toast-icon">${this.getLevelEmoji(log.level)}</div>
      <div class="audit-toast-content">
        <div class="audit-toast-title">${log.action.replace(/_/g, ' ')}</div>
        <div class="audit-toast-message">${log.user_email} • ${log.module}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }, 100);
  }

  getLevelEmoji(level) {
    const emojis = {
      debug: '🔍',
      info: '📝',
      warning: '⚠️',
      error: '❌',
      security: '🔒'
    };
    return emojis[level] || '📝';
  }

  // Utility methods
  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  getDeviceInfo() {
    return {
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine,
      screen: `${screen.width}x${screen.height}`,
      cookies: navigator.cookieEnabled
    };
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('audit_session_id');
    if (!sessionId) {
      sessionId = `SESS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('audit_session_id', sessionId);
    }
    return sessionId;
  }

  getLogs(filter = {}) {
    let filteredLogs = this.localLogs;
    
    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }
    
    if (filter.module) {
      filteredLogs = filteredLogs.filter(log => log.module === filter.module);
    }
    
    if (filter.user) {
      filteredLogs = filteredLogs.filter(log => log.user_email.includes(filter.user));
    }
    
    if (filter.startDate) {
      const start = new Date(filter.startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }
    
    return filteredLogs;
  }

  exportLogs(format = 'json') {
    const logs = this.getLogs();
    
    if (format === 'json') {
      const dataStr = JSON.stringify(logs, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `mms-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      this.logExportAction('audit_logs', logs.length);
      
    } else if (format === 'csv') {
      // Implement CSV export if needed
      console.log('CSV export not implemented');
    }
    
    return logs.length;
  }
}

// Create global instance
const safetyAudit = new SafetyAuditLogger();

// Global audit functions
window.logSecurityEvent = function(event, details) {
  return safetyAudit.logSecurityEvent(event, details);
};

window.logDataChange = function(entityType, entityId, oldValue, newValue) {
  return safetyAudit.logDataChange(entityType, entityId, oldValue, newValue);
};

window.viewAuditLogs = function() {
  const logs = safetyAudit.getLogs();
  console.table(logs.map(log => ({
    Time: new Date(log.timestamp).toLocaleTimeString(),
    Action: log.action,
    User: log.user_email,
    Level: log.level,
    Module: log.module
  })));
  return logs;
};

// Auto-log important events
document.addEventListener('DOMContentLoaded', function() {
  // Log page load
  safetyAudit.log({
    level: safetyAudit.logLevels.INFO,
    action: 'page_loaded',
    module: 'application',
    details: { url: window.location.href }
  });
  
  // Log visibility changes
  document.addEventListener('visibilitychange', function() {
    safetyAudit.log({
      level: safetyAudit.logLevels.INFO,
      action: document.hidden ? 'page_hidden' : 'page_visible',
      module: 'application'
    });
  });
  
  // Log beforeunload
  window.addEventListener('beforeunload', function() {
    safetyAudit.log({
      level: safetyAudit.logLevels.INFO,
      action: 'page_unloading',
      module: 'application'
    });
  });
});

console.log('✅ Audit Logger Ready');
