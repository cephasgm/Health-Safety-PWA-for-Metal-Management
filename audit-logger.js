// Audit Logger - MMS Safety System
// Comprehensive audit trail for all actions

class MMSAuditLogger {
  constructor() {
    this.AUDIT_LEVELS = {
      EMERGENCY: 0,    // System failures, security breaches
      CRITICAL: 1,     // Safety incidents, data loss
      HIGH: 2,         // Policy violations, unauthorized access
      MEDIUM: 3,       // Configuration changes, data modifications
      LOW: 4,          // View actions, exports
      INFO: 5          // Login/logout, routine operations
    };
    
    this.AUDIT_CATEGORIES = {
      AUTHENTICATION: 'authentication',
      DATA_ACCESS: 'data_access',
      DATA_MODIFICATION: 'data_modification',
      SECURITY: 'security',
      COMPLIANCE: 'compliance',
      SYSTEM: 'system',
      INCIDENT: 'incident'
    };
    
    this.localLogBuffer = [];
    this.maxBufferSize = 100;
    this.flushInterval = 30000; // 30 seconds
    
    this.init();
    console.log('📝 MMS Audit Logger Initialized');
  }

  init() {
    // Load previous logs from localStorage
    this.loadLocalLogs();
    
    // Auto-flush logs to server
    setInterval(() => this.flushLogsToServer(), this.flushInterval);
    
    // Listen for page unload to save logs
    window.addEventListener('beforeunload', () => this.saveLocalLogs());
    
    // Log system startup
    this.log({
      level: this.AUDIT_LEVELS.INFO,
      category: this.AUDIT_CATEGORIES.SYSTEM,
      action: 'system_startup',
      message: 'Audit logging system initialized',
      details: {
        user_agent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Main logging method
  async log(logEntry) {
    try {
      // Ensure required fields
      const enrichedLog = {
        // Core metadata
        log_id: this.generateLogId(),
        timestamp: new Date().toISOString(),
        session_id: this.getSessionId(),
        
        // User context
        user_id: window.mmsAuth?.currentUser?.uid || 'anonymous',
        user_email: window.mmsAuth?.currentUser?.email || 'anonymous',
        user_role: window.mmsAuth?.userRole || 'guest',
        user_location: window.mmsAuth?.userLocation || 'unknown',
        
        // Device/browser context
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        
        // Network context
        online: navigator.onLine,
        connection_type: navigator.connection?.effectiveType || 'unknown',
        
        // Application context
        company: 'mms_metal_management',
        app_version: '1.0.0',
        environment: window.location.hostname.includes('localhost') ? 'development' : 'production',
        
        // The actual log data
        ...logEntry,
        
        // IP address (async)
        ip_address: await this.getClientIP()
      };

      // Add to buffer
      this.localLogBuffer.push(enrichedLog);
      
      // Trim buffer if too large
      if (this.localLogBuffer.length > this.maxBufferSize) {
        this.localLogBuffer = this.localLogBuffer.slice(-this.maxBufferSize);
      }
      
      // Save to localStorage immediately
      this.saveLocalLogs();
      
      // Console output in development
      if (window.location.hostname.includes('localhost')) {
        this.consoleLog(enrichedLog);
      }
      
      // Immediate flush for critical/emergency logs
      if (logEntry.level <= this.AUDIT_LEVELS.HIGH) {
        await this.sendToServer([enrichedLog]);
      }
      
      return enrichedLog.log_id;
      
    } catch (error) {
      console.error('❌ Audit logging failed:', error);
      // Emergency fallback logging
      this.emergencyLog(error, logEntry);
      return null;
    }
  }

  // Specialized logging methods
  async logLogin(success, details = {}) {
    return this.log({
      level: success ? this.AUDIT_LEVELS.INFO : this.AUDIT_LEVELS.HIGH,
      category: this.AUDIT_CATEGORIES.AUTHENTICATION,
      action: success ? 'login_success' : 'login_failed',
      message: success ? 'User logged in successfully' : 'Failed login attempt',
      details: {
        email: details.email || 'unknown',
        attempt_time: new Date().toISOString(),
        failure_reason: details.reason || 'none',
        ...details
      }
    });
  }

  async logLogout() {
    return this.log({
      level: this.AUDIT_LEVELS.INFO,
      category: this.AUDIT_CATEGORIES.AUTHENTICATION,
      action: 'logout',
      message: 'User logged out',
      details: {
        session_duration: this.getSessionDuration(),
        logout_time: new Date().toISOString()
      }
    });
  }

  async logDataAccess(collection, documentId, action) {
    return this.log({
      level: this.AUDIT_LEVELS.LOW,
      category: this.AUDIT_CATEGORIES.DATA_ACCESS,
      action: `data_${action}`,
      message: `${action.toUpperCase()} data from ${collection}`,
      details: {
        collection: collection,
        document_id: documentId,
        action: action,
        access_time: new Date().toISOString()
      }
    });
  }

  async logDataModification(collection, documentId, action, changes) {
    // Generate data fingerprint for integrity verification
    let dataFingerprint = null;
    if (window.mmsEncryption && changes) {
      dataFingerprint = await window.mmsEncryption.generateDataFingerprint(changes);
    }
    
    return this.log({
      level: this.AUDIT_LEVELS.MEDIUM,
      category: this.AUDIT_CATEGORIES.DATA_MODIFICATION,
      action: `data_${action}`,
      message: `${action.toUpperCase()} data in ${collection}`,
      details: {
        collection: collection,
        document_id: documentId,
        action: action,
        changes: this.sanitizeChanges(changes),
        data_fingerprint: dataFingerprint,
        modification_time: new Date().toISOString()
      }
    });
  }

  async logSecurityEvent(event, details) {
    return this.log({
      level: this.AUDIT_LEVELS.CRITICAL,
      category: this.AUDIT_CATEGORIES.SECURITY,
      action: `security_${event}`,
      message: `Security event: ${event}`,
      details: {
        event: event,
        ...details,
        severity: 'critical',
        response_required: true
      }
    });
  }

  async logIncidentReport(incidentId, details) {
    return this.log({
      level: this.AUDIT_LEVELS.CRITICAL,
      category: this.AUDIT_CATEGORIES.INCIDENT,
      action: 'incident_reported',
      message: 'Safety incident reported',
      details: {
        incident_id: incidentId,
        report_time: new Date().toISOString(),
        location: details.location,
        type: details.type,
        severity: details.severity,
        reporter: details.reported_by
      }
    });
  }

  // Utility methods
  generateLogId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `AUDIT-${timestamp}-${random}`;
  }

  getSessionId() {
    if (!sessionStorage.getItem('mms_session_id')) {
      const sessionId = `SESS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('mms_session_id', sessionId);
      sessionStorage.setItem('mms_session_start', new Date().toISOString());
    }
    return sessionStorage.getItem('mms_session_id');
  }

  getSessionDuration() {
    const start = sessionStorage.getItem('mms_session_start');
    if (!start) return 'unknown';
    
    const startTime = new Date(start);
    const endTime = new Date();
    const duration = endTime - startTime;
    
    // Format duration
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      try {
        const response = await fetch('https://api64.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
      } catch {
        return 'unknown';
      }
    }
  }

  sanitizeChanges(changes) {
    if (!changes || typeof changes !== 'object') return changes;
    
    const sanitized = { ...changes };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'blood_group', 'allergies'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  // Storage management
  saveLocalLogs() {
    try {
      localStorage.setItem('mms_audit_logs', JSON.stringify(this.localLogBuffer));
      localStorage.setItem('mms_audit_last_save', new Date().toISOString());
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
    }
  }

  loadLocalLogs() {
    try {
      const savedLogs = localStorage.getItem('mms_audit_logs');
      if (savedLogs) {
        this.localLogBuffer = JSON.parse(savedLogs);
        console.log(`📂 Loaded ${this.localLogBuffer.length} audit logs from localStorage`);
      }
    } catch (error) {
      console.error('Failed to load logs from localStorage:', error);
      this.localLogBuffer = [];
    }
  }

  async flushLogsToServer() {
    if (this.localLogBuffer.length === 0) return;
    
    const logsToSend = [...this.localLogBuffer];
    
    try {
      await this.sendToServer(logsToSend);
      
      // Clear sent logs from buffer
      this.localLogBuffer = this.localLogBuffer.filter(
        log => !logsToSend.find(sentLog => sentLog.log_id === log.log_id)
      );
      
      console.log(`📤 Flushed ${logsToSend.length} audit logs to server`);
      
    } catch (error) {
      console.warn('⚠️ Failed to flush logs to server:', error.message);
      // Keep logs in buffer for retry
    }
  }

  async sendToServer(logs) {
    if (!window.mmsDB) {
      console.warn('Database service not available for audit logging');
      return;
    }
    
    try {
      for (const log of logs) {
        await window.mmsDB.logAction('audit_log', log);
      }
      return true;
    } catch (error) {
      console.error('Failed to send audit logs:', error);
      return false;
    }
  }

  // Console output for development
  consoleLog(logEntry) {
    const colors = {
      0: 'background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px;',
      1: 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px;',
      2: 'background: #f97316; color: white; padding: 2px 6px; border-radius: 3px;',
      3: 'background: #eab308; color: black; padding: 2px 6px; border-radius: 3px;',
      4: 'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 3px;',
      5: 'background: #6b7280; color: white; padding: 2px 6px; border-radius: 3px;'
    };
    
    const levelNames = ['EMERGENCY', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const levelName = levelNames[logEntry.level] || 'UNKNOWN';
    
    console.log(
      `%cAUDIT ${levelName}%c ${logEntry.action} | ${logEntry.category}`,
      colors[logEntry.level] || colors[5],
      'color: #666;'
    );
    
    if (logEntry.level <= this.AUDIT_LEVELS.MEDIUM) {
      console.log('Details:', logEntry.details);
    }
  }

  // Emergency fallback logging
  emergencyLog(error, originalLog) {
    const emergencyLog = {
      timestamp: new Date().toISOString(),
      type: 'audit_system_failure',
      error: error.message,
      original_log: originalLog,
      user_agent: navigator.userAgent,
      url: window.location.href
    };
    
    // Try to save in multiple places
    try {
      // 1. localStorage
      const emergencyLogs = JSON.parse(localStorage.getItem('mms_emergency_logs') || '[]');
      emergencyLogs.push(emergencyLog);
      localStorage.setItem('mms_emergency_logs', JSON.stringify(emergencyLogs.slice(-20)));
      
      // 2. sessionStorage
      sessionStorage.setItem('mms_last_emergency', JSON.stringify(emergencyLog));
      
      // 3. console (always)
      console.error('🚨 AUDIT SYSTEM EMERGENCY:', emergencyLog);
      
    } catch (e) {
      // Last resort
      console.error('🚨🚨 CRITICAL AUDIT FAILURE:', e, emergencyLog);
    }
  }

  // Report generation
  async generateAuditReport(options = {}) {
    const report = {
      generated_at: new Date().toISOString(),
      generated_by: window.mmsAuth?.currentUser?.email || 'system',
      period: options.period || 'last_30_days',
      filters: options,
      summary: {},
      logs: []
    };
    
    // Filter logs based on options
    let filteredLogs = [...this.localLogBuffer];
    
    if (options.startDate) {
      const start = new Date(options.startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    
    if (options.endDate) {
      const end = new Date(options.endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }
    
    if (options.level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level <= options.level);
    }
    
    if (options.category) {
      filteredLogs = filteredLogs.filter(log => log.category === options.category);
    }
    
    if (options.userId) {
      filteredLogs = filteredLogs.filter(log => log.user_id === options.userId);
    }
    
    // Generate summary
    report.summary = {
      total_logs: filteredLogs.length,
      by_level: this.groupBy(filteredLogs, 'level'),
      by_category: this.groupBy(filteredLogs, 'category'),
      by_user: this.groupBy(filteredLogs, 'user_email'),
      time_range: {
        earliest: filteredLogs[0]?.timestamp,
        latest: filteredLogs[filteredLogs.length - 1]?.timestamp
      }
    };
    
    // Add logs (limited for performance)
    report.logs = filteredLogs.slice(-options.limit || 100);
    
    return report;
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }
}

// Initialize and export
const mmsAuditLogger = new MMSAuditLogger();

// Global logging functions
window.logSecurityEvent = async (event, details) => {
  return mmsAuditLogger.logSecurityEvent(event, details);
};

window.logDataAccess = async (collection, id, action) => {
  return mmsAuditLogger.logDataAccess(collection, id, action);
};

window.logDataModification = async (collection, id, action, changes) => {
  return mmsAuditLogger.logDataModification(collection, id, action, changes);
};

// Auto-log common events
document.addEventListener('DOMContentLoaded', () => {
  // Log page views
  mmsAuditLogger.log({
    level: mmsAuditLogger.AUDIT_LEVELS.INFO,
    category: mmsAuditLogger.AUDIT_CATEGORIES.SYSTEM,
    action: 'page_view',
    message: `Page loaded: ${document.title}`,
    details: {
      path: window.location.pathname,
      referrer: document.referrer || 'direct'
    }
  });
  
  // Log any errors
  window.addEventListener('error', (event) => {
    mmsAuditLogger.log({
      level: mmsAuditLogger.AUDIT_LEVELS.HIGH,
      category: mmsAuditLogger.AUDIT_CATEGORIES.SYSTEM,
      action: 'javascript_error',
      message: 'Unhandled JavaScript error',
      details: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString()
      }
    });
  });
  
  // Log offline/online events
  window.addEventListener('offline', () => {
    mmsAuditLogger.log({
      level: mmsAuditLogger.AUDIT_LEVELS.MEDIUM,
      category: mmsAuditLogger.AUDIT_CATEGORIES.SYSTEM,
      action: 'network_offline',
      message: 'Network connection lost',
      details: { timestamp: new Date().toISOString() }
    });
  });
  
  window.addEventListener('online', () => {
    mmsAuditLogger.log({
      level: mmsAuditLogger.AUDIT_LEVELS.INFO,
      category: mmsAuditLogger.AUDIT_CATEGORIES.SYSTEM,
      action: 'network_online',
      message: 'Network connection restored',
      details: { timestamp: new Date().toISOString() }
    });
  });
});

console.log('✅ MMS Audit Logger Ready');
