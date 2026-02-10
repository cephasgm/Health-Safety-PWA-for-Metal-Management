// MMS Safety - Push Notification System
// Real-time incident alerts and safety notifications

class SafetyPushNotifications {
  constructor() {
    this.notificationPermission = null;
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.vapidKey = null; // Will be set from Firebase Cloud Messaging
    this.init();
  }

  async init() {
    if (!this.isSupported) {
      console.warn('⚠️ Push notifications not supported in this browser');
      return;
    }

    console.log('🔔 Initializing push notification system...');
    
    // Check current permission
    this.notificationPermission = Notification.permission;
    
    if (this.notificationPermission === 'default') {
      // Will request permission on first incident report
      console.log('📱 Push permission not yet requested');
    } else if (this.notificationPermission === 'granted') {
      console.log('✅ Push notifications enabled');
      await this.registerServiceWorkerForPush();
    } else {
      console.log('❌ Push notifications blocked by user');
    }

    // Listen for new incidents (Firebase Firestore real-time updates)
    this.setupIncidentListeners();
    
    // Setup notification click handlers
    this.setupNotificationClickHandler();
  }

  async requestPermission() {
    if (!this.isSupported) {
      return { granted: false, reason: 'not_supported' };
    }

    try {
      const permission = await Notification.requestPermission();
      this.notificationPermission = permission;
      
      if (permission === 'granted') {
        console.log('✅ User granted push notification permission');
        await this.registerServiceWorkerForPush();
        await this.subscribeToPushNotifications();
        return { granted: true };
      } else {
        console.log('❌ User denied push notification permission');
        return { granted: false, reason: 'user_denied' };
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return { granted: false, reason: 'error', error: error.message };
    }
  }

  async registerServiceWorkerForPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if push manager is available
      if (!registration.pushManager) {
        console.warn('⚠️ Push Manager not available');
        return null;
      }

      // Get existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const vapidPublicKey = await this.getVAPIDPublicKey();
        
        if (!vapidPublicKey) {
          console.warn('⚠️ VAPID public key not configured');
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });

        console.log('✅ Subscribed to push notifications');
        
