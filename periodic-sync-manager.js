// Periodic Sync Manager - MMS Safety System
// Auto-updates safety standards, training, and compliance data

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class PeriodicSyncManager {
  constructor() {
    this.syncIntervals = {
      standards: 24 * 60 * 60 * 1000,    // 24 hours
      training: 12 * 60 * 60 * 1000,     // 12 hours
      incidents: 2 * 60 * 60 * 1000,     // 2 hours
      employees: 6 * 60 * 60 * 1000      // 6 hours
    };
    
    this.lastSync = {
      standards: null,
      training: null,
      incidents: null,
      employees: null
    };
    
    this.init();
  }

  init() {
    console.log('🔄 Periodic Sync Manager Initializing...');
    
    // Load last sync times from localStorage
    this.loadSyncTimes();
    
    // Set up periodic sync
    this.setupPeriodicSync();
    
    // Register for background sync if supported
    this.registerBackgroundSync();
    
    console.log('✅ Periodic Sync Manager Ready');
  }

  loadSyncTimes() {
    const saved = localStorage.getItem('mms_sync_times');
    if (saved) {
      this.lastSync = JSON.parse(saved);
      console.log('📅 Loaded previous sync times:', this.lastSync);
    }
  }

  saveSyncTimes() {
    localStorage.setItem('mms_sync_times', JSON.stringify(this.lastSync));
  }

  setupPeriodicSync() {
    // Check for updates every 30 minutes
    setInterval(() => {
      this.checkForUpdates();
    }, 30 * 60 * 1000); // 30 minutes
    
    // Also check when app becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkForUpdates();
      }
    });
    
    // Check on network reconnection
    window.addEventListener('online', () => {
      console.log('🌐 Network restored, checking for updates...');
      this.checkForUpdates();
    });
  }

  async checkForUpdates() {
    if (!navigator.onLine) {
      console.log('📴 Offline - skipping update check');
      return;
    }
    
    const now = Date.now();
    const updates = [];
    
    // Check standards updates (24h interval)
    if (!this.lastSync.standards || (now - this.lastSync.standards) > this.syncIntervals.standards) {
      updates.push(this.syncStandards());
    }
    
    // Check training updates (12h interval)
    if (!this.lastSync.training || (now - this.lastSync.training) > this.syncIntervals.training) {
      updates.push(this.syncTrainingRecords());
    }
    
    // Check incident updates (2h interval)
    if (!this.lastSync.incidents || (now - this.lastSync.incidents) > this.syncIntervals.incidents) {
      updates.push(this.syncRecentIncidents());
    }
    
    // Check employee updates (6h interval)
    if (!this.lastSync.employees || (now - this.lastSync.employees) > this.syncIntervals.employees) {
      updates.push(this.syncEmployeeHealth());
    }
    
    if (updates.length > 0) {
      console.log(`🔄 Starting ${updates.length} periodic sync(s)...`);
      
      try {
        const results = await Promise.allSettled(updates);
        this.processSyncResults(results);
      } catch (error) {
        console.error('❌ Periodic sync failed:', error);
      }
    }
  }

  async syncStandards() {
    try {
      console.log('📋 Syncing safety standards...');
      
      const q = query(
        collection(db, 'safety_standards'),
        where('company', '==', 'mms_metal_management'),
        orderBy('updated_at', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const standards = [];
      
      snapshot.forEach(doc => {
        standards.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Update localStorage with latest standards
      localStorage.setItem('mms_safety_standards', JSON.stringify(standards));
      
      // Update last sync time
      this.lastSync.standards = Date.now();
      this.saveSyncTimes();
      
      console.log(`✅ Standards sync complete: ${standards.length} standards`);
      
      // Trigger UI update if needed
      if (window.updateStandardsDisplay) {
        window.updateStandardsDisplay(standards);
      }
      
      return {
        type: 'standards',
        count: standards.length,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Standards sync failed:', error);
      return {
        type: 'standards',
        success: false,
        error: error.message
      };
    }
  }

  async syncTrainingRecords() {
    try {
      console.log('🎓 Syncing training records...');
      
      const q = query(
        collection(db, 'training_records'),
        where('company', '==', 'mms_metal_management'),
        where('expiry_date', '>=', Timestamp.fromDate(new Date())),
        orderBy('expiry_date', 'asc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const training = [];
      const expiringSoon = [];
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      snapshot.forEach(doc => {
        const record = doc.data();
        training.push({
          id: doc.id,
          ...record
        });
        
        // Check if expiring within 30 days
        if (record.expiry_date) {
          const expiryDate = record.expiry_date.toDate();
          if (expiryDate <= thirtyDaysFromNow) {
            expiringSoon.push({
              employee: record.employee_name || 'Unknown',
              training: record.training_type || 'Unknown',
              expiry: expiryDate.toISOString().split('T')[0]
            });
          }
        }
      });
      
      // Save to localStorage
      localStorage.setItem('mms_training_records', JSON.stringify(training));
      
      // Update last sync time
      this.lastSync.training = Date.now();
      this.saveSyncTimes();
      
      console.log(`✅ Training sync complete: ${training.length} records`);
      
      // Show notification for expiring training
      if (expiringSoon.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🎓 ${expiringSoon.length} Training(s) Expiring Soon`, {
          body: `Check training module for details`,
          icon: './icon-192x192.png',
          tag: 'training-expiry'
        });
      }
      
      return {
        type: 'training',
        count: training.length,
        expiring: expiringSoon.length,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Training sync failed:', error);
      return {
        type: 'training',
        success: false,
        error: error.message
      };
    }
  }

  async syncRecentIncidents() {
    try {
      console.log('🚨 Syncing recent incidents...');
      
      const q = query(
        collection(db, 'incidents'),
        where('company', '==', 'mms_metal_management'),
        orderBy('created_at', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const incidents = [];
      const newIncidents = [];
      
      // Get previous incidents for comparison
      const previousIncidents = JSON.parse(localStorage.getItem('mms_recent_incidents') || '[]');
      const previousIds = previousIncidents.map(i => i.id);
      
      snapshot.forEach(doc => {
        const incident = {
          id: doc.id,
          ...doc.data(),
          created_at: doc.data().created_at?.toDate?.()?.toISOString()
        };
        
        incidents.push(incident);
        
        // Check if this is a new incident (not in previous sync)
        if (!previousIds.includes(doc.id)) {
          newIncidents.push(incident);
        }
      });
      
      // Save to localStorage
      localStorage.setItem('mms_recent_incidents', JSON.stringify(incidents));
      
      // Update last sync time
      this.lastSync.incidents = Date.now();
      this.saveSyncTimes();
      
      console.log(`✅ Incidents sync complete: ${incidents.length} incidents, ${newIncidents.length} new`);
      
      return {
        type: 'incidents',
        count: incidents.length,
        new: newIncidents.length,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Incidents sync failed:', error);
      return {
        type: 'incidents',
        success: false,
        error: error.message
      };
    }
  }

  async syncEmployeeHealth() {
    try {
      console.log('👥 Syncing employee health records...');
      
      const q = query(
        collection(db, 'employees'),
        where('company', '==', 'mms_metal_management'),
        orderBy('next_medical_due', 'asc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const employees = [];
      const overdueMedical = [];
      
      snapshot.forEach(doc => {
        const employee = doc.data();
        employees.push({
          id: doc.id,
          ...employee
        });
        
        // Check for overdue medical exams
        if (employee.next_medical_due) {
          const dueDate = new Date(employee.next_medical_due);
          if (dueDate < new Date()) {
            overdueMedical.push({
              name: employee.name || 'Unknown',
              location: employee.location || 'Unknown',
              dueSince: this.formatDaysAgo(dueDate)
            });
          }
        }
      });
      
      // Save to localStorage
      localStorage.setItem('mms_employee_health', JSON.stringify(employees));
      
      // Update last sync time
      this.lastSync.employees = Date.now();
      this.saveSyncTimes();
      
      console.log(`✅ Employee sync complete: ${employees.length} records`);
      
      // Show notification for overdue medical exams
      if (overdueMedical.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🏥 ${overdueMedical.length} Medical Exam(s) Overdue`, {
          body: 'Check employee health module',
          icon: './icon-192x192.png',
          tag: 'medical-overdue'
        });
      }
      
      return {
        type: 'employees',
        count: employees.length,
        overdue: overdueMedical.length,
        success: true
      };
      
    } catch (error) {
      console.error('❌ Employee sync failed:', error);
      return {
        type: 'employees',
        success: false,
        error: error.message
      };
    }
  }

  processSyncResults(results) {
    const summary = {
      successful: 0,
      failed: 0,
      details: []
    };
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        summary.successful++;
        summary.details.push(result.value);
      } else {
        summary.failed++;
        summary.details.push({
          type: 'unknown',
          success: false,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    console.log(`📊 Sync Summary: ${summary.successful} successful, ${summary.failed} failed`);
    
    // Update sync indicator in UI
    this.updateSyncIndicator(summary);
    
    return summary;
  }

  updateSyncIndicator(summary) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    
    if (summary.failed > 0) {
      indicator.innerHTML = '⚠️ Sync Issues';
      indicator.style.color = '#f59e0b';
    } else if (summary.successful > 0) {
      indicator.innerHTML = '✅ Synced';
      indicator.style.color = '#10b981';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        indicator.innerHTML = '🔄';
        indicator.style.color = '#6b7280';
      }, 3000);
    }
  }

  registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.periodicSync.register('daily-sync', {
          minInterval: 24 * 60 * 60 * 1000 // 24 hours
        }).then(() => {
          console.log('✅ Registered for daily background sync');
        }).catch(err => {
          console.log('❌ Periodic sync registration failed:', err);
        });
      });
    }
  }

  // Manual sync trigger
  async triggerManualSync(type = 'all') {
    console.log(`🔄 Manual sync triggered for: ${type}`);
    
    const syncTasks = [];
    
    if (type === 'all' || type === 'standards') {
      syncTasks.push(this.syncStandards());
    }
    
    if (type === 'all' || type === 'training') {
      syncTasks.push(this.syncTrainingRecords());
    }
    
    if (type === 'all' || type === 'incidents') {
      syncTasks.push(this.syncRecentIncidents());
    }
    
    if (type === 'all' || type === 'employees') {
      syncTasks.push(this.syncEmployeeHealth());
    }
    
    // Show loading state
    const button = event?.target;
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = '🔄 Syncing...';
      button.disabled = true;
      
      try {
        const results = await Promise.allSettled(syncTasks);
        const summary = this.processSyncResults(results);
        
        button.innerHTML = summary.failed > 0 ? '⚠️ Done' : '✅ Synced';
        button.style.background = summary.failed > 0 ? '#fef3c7' : '#dcfce7';
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.disabled = false;
          button.style.background = '';
        }, 3000);
        
      } catch (error) {
        button.innerHTML = '❌ Error';
        button.disabled = false;
        console.error('Manual sync failed:', error);
      }
    } else {
      // Just run without UI feedback
      await Promise.allSettled(syncTasks);
    }
  }

  formatDaysAgo(date) {
    const days = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }

  getSyncStatus() {
    const now = Date.now();
    const status = {};
    
    Object.keys(this.lastSync).forEach(key => {
      if (this.lastSync[key]) {
        const hoursAgo = Math.floor((now - this.lastSync[key]) / (1000 * 60 * 60));
        status[key] = {
          lastSync: new Date(this.lastSync[key]).toLocaleString(),
          hoursAgo: hoursAgo,
          needsSync: hoursAgo > (this.syncIntervals[key] / (1000 * 60 * 60))
        };
      } else {
        status[key] = {
          lastSync: 'Never',
          hoursAgo: null,
          needsSync: true
        };
      }
    });
    
    return status;
  }
}

// Create and export instance
const periodicSync = new PeriodicSyncManager();

// Global functions
window.periodicSync = periodicSync;
window.triggerSync = (type) => periodicSync.triggerManualSync(type);
window.getSyncStatus = () => periodicSync.getSyncStatus();

// Add sync indicator to UI automatically
document.addEventListener('DOMContentLoaded', () => {
  // Add sync indicator to header if it doesn't exist
  if (!document.getElementById('syncIndicator')) {
    const header = document.querySelector('.header');
    if (header) {
      const syncDiv = document.createElement('div');
      syncDiv.id = 'syncIndicator';
      syncDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 6px;
        transition: all 0.3s;
      `;
      syncDiv.innerHTML = '🔄';
      syncDiv.title = 'Last sync: Never';
      syncDiv.onclick = () => periodicSync.triggerManualSync('all');
      syncDiv.onmouseover = () => syncDiv.style.background = '#f1f5f9';
      syncDiv.onmouseout = () => syncDiv.style.background = '';
      
      header.appendChild(syncDiv);
    }
  }
});

console.log('✅ Periodic Sync Manager Loaded');
