// MMS Safety - Background Sync & Offline Support
// Queue and sync data when offline

class BackgroundSyncManager {
  constructor() {
    this.syncSupported = 'serviceWorker' in navigator && 'SyncManager' in window;
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    this.syncTags = {
      INCIDENTS: 'sync-incidents',
      TRAINING: 'sync-training',
      EMPLOYEES: 'sync-employees',
      AUDITS: 'sync-audits'
    };
    
    this.init();
  }

  init() {
    console.log('🔄 Initializing background sync manager...');
    
    // Load existing queue from storage
    this.loadOfflineQueue();
    
    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Setup sync event listeners
    if (this.syncSupported) {
      this.setupSyncEventListeners();
    }
    
    // Check for pending syncs
    this.checkPendingSyncs();
  }

  async loadOfflineQueue() {
    try {
      const savedQueue = localStorage.getItem('mmsOfflineQueue');
      this.offlineQueue = savedQueue ? JSON.parse(savedQueue) : [];
      
      console.log(`📋 Loaded ${this.offlineQueue.length} items from offline queue`);
      
      // Process any items that might have failed previously
      if (this.offlineQueue.length > 0 && this.isOnline) {
        setTimeout(() => this.processOfflineQueue(), 2000);
      }
    } catch (error) {
      console.error('❌ Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  saveOfflineQueue() {
    try {
      localStorage.setItem('mmsOfflineQueue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('❌ Failed to save offline queue:', error);
    }
  }

  async queueForSync(data, type, options = {}) {
    const queueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      data: data,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      priority: options.priority || 'normal',
      metadata: options.metadata || {}
    };

    // Add to queue
    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();
    
    console.log(`📝 Queued ${type} for sync (ID: ${queueItem.id})`);
    
    // Register for background sync if supported
    if (this.syncSupported && this.isOnline) {
      await this.registerBackgroundSync(type);
    }
    
    // Show user feedback
    if (!this.isOnline) {
      this.showOfflineNotification();
    }
    
    return queueItem.id;
  }

  async registerBackgroundSync(tag) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if sync is already registered
      const tags = await registration.sync.getTags();
      
      if (!tags.includes(tag)) {
        await registration.sync.register(tag);
        console.log(`✅ Registered background sync for: ${tag}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to register background sync for ${tag}:`, error);
      return false;
    }
  }

  setupSyncEventListeners() {
    // Listen for sync events from service worker
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETED') {
        await this.handleSyncCompleted(event.data);
      }
      
      if (event.data && event.data.type === 'SYNC_FAILED') {
        await this.handleSyncFailed(event.data);
      }
    });
  }

  async handleSyncCompleted(syncData) {
    console.log(`✅ Background sync completed: ${syncData.tag}`);
    
    // Process the specific sync tag
    switch(syncData.tag) {
      case this.syncTags.INCIDENTS:
        await this.processIncidentSync();
        break;
      case this.syncTags.TRAINING:
        await this.processTrainingSync();
        break;
      case this.syncTags.EMPLOYEES:
        await this.processEmployeeSync();
        break;
      case this.syncTags.AUDITS:
        await this.processAuditSync();
        break;
    }
    
    // Update UI
    this.updateSyncStatus();
  }

  async handleSyncFailed(syncData) {
    console.error(`❌ Background sync failed: ${syncData.tag}`, syncData.error);
    
    // Retry logic
    if (syncData.retryCount < 3) {
      console.log(`🔄 Retrying sync for ${syncData.tag} (attempt ${syncData.retryCount + 1})`);
      
      setTimeout(async () => {
        await this.registerBackgroundSync(syncData.tag);
      }, 5000 * (syncData.retryCount + 1)); // Exponential backoff
    } else {
      console.error(`🚨 Max retries reached for ${syncData.tag}`);
      this.showSyncErrorNotification(syncData.tag);
    }
  }

  async processOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.isOnline) {
      return;
    }

    console.log(`🔄 Processing offline queue (${this.offlineQueue.length} items)`);
    
    // Sort by priority and timestamp
    this.offlineQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || 
             new Date(a.timestamp) - new Date(b.timestamp);
    });

    const successfulItems = [];
    const failedItems = [];

    // Process each item
    for (const item of [...this.offlineQueue]) {
      try {
        const success = await this.processQueueItem(item);
        
        if (success) {
          successfulItems.push(item);
          this.removeFromQueue(item.id);
        } else {
          item.attempts++;
          
          if (item.attempts >= item.maxAttempts) {
            console.error(`🚨 Max attempts reached for item ${item.id}`);
            failedItems.push(item);
            this.removeFromQueue(item.id);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing queue item ${item.id}:`, error);
        item.attempts++;
        
        if (item.attempts >= item.maxAttempts) {
          failedItems.push(item);
          this.removeFromQueue(item.id);
        }
      }
      
      // Small delay between items to avoid overwhelming server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Save updated queue
    this.saveOfflineQueue();
    
    // Show results
    if (successfulItems.length > 0) {
      this.showSyncSuccessNotification(successfulItems.length);
    }
    
    if (failedItems.length > 0) {
      this.showPermanentFailuresNotification(failedItems);
    }
    
    console.log(`✅ Sync completed: ${successfulItems.length} successful, ${failedItems.length} failed`);
  }

  async processQueueItem(item) {
    console.log(`🔄 Processing ${item.type}: ${item.id}`);
    
    try {
      switch(item.type) {
        case 'incident_report':
          return await this.syncIncidentReport(item);
          
        case 'training_record':
          return await this.syncTrainingRecord(item);
          
        case 'employee_update':
          return await this.syncEmployeeUpdate(item);
          
        case 'audit_record':
          return await this.syncAuditRecord(item);
          
        case 'ppe_issuance':
          return await this.syncPPEIssuance(item);
          
        case 'file_upload':
          return await this.syncFileUpload(item);
          
        default:
          console.warn(`⚠️ Unknown sync type: ${item.type}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Failed to process ${item.type}:`, error);
      return false;
    }
  }

  async syncIncidentReport(item) {
    if (!window.mmsDB) {
      throw new Error('Database service not available');
    }
    
    const result = await window.mmsDB.createIncident(item.data);
    
    if (result.success) {
      // Log successful sync
      if (window.mmsDB.logAction) {
        await window.mmsDB.logAction('incident_synced', {
          offline_id: item.id,
          cloud_id: result.id,
          type: item.data.type,
          location: item.data.location
        });
      }
      
      return true;
    } else {
      throw new Error(result.error || 'Failed to sync incident');
    }
  }

  async syncTrainingRecord(item) {
    // Implement training record sync
    console.log('Syncing training record:', item.data);
    return true; // Placeholder
  }

  async syncEmployeeUpdate(item) {
    // Implement employee update sync
    console.log('Syncing employee update:', item.data);
    return true; // Placeholder
  }

  async syncAuditRecord(item) {
    // Implement audit record sync
    console.log('Syncing audit record:', item.data);
    return true; // Placeholder
  }

  async syncPPEIssuance(item) {
    // Implement PPE issuance sync
    console.log('Syncing PPE issuance:', item.data);
    return true; // Placeholder
  }

  async syncFileUpload(item) {
    // Implement file upload sync
    console.log('Syncing file upload:', item.data);
    return true; // Placeholder
  }

  removeFromQueue(itemId) {
    const index = this.offlineQueue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      this.offlineQueue.splice(index, 1);
    }
  }

  handleOnline() {
    console.log('🌐 Device is online');
    this.isOnline = true;
    this.updateConnectionStatus();
    
    // Process any pending queue items
    setTimeout(() => this.processOfflineQueue(), 1000);
    
    // Register all sync tags
    if (this.syncSupported) {
      Object.values(this.syncTags).forEach(tag => {
        this.registerBackgroundSync(tag);
      });
    }
  }

  handleOffline() {
    console.log('📴 Device is offline');
    this.isOnline = false;
    this.updateConnectionStatus();
    
    // Show offline notification
    this.showOfflineNotification();
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.innerHTML = this.isOnline 
        ? '<span style="color: #10b981;">✅ Online</span>' 
        : '<span style="color: #ef4444;">📴 Offline</span>';
      
      statusElement.title = this.isOnline 
        ? 'Connected to server' 
        : 'Working offline - changes will sync when online';
    }
    
    // Update sync button visibility
    const syncButton = document.getElementById('manualSyncButton');
    if (syncButton) {
      syncButton.disabled = !this.isOnline;
      syncButton.title = this.isOnline 
        ? 'Sync all pending changes' 
        : 'Sync unavailable - you are offline';
    }
  }

  updateSyncStatus() {
    const statusElement = document.getElementById('syncStatus');
    if (statusElement) {
      const pendingCount = this.offlineQueue.length;
      
      if (pendingCount === 0) {
        statusElement.innerHTML = '<span style="color: #10b981;">✅ Synced</span>';
        statusElement.title = 'All data is synchronized';
      } else if (this.isOnline) {
        statusElement.innerHTML = `<span style="color: #f59e0b;">🔄 ${pendingCount} pending</span>`;
        statusElement.title = `${pendingCount} items waiting to sync`;
      } else {
        statusElement.innerHTML = `<span style="color: #ef4444;">📴 ${pendingCount} offline</span>`;
        statusElement.title = `${pendingCount} items saved offline`;
      }
    }
  }

  showOfflineNotification() {
    if (this.offlineQueue.length === 1) {
      // First offline item
      showToast('📱 Working offline - Changes will sync when online', 'info', 4000);
    }
  }

  showSyncSuccessNotification(count) {
    showToast(`✅ ${count} item${count > 1 ? 's' : ''} synced to cloud`, 'success');
  }

  showSyncErrorNotification(tag) {
    showToast(`❌ Sync failed for ${tag}. Please check connection.`, 'error');
  }

  showPermanentFailuresNotification(failedItems) {
    if (failedItems.length > 0) {
      console.error('🚨 Permanent sync failures:', failedItems);
      
      const errorList = failedItems.map(item => 
        `${item.type} (${new Date(item.timestamp).toLocaleTimeString()})`
      ).join('\n');
      
      showToast(
        `❌ ${failedItems.length} items failed to sync after multiple attempts. ` +
        'Please report to IT.',
        'error',
        5000
      );
    }
  }

  getQueueStats() {
    return {
      total: this.offlineQueue.length,
      byType: this.offlineQueue.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
      byPriority: this.offlineQueue.reduce((acc, item) => {
        acc[item.priority] = (acc[item.priority] || 0) + 1;
        return acc;
      }, {}),
      oldest: this.offlineQueue.length > 0 
        ? new Date(this.offlineQueue[0].timestamp) 
        : null
    };
  }

  async forceSync() {
    if (!this.isOnline) {
      showToast('Cannot sync - you are offline', 'error');
      return false;
    }

    showToast('🔄 Syncing all pending changes...', 'info');
    
    // Trigger all sync tags
    if (this.syncSupported) {
      await Promise.all(
        Object.values(this.syncTags).map(tag => 
          this.registerBackgroundSync(tag)
        )
      );
    }
    
    // Process queue immediately
    await this.processOfflineQueue();
    
    return true;
  }

  clearQueue() {
    const confirmClear = confirm(
      'Clear all pending sync items?\n\n' +
      `This will remove ${this.offlineQueue.length} items waiting to sync.\n` +
      'Only do this if you are sure the data is already saved elsewhere.'
    );
    
    if (confirmClear) {
      this.offlineQueue = [];
      this.saveOfflineQueue();
      this.updateSyncStatus();
      showToast('🗑️ Sync queue cleared', 'info');
    }
  }
}

// Helper function for toast notifications
function showToast(message, type = 'info', duration = 3000) {
  // Implementation depends on your existing toast system
  console.log(`Toast [${type}]: ${message}`);
  
  // Fallback alert if no toast system
  if (!window.showToast) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6',
      warning: '#f59e0b'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${colors[type] || '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: fadeIn 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Create and export instance
const backgroundSync = new BackgroundSyncManager();

// Global functions for UI
window.forceSyncNow = function() {
  backgroundSync.forceSync();
};

window.showSyncStatus = function() {
  const stats = backgroundSync.getQueueStats();
  
  let message = `📊 Sync Status:\n\n`;
  message += `• Online: ${backgroundSync.isOnline ? '✅ Yes' : '❌ No'}\n`;
  message += `• Pending items: ${stats.total}\n\n`;
  
  if (stats.total > 0) {
    message += `By type:\n`;
    Object.entries(stats.byType).forEach(([type, count]) => {
      message += `  • ${type}: ${count}\n`;
    });
    
    message += `\nBy priority:\n`;
    Object.entries(stats.byPriority).forEach(([priority, count]) => {
      message += `  • ${priority}: ${count}\n`;
    });
    
    if (stats.oldest) {
      const hoursOld = Math.floor((new Date() - stats.oldest) / (1000 * 60 * 60));
      message += `\n⏰ Oldest item: ${hoursOld} hour${hoursOld !== 1 ? 's' : ''} ago`;
    }
  } else {
    message += `✅ All data is synchronized`;
  }
  
  alert(message);
};

window.clearSyncQueue = function() {
  backgroundSync.clearQueue();
};

// Make globally available
window.backgroundSync = backgroundSync;

console.log('✅ Background Sync Manager Ready');
