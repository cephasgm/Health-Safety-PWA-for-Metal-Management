// Performance Monitor - MMS Safety System
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: null,
      apiResponseTimes: [],
      memoryUsage: null,
      domSize: null,
      networkRequests: 0,
      errors: [],
      userActions: []
    };
    
    this.thresholds = {
      pageLoad: 3000, // 3 seconds
      apiResponse: 2000, // 2 seconds
      memoryWarning: 80, // 80% memory usage
      domWarning: 1500, // 1500 DOM nodes
      errorLimit: 10 // Max errors before alert
    };
    
    this.init();
  }

  init() {
    console.log('📊 Performance Monitor Initializing...');
    
    // Track page load performance
    this.trackPageLoad();
    
    // Monitor API calls
    this.monitorAPIRequests();
    
    // Track memory usage (if supported)
    this.monitorMemory();
    
    // Monitor DOM performance
    this.monitorDOM();
    
    // Track errors
    this.monitorErrors();
    
    // Track user interactions
    this.trackUserActions();
    
    // Start periodic reporting
    this.startPeriodicReports();
    
    console.log('✅ Performance Monitor Ready');
  }

  trackPageLoad() {
    window.addEventListener('load', () => {
      const loadTime = window.performance.timing.loadEventEnd - 
                      window.performance.timing.navigationStart;
      
      this.metrics.pageLoad = loadTime;
      
      if (loadTime > this.thresholds.pageLoad) {
        this.reportIssue('SLOW_PAGE_LOAD', {
          loadTime: loadTime,
          threshold: this.thresholds.pageLoad
        });
      }
      
      console.log(`📈 Page loaded in ${loadTime}ms`);
    });
  }

  monitorAPIRequests() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = performance.now();
      this.metrics.networkRequests++;
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.metrics.apiResponseTimes.push(responseTime);
        
        // Keep only last 100 measurements
        if (this.metrics.apiResponseTimes.length > 100) {
          this.metrics.apiResponseTimes.shift();
        }
        
        if (responseTime > this.thresholds.apiResponse) {
          this.reportIssue('SLOW_API_RESPONSE', {
            url: args[0],
            responseTime: responseTime,
            threshold: this.thresholds.apiResponse
          });
        }
        
        return response;
      } catch (error) {
        this.metrics.errors.push({
          type: 'API_ERROR',
          error: error.message,
          timestamp: new Date().toISOString(),
          url: args[0]
        });
        throw error;
      }
    };
  }

  monitorMemory() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const usedMB = memory.usedJSHeapSize / (1024 * 1024);
        const totalMB = memory.totalJSHeapSize / (1024 * 1024);
        const percentUsed = (usedMB / totalMB) * 100;
        
        this.metrics.memoryUsage = percentUsed;
        
        if (percentUsed > this.thresholds.memoryWarning) {
          this.reportIssue('HIGH_MEMORY_USAGE', {
            usedMB: usedMB.toFixed(2),
            totalMB: totalMB.toFixed(2),
            percentUsed: percentUsed.toFixed(2),
            threshold: this.thresholds.memoryWarning
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  monitorDOM() {
    setInterval(() => {
      const domNodes = document.getElementsByTagName('*').length;
      this.metrics.domSize = domNodes;
      
      if (domNodes > this.thresholds.domWarning) {
        this.reportIssue('LARGE_DOM_SIZE', {
          domNodes: domNodes,
          threshold: this.thresholds.domWarning
        });
      }
    }, 60000); // Check every minute
  }

  monitorErrors() {
    window.addEventListener('error', (event) => {
      this.metrics.errors.push({
        type: 'WINDOW_ERROR',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString()
      });
      
      if (this.metrics.errors.length > this.thresholds.errorLimit) {
        this.reportIssue('EXCESSIVE_ERRORS', {
          errorCount: this.metrics.errors.length,
          threshold: this.thresholds.errorLimit,
          recentErrors: this.metrics.errors.slice(-5)
        });
      }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.metrics.errors.push({
        type: 'UNHANDLED_REJECTION',
        reason: event.reason?.message || event.reason,
        timestamp: new Date().toISOString()
      });
    });
  }

  trackUserActions() {
    // Track button clicks
    document.addEventListener('click', (event) => {
      if (event.target.tagName === 'BUTTON' || event.target.tagName === 'A') {
        this.metrics.userActions.push({
          type: 'CLICK',
          element: event.target.tagName,
          text: event.target.textContent?.trim() || event.target.innerText?.trim(),
          id: event.target.id,
          className: event.target.className,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Track form submissions
    document.addEventListener('submit', (event) => {
      this.metrics.userActions.push({
        type: 'FORM_SUBMIT',
        formId: event.target.id,
        timestamp: new Date().toISOString()
      });
    });
  }

  startPeriodicReports() {
    // Send report every 5 minutes
    setInterval(() => {
      this.generateReport();
    }, 300000);
    
    // Also send report when page is hidden (user leaving)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.generateReport();
      }
    });
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      user: window.mmsAuth?.currentUser?.email || 'anonymous',
      metrics: {
        pageLoad: this.metrics.pageLoad,
        avgApiResponse: this.calculateAverage(this.metrics.apiResponseTimes),
        memoryUsage: this.metrics.memoryUsage,
        domSize: this.metrics.domSize,
        networkRequests: this.metrics.networkRequests,
        errorCount: this.metrics.errors.length,
        userActionCount: this.metrics.userActions.length
      },
      issues: this.checkForIssues()
    };
    
    // Send to analytics (Firebase or console)
    this.sendReport(report);
    
    // Reset counters for next period
    this.metrics.networkRequests = 0;
    this.metrics.errors = [];
    this.metrics.userActions = [];
    
    return report;
  }

  calculateAverage(array) {
    if (array.length === 0) return 0;
    const sum = array.reduce((a, b) => a + b, 0);
    return sum / array.length;
  }

  checkForIssues() {
    const issues = [];
    
    if (this.metrics.pageLoad > this.thresholds.pageLoad) {
      issues.push('SLOW_PAGE_LOAD');
    }
    
    const avgApi = this.calculateAverage(this.metrics.apiResponseTimes);
    if (avgApi > this.thresholds.apiResponse) {
      issues.push('SLOW_API_RESPONSE');
    }
    
    if (this.metrics.memoryUsage > this.thresholds.memoryWarning) {
      issues.push('HIGH_MEMORY_USAGE');
    }
    
    if (this.metrics.domSize > this.thresholds.domWarning) {
      issues.push('LARGE_DOM_SIZE');
    }
    
    if (this.metrics.errors.length > this.thresholds.errorLimit) {
      issues.push('EXCESSIVE_ERRORS');
    }
    
    return issues;
  }

  reportIssue(issueType, details) {
    const issue = {
      type: issueType,
      timestamp: new Date().toISOString(),
      details: details,
      severity: this.getIssueSeverity(issueType)
    };
    
    // Log to console
    console.warn(`⚠️ Performance Issue: ${issueType}`, details);
    
    // Send to error tracking
    if (window.mmsDB) {
      window.mmsDB.logSystemAction(`performance_issue_${issueType.toLowerCase()}`, details);
    }
    
    // Show user warning for critical issues
    if (issue.severity === 'CRITICAL') {
      this.showUserWarning(issueType, details);
    }
    
    return issue;
  }

  getIssueSeverity(issueType) {
    const critical = ['EXCESSIVE_ERRORS', 'HIGH_MEMORY_USAGE'];
    const warning = ['SLOW_PAGE_LOAD', 'SLOW_API_RESPONSE', 'LARGE_DOM_SIZE'];
    
    if (critical.includes(issueType)) return 'CRITICAL';
    if (warning.includes(issueType)) return 'WARNING';
    return 'INFO';
  }

  showUserWarning(issueType, details) {
    // Don't show during login
    if (document.getElementById('loginScreen')?.style.display === 'flex') {
      return;
    }
    
    const warning = document.createElement('div');
    warning.id = 'performanceWarning';
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 10px;
      padding: 15px;
      max-width: 300px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      animation: slideInRight 0.3s ease;
    `;
    
    let message = '';
    switch(issueType) {
      case 'EXCESSIVE_ERRORS':
        message = 'System experiencing issues. Some features may not work correctly.';
        break;
      case 'HIGH_MEMORY_USAGE':
        message = 'High memory usage detected. Consider closing other tabs.';
        break;
      default:
        message = 'Performance issue detected.';
    }
    
    warning.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="font-size: 1.5rem;">⚠️</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 5px;">Performance Notice</div>
          <div style="font-size: 0.9rem; color: #92400e;">${message}</div>
          <button onclick="this.parentElement.parentElement.remove()" 
                  style="margin-top: 10px; padding: 5px 10px; background: #f59e0b; border: none; border-radius: 4px; color: white; font-size: 0.8rem; cursor: pointer;">
            Dismiss
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => warning.remove(), 300);
      }
    }, 10000);
  }

  sendReport(report) {
    // Send to Firebase
    if (window.mmsDB && window.mmsAuth?.currentUser) {
      window.mmsDB.logSystemAction('performance_report', report);
    }
    
    // Send to console in development
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('github.io')) {
      console.group('📊 Performance Report');
      console.log('Timestamp:', report.timestamp);
      console.log('Metrics:', report.metrics);
      if (report.issues.length > 0) {
        console.warn('Issues:', report.issues);
      }
      console.groupEnd();
    }
  }

  // Public API
  getMetrics() {
    return {
      ...this.metrics,
      issues: this.checkForIssues(),
      healthScore: this.calculateHealthScore()
    };
  }

  calculateHealthScore() {
    let score = 100;
    
    // Deduct for issues
    if (this.metrics.pageLoad > this.thresholds.pageLoad) score -= 10;
    
    const avgApi = this.calculateAverage(this.metrics.apiResponseTimes);
    if (avgApi > this.thresholds.apiResponse) score -= 10;
    
    if (this.metrics.memoryUsage > this.thresholds.memoryWarning) score -= 15;
    if (this.metrics.domSize > this.thresholds.domWarning) score -= 10;
    if (this.metrics.errors.length > this.thresholds.errorLimit) score -= 20;
    
    return Math.max(0, score);
  }

  showPerformancePanel() {
    const panel = document.createElement('div');
    panel.id = 'performancePanel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 10px;
      padding: 15px;
      z-index: 9998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      min-width: 250px;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    
    const metrics = this.getMetrics();
    
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="font-weight: 600; color: #1e293b;">Performance Monitor</div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">×</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
          <div style="width: 100px; font-size: 0.85rem; color: #64748b;">Health Score:</div>
          <div style="font-weight: 600; color: ${metrics.healthScore > 80 ? '#10b981' : metrics.healthScore > 60 ? '#f59e0b' : '#ef4444'}">
            ${metrics.healthScore}/100
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
          <div style="width: 100px; font-size: 0.85rem; color: #64748b;">Page Load:</div>
          <div style="font-weight: 500; color: ${metrics.pageLoad < 2000 ? '#10b981' : '#f59e0b'}">
            ${metrics.pageLoad ? metrics.pageLoad + 'ms' : 'N/A'}
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
          <div style="width: 100px; font-size: 0.85rem; color: #64748b;">API Response:</div>
          <div style="font-weight: 500; color: ${metrics.avgApiResponse < 1000 ? '#10b981' : '#f59e0b'}">
            ${metrics.avgApiResponse ? Math.round(metrics.avgApiResponse) + 'ms' : 'N/A'}
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
          <div style="width: 100px; font-size: 0.85rem; color: #64748b;">Memory:</div>
          <div style="font-weight: 500; color: ${metrics.memoryUsage < 70 ? '#10b981' : '#f59e0b'}">
            ${metrics.memoryUsage ? Math.round(metrics.memoryUsage) + '%' : 'N/A'}
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
          <div style="width: 100px; font-size: 0.85rem; color: #64748b;">DOM Nodes:</div>
          <div style="font-weight: 500; color: ${metrics.domSize < 1000 ? '#10b981' : '#f59e0b'}">
            ${metrics.domSize || 'N/A'}
          </div>
        </div>
      </div>
      
      ${metrics.issues.length > 0 ? `
        <div style="background: #fee2e2; padding: 8px; border-radius: 6px; margin-top: 10px;">
          <div style="font-size: 0.85rem; color: #991b1b; font-weight: 500;">Issues: ${metrics.issues.join(', ')}</div>
        </div>
      ` : ''}
      
      <button onclick="window.performanceMonitor.generateReport()" 
              style="margin-top: 10px; width: 100%; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">
        Generate Report
      </button>
    `;
    
    document.body.appendChild(panel);
  }
}

// Initialize and export
const performanceMonitor = new PerformanceMonitor();
window.performanceMonitor = performanceMonitor;

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Add performance panel toggle (Shift + P)
document.addEventListener('keydown', (event) => {
  if (event.shiftKey && event.key === 'P') {
    event.preventDefault();
    const existingPanel = document.getElementById('performancePanel');
    if (existingPanel) {
      existingPanel.remove();
    } else {
      performanceMonitor.showPerformancePanel();
    }
  }
});

console.log('✅ Performance Monitor Loaded (Shift+P to toggle panel)');