        // Send subscription to server (in real app, send to your backend)
        await this.saveSubscriptionToServer(subscription);
      } else {
        console.log('✅ Already subscribed to push notifications');
      }

      return subscription;
    } catch (error) {
      console.error('❌ Error registering for push:', error);
      return null;
    }
  }

  async subscribeToPushNotifications() {
    // This would connect to Firebase Cloud Messaging in production
    // For now, we'll use a simpler approach
    console.log('📡 Setting up push notification listeners');
    
    // In production, you would:
    // 1. Get FCM token from Firebase
    // 2. Subscribe to topics (location-specific, incident types, etc.)
    // 3. Handle incoming messages in service worker
  }

  async getVAPIDPublicKey() {
    // In production, get this from Firebase Cloud Messaging or your server
    // For demo purposes, we'll use a placeholder
    // Generate at: https://web-push-codelab.glitch.me/
    
    return 'BLx8Nnl7eVTkPT4d7mBdYwC6hiI1Jp5B-LmR77P7X7UuF7zQ8q0Q8W7nBdYwC6hiI1Jp5B-LmR77P7X7UuF7zQ';
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async saveSubscriptionToServer(subscription) {
    // In production, send to your backend/Firebase
    // For demo, save to localStorage
    try {
      localStorage.setItem('pushSubscription', JSON.stringify(subscription));
      console.log('💾 Saved push subscription locally');
    } catch (error) {
      console.error('❌ Failed to save subscription:', error);
    }
  }

  setupIncidentListeners() {
    // Listen for new incidents from database
    if (window.mmsDB) {
      // This would be real Firestore listener in production
      console.log('👂 Setting up incident listeners for push notifications');
      
      // Simulate listening - in production, use Firestore onSnapshot
      window.addEventListener('incidentReported', (event) => {
        this.sendIncidentNotification(event.detail);
      });
    }
  }

  async sendIncidentNotification(incidentData) {
    if (!this.isSupported || this.notificationPermission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const notificationOptions = {
        body: `${incidentData.type} at ${incidentData.location}`,
        icon: './icon-192x192.png',
        badge: './icon-72x72.png',
        tag: `incident-${incidentData.id}`,
        timestamp: Date.now(),
        data: {
          incidentId: incidentData.id,
          type: incidentData.type,
          location: incidentData.location,
          url: `./?incident=${incidentData.id}`
        },
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'acknowledge',
            title: 'Acknowledge'
          }
        ],
        vibrate: [200, 100, 200],
        requireInteraction: incidentData.severity === 'Critical'
      };

      // Add urgency based on severity
      if (incidentData.severity === 'Critical') {
        notificationOptions.renotify = true;
        notificationOptions.silent = false;
      } else if (incidentData.severity === 'High') {
        notificationOptions.silent = false;
      } else {
        notificationOptions.silent = true;
      }

      await registration.showNotification(
        `🚨 ${incidentData.severity} Safety Incident`,
        notificationOptions
      );

      console.log(`🔔 Sent notification for incident: ${incidentData.id}`);
      
      // Log notification sent
      if (window.mmsDB && window.mmsDB.logAction) {
        await window.mmsDB.logAction('notification_sent', {
          incident_id: incidentData.id,
          type: incidentData.type,
          severity: incidentData.severity,
          location: incidentData.location
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      return false;
    }
  }

  async sendSafetyAlert(title, message, options = {}) {
    if (!this.isSupported || this.notificationPermission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const notificationOptions = {
        body: message,
        icon: './icon-192x192.png',
        badge: './icon-72x72.png',
        tag: `alert-${Date.now()}`,
        timestamp: Date.now(),
        data: options.data || {},
        ...options
      };

      await registration.showNotification(title, notificationOptions);
      
      console.log(`🔔 Sent safety alert: ${title}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send safety alert:', error);
      return false;
    }
  }

  setupNotificationClickHandler() {
    // Handle notification clicks
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        this.handleNotificationClick(event.data);
      }
    });
  }

  handleNotificationClick(data) {
    console.log('🖱️ Notification clicked:', data);
    
    switch(data.action) {
      case 'view':
        // Navigate to incident details
        if (data.incidentId) {
          window.location.href = `./?incident=${data.incidentId}`;
        }
        break;
        
      case 'acknowledge':
        // Mark incident as acknowledged
        if (data.incidentId && window.mmsDB) {
          window.mmsDB.updateIncident(data.incidentId, {
            notification_acknowledged: true,
            acknowledged_by: window.mmsAuth?.currentUser?.email,
            acknowledged_at: new Date().toISOString()
          });
        }
        break;
        
      default:
        // Focus or open the app
        if (window.focus) window.focus();
        break;
    }
  }

  async scheduleReminderNotification(title, body, delayMinutes) {
    if (!this.isSupported) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const showTime = Date.now() + (delayMinutes * 60 * 1000);
      
      registration.showNotification(title, {
        body: body,
        icon: './icon-192x192.png',
        tag: `reminder-${Date.now()}`,
        timestamp: showTime,
        showTrigger: new TimestampTrigger(showTime)
      });
      
      console.log(`⏰ Scheduled reminder: ${title} in ${delayMinutes} minutes`);
    } catch (error) {
      console.error('❌ Failed to schedule reminder:', error);
    }
  }

  async sendTrainingReminder(employeeName, trainingType, dueDate) {
    const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 7) {
      const message = daysUntilDue <= 0 
        ? `Training expired for ${employeeName}`
        : `Training due in ${daysUntilDue} days for ${employeeName}`;
      
      await this.sendSafetyAlert(
        '🎓 Training Reminder',
        `${trainingType}: ${message}`,
        {
          data: { type: 'training_reminder', employeeName, trainingType, dueDate },
          tag: `training-${employeeName}-${trainingType}`
        }
      );
    }
  }

  async sendAuditReminder(auditType, location, scheduledDate) {
    const daysUntilAudit = Math.ceil((new Date(scheduledDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilAudit <= 3) {
      await this.sendSafetyAlert(
        '🔍 Audit Reminder',
        `${auditType} audit scheduled at ${location} in ${daysUntilAudit} days`,
        {
          data: { type: 'audit_reminder', auditType, location, scheduledDate },
          tag: `audit-${location}-${auditType}`
        }
      );
    }
  }

  getPermissionStatus() {
    return {
      supported: this.isSupported,
      permission: this.notificationPermission,
      canRequest: this.notificationPermission === 'default'
    };
  }

  async testNotification() {
    const testIncident = {
      id: 'TEST-' + Date.now(),
      type: 'Test Incident',
      severity: 'Medium',
      location: 'Test Location',
      description: 'This is a test notification'
    };
    
    return await this.sendIncidentNotification(testIncident);
  }
}

// Create and export instance
const safetyNotifications = new SafetyPushNotifications();

// Global functions for UI
window.enablePushNotifications = async function() {
  const result = await safetyNotifications.requestPermission();
  
  if (result.granted) {
    showToast('🔔 Push notifications enabled!', 'success');
  } else {
    showToast('Notifications not enabled. Enable in browser settings.', 'info');
  }
  
  return result;
};

window.testPushNotification = function() {
  safetyNotifications.testNotification();
};

window.showNotificationSettings = function() {
  if (safetyNotifications.isSupported) {
    const status = safetyNotifications.getPermissionStatus();
    
    let message = `Push Notification Status:\n\n`;
    message += `• Supported: ${status.supported ? '✅ Yes' : '❌ No'}\n`;
    message += `• Permission: ${status.permission}\n`;
    message += `• Can request: ${status.canRequest ? 'Yes' : 'No'}\n\n`;
    
    if (status.canRequest) {
      message += 'Click "Enable Notifications" to turn on alerts.';
    } else if (status.permission === 'granted') {
      message += 'Notifications are enabled. You will receive safety alerts.';
    } else {
      message += 'Enable notifications in browser settings to receive alerts.';
    }
    
    alert(message);
  } else {
    alert('Push notifications are not supported in your browser.');
  }
};

// Make globally available
window.safetyNotifications = safetyNotifications;

console.log('✅ Safety Push Notifications System Ready');
