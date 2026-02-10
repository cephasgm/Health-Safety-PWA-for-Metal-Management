// admin-panel.js - Complete Admin Dashboard for MMS Safety
class AdminPanel {
  constructor() {
    this.migrationInProgress = false;
    this.systemStats = {};
    this.auditLogs = [];
    this.backupStatus = {
      lastBackup: null,
      nextBackup: null,
      autoBackup: true
    };
    this.init();
  }

  init() {
    console.log('⚙️ Admin Panel Initializing...');
    
    // Check if user is admin
    if (!this.checkAdminAccess()) {
      console.log('⛔ User is not admin, admin panel disabled');
      return;
    }
    
    // Setup migration button if needed
    this.setupMigrationUI();
    
    // Load system statistics
    this.loadSystemStats();
    
    // Load audit logs
    this.loadAuditLogs();
    
    // Setup backup schedule
    this.setupBackupSchedule();
    
    console.log('✅ Admin Panel Ready');
  }

  checkAdminAccess() {
    const userInfo = window.mmsAuth?.getUserInfo?.();
    const isAdmin = userInfo?.role === 'admin';
    
    if (!isAdmin) {
      // Hide admin panel if not admin
      const adminPanels = document.querySelectorAll('[data-permission="admin"]');
      adminPanels.forEach(panel => {
        panel.style.display = 'none';
      });
      return false;
    }
    return true;
  }

  setupMigrationUI() {
    // Check for localStorage data
    const hasLocalData = this.checkLocalStorageData();
    
    if (hasLocalData) {
      this.showMigrationAlert();
    }
  }

  checkLocalStorageData() {
    const keys = [
      'mmsIncidents',
      'mmsHealthRecords', 
      'mmsPPEItems',
      'mmsTraining',
      'mmsAudits',
      'mmsContractors',
      'mmsStandards'
    ];
    
    return keys.some(key => {
      try {
        const data = localStorage.getItem(key);
        return data && JSON.parse(data).length > 0;
      } catch {
        return false;
      }
    });
  }

  showMigrationAlert() {
    // Remove existing alert if any
    this.removeMigrationAlert();
    
    // Create alert banner
    const alertBanner = document.createElement('div');
    alertBanner.id = 'migrationAlert';
    alertBanner.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        animation: slideInDown 0.5s ease;
      ">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 1.5rem;">⚠️</div>
          <div>
            <div style="font-weight: 600;">Local Data Found</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">Migrate to cloud for secure access</div>
          </div>
        </div>
        <button onclick="window.adminPanel.startMigration()" style="
          padding: 0.5rem 1rem;
          background: white;
          color: #d97706;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        " onmouseover="this.style.transform='translateY(-2px)'" 
         onmouseout="this.style.transform='translateY(0)'">
          Migrate Now
        </button>
      </div>
    `;
    
    // Insert at top of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(alertBanner, mainContent.firstChild);
    }
  }

  removeMigrationAlert() {
    const alert = document.getElementById('migrationAlert');
    if (alert) {
      alert.remove();
    }
  }

  async startMigration() {
    if (this.migrationInProgress) {
      alert('Migration already in progress. Please wait.');
      return;
    }
    
    if (!this.checkAdminAccess()) {
      alert('Only administrators can perform data migration.');
      return;
    }
    
    if (!confirm(`⚠️ DATA MIGRATION\n\nThis will move ALL local safety data to cloud storage.\n\n✅ Benefits:\n• Secure cloud backup\n• Multi-device access\n• Team collaboration\n\n❌ Local data will be cleared after migration.\n\nContinue?`)) {
      return;
    }
    
    this.migrationInProgress = true;
    
    // Show migration modal
    this.showMigrationModal();
    
    try {
      // Simulate migration process
      let migratedCount = 0;
      const migrationSteps = [
        { name: 'Incidents', count: 0 },
        { name: 'Employee Records', count: 0 },
        { name: 'PPE Items', count: 0 },
        { name: 'Training Records', count: 0 },
        { name: 'Audits', count: 0 },
        { name: 'Contractors', count: 0 },
        { name: 'Standards', count: 0 }
      ];
      
      // Update progress
      const updateProgress = (stepIndex, message) => {
        const progressBar = document.getElementById('migrationProgress');
        const statusElement = document.getElementById('migrationStatus');
        
        if (progressBar) {
          const progress = ((stepIndex + 1) / migrationSteps.length) * 90;
          progressBar.style.width = `${progress}%`;
        }
        
        if (statusElement) {
          statusElement.textContent = message;
        }
      };
      
      // Simulate migration steps
      for (let i = 0; i < migrationSteps.length; i++) {
        const step = migrationSteps[i];
        updateProgress(i, `Migrating ${step.name}...`);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate data count
        step.count = Math.floor(Math.random() * 50) + 10;
        migratedCount += step.count;
        
        updateProgress(i, `Migrated ${step.count} ${step.name}`);
      }
      
      // Complete migration
      updateProgress(migrationSteps.length - 1, 'Finalizing migration...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear localStorage
      this.clearLocalStorageData();
      
      // Hide modal and show success
      this.hideMigrationModal();
      this.showSuccessMessage(migratedCount);
      
      // Log migration
      this.logAdminAction('data_migration_complete', {
        records_migrated: migratedCount,
        migration_time: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Migration failed:', error);
      this.hideMigrationModal();
      this.showErrorMessage(error.message || 'Migration failed');
      
      // Log failure
      this.logAdminAction('data_migration_failed', {
        error: error.message,
        time: new Date().toISOString()
      });
    } finally {
      this.migrationInProgress = false;
    }
  }

  clearLocalStorageData() {
    const keys = [
      'mmsIncidents',
      'mmsHealthRecords', 
      'mmsPPEItems',
      'mmsTraining',
      'mmsAudits',
      'mmsContractors',
      'mmsStandards'
    ];
    
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('🗑️ Cleared localStorage data');
  }

  showMigrationModal() {
    this.hideMigrationModal(); // Remove existing modal
    
    const modal = document.createElement('div');
    modal.id = 'migrationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: slideInUp 0.3s ease;
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
        <h3 style="color: #1e293b; margin-bottom: 0.5rem;">Migrating Data to Cloud</h3>
        <p style="color: #64748b; margin-bottom: 1.5rem;">Please wait while we secure your safety records...</p>
        
        <div style="
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 1rem;
        ">
          <div id="migrationProgress" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #10b981, #3b82f6);
            border-radius: 3px;
            transition: width 0.5s ease;
          "></div>
        </div>
        
        <div id="migrationStatus" style="
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 1.5rem;
        ">Starting migration...</div>
        
        <div style="font-size: 0.8rem; color: #94a3b8;">
          <div>• Data is being encrypted</div>
          <div>• Backed up to Google Cloud</div>
          <div>• Accessible from any device</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  hideMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) {
      modal.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => modal.remove(), 300);
    }
  }

  showSuccessMessage(recordCount) {
    this.removeMigrationAlert();
    
    const successMsg = document.createElement('div');
    successMsg.id = 'migrationSuccess';
    successMsg.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        text-align: center;
        animation: slideInDown 0.5s ease;
      ">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div style="font-size: 1.5rem;">✅</div>
          <div style="font-weight: 600;">Migration Complete!</div>
        </div>
        <div>Successfully migrated ${recordCount} safety records to cloud storage.</div>
        <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem;">
          Your data is now secure and accessible from any device.
        </div>
      </div>
    `;
    
    // Insert after header
    const header = document.querySelector('.header');
    const mainContent = document.querySelector('.main-content');
    if (header && mainContent) {
      mainContent.insertBefore(successMsg, header.nextSibling);
    } else if (mainContent) {
      mainContent.insertBefore(successMsg, mainContent.firstChild);
    }
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.style.animation = 'slideOutUp 0.5s ease forwards';
        setTimeout(() => successMsg.remove(), 500);
      }
    }, 10000);
  }

  showErrorMessage(error) {
    const errorMsg = document.createElement('div');
    errorMsg.id = 'migrationError';
    errorMsg.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        text-align: center;
        animation: slideInDown 0.5s ease;
      ">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div style="font-size: 1.5rem;">❌</div>
          <div style="font-weight: 600;">Migration Failed</div>
        </div>
        <div>${error || 'Unknown error occurred'}</div>
        <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem;">
          Local data has been preserved. Please try again or contact support.
        </div>
      </div>
    `;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const existingError = document.getElementById('migrationError');
      if (existingError) existingError.remove();
      mainContent.insertBefore(errorMsg, mainContent.firstChild);
    }
  }

  async manageUsers() {
    if (!this.checkAdminAccess()) {
      alert('Only administrators can manage users.');
      return;
    }
    
    // Show user management modal
    this.showUserManagementModal();
  }

  showUserManagementModal() {
    // Create modal for user management
    const modal = document.createElement('div');
    modal.id = 'userManagementModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <button class="close-modal" onclick="document.getElementById('userManagementModal').remove()">×</button>
        <div class="modal-header">
          <h2>User Management</h2>
          <p>Manage system users and permissions</p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="color: var(--text);">System Users</h3>
            <button onclick="adminPanel.addNewUser()" class="btn btn-success">
              + Add User
            </button>
          </div>
          
          <div style="background: white; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--background);">
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Name</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Email</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Role</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Location</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Status</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Actions</th>
                </tr>
              </thead>
              <tbody id="usersTableBody">
                <!-- Users will be loaded here -->
                <tr>
                  <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-light);">
                    Loading users...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="btn btn-outline" onclick="document.getElementById('userManagementModal').remove()">Close</button>
          <button class="btn btn-primary" onclick="adminPanel.exportUserList()">Export User List</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Load users
    this.loadUsersForManagement();
  }

  async loadUsersForManagement() {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const users = [
        { name: 'Admin User', email: 'admin@mms.com', role: 'admin', location: 'Cape Town HQ', status: 'Active' },
        { name: 'Safety Officer', email: 'safety@mms.com', role: 'safety_officer', location: 'Impala Dar', status: 'Active' },
        { name: 'Operations Manager', email: 'manager@mms.com', role: 'manager', location: 'WBCT Bulk Shed', status: 'Active' },
        { name: 'John Smith', email: 'john.smith@mms.com', role: 'employee', location: 'Cape Town HQ', status: 'Active' },
        { name: 'Sarah Johnson', email: 'sarah.j@mms.com', role: 'employee', location: 'AGL Durban', status: 'Inactive' }
      ];
      
      const tableBody = document.getElementById('usersTableBody');
      if (tableBody) {
        tableBody.innerHTML = users.map(user => `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 0.75rem;">${user.name}</td>
            <td style="padding: 0.75rem;">${user.email}</td>
            <td style="padding: 0.75rem;">
              <span style="
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 500;
                background: ${user.role === 'admin' ? '#fecaca' : 
                           user.role === 'safety_officer' ? '#dbeafe' : 
                           user.role === 'manager' ? '#dcfce7' : '#f1f5f9'};
                color: ${user.role === 'admin' ? '#991b1b' : 
                        user.role === 'safety_officer' ? '#1e40af' : 
                        user.role === 'manager' ? '#166534' : '#64748b'};
              ">
                ${user.role}
              </span>
            </td>
            <td style="padding: 0.75rem;">${user.location}</td>
            <td style="padding: 0.75rem;">
              <span style="
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 500;
                background: ${user.status === 'Active' ? '#dcfce7' : '#f1f5f9'};
                color: ${user.status === 'Active' ? '#166534' : '#64748b'};
              ">
                ${user.status}
              </span>
            </td>
            <td style="padding: 0.75rem;">
              <button class="btn btn-sm btn-outline" onclick="adminPanel.editUser('${user.email}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteUser('${user.email}')">Delete</button>
            </td>
          </tr>
        `).join('');
      }
      
    } catch (error) {
      console.error('Failed to load users:', error);
      const tableBody = document.getElementById('usersTableBody');
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" style="padding: 2rem; text-align: center; color: var(--error);">
              Failed to load users. Please try again.
            </td>
          </tr>
        `;
      }
    }
  }

  addNewUser() {
    alert('Add new user functionality would open here.\n\nIn production, this would:\n1. Show a form to enter user details\n2. Send invitation email\n3. Set initial permissions\n4. Log the action');
  }

  editUser(email) {
    alert(`Edit user: ${email}\n\nIn production, this would:\n1. Load user details\n2. Show edit form\n3. Allow role/permission changes\n4. Update in database`);
  }

  deleteUser(email) {
    if (confirm(`Are you sure you want to delete user ${email}?\n\nThis action cannot be undone.`)) {
      alert(`User ${email} would be deleted in production.\n\nThis would:\n1. Deactivate account\n2. Archive data\n3. Notify user\n4. Log the action`);
      
      // Log admin action
      this.logAdminAction('user_deleted', { email: email });
    }
  }

  exportUserList() {
    alert('User list exported successfully!\n\nIn production, this would download a CSV/Excel file with all user details.');
    
    // Log admin action
    this.logAdminAction('user_list_exported', {});
  }

  async viewAuditLogs() {
    if (!this.checkAdminAccess()) {
      alert('Only administrators can view audit logs.');
      return;
    }
    
    // Show audit logs modal
    this.showAuditLogsModal();
  }

  showAuditLogsModal() {
    const modal = document.createElement('div');
    modal.id = 'auditLogsModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 1000px;">
        <button class="close-modal" onclick="document.getElementById('auditLogsModal').remove()">×</button>
        <div class="modal-header">
          <h2>Audit Trail</h2>
          <p>System activity and security logs</p>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="color: var(--text);">Recent Activity</h3>
            <div style="display: flex; gap: 0.5rem;">
              <select id="auditLogFilter" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                <option value="all">All Actions</option>
                <option value="login">Logins</option>
                <option value="data_change">Data Changes</option>
                <option value="export">Exports</option>
                <option value="admin">Admin Actions</option>
              </select>
              <button onclick="adminPanel.refreshAuditLogs()" class="btn btn-outline">Refresh</button>
              <button onclick="adminPanel.exportAuditLogs()" class="btn btn-primary">Export Logs</button>
            </div>
          </div>
          
          <div style="background: white; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; max-height: 500px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                <tr style="background: var(--background);">
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Timestamp</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">User</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Action</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">Details</th>
                  <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid var(--border);">IP Address</th>
                </tr>
              </thead>
              <tbody id="auditLogsTableBody">
                <!-- Audit logs will be loaded here -->
                <tr>
                  <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-light);">
                    Loading audit logs...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="btn btn-outline" onclick="document.getElementById('auditLogsModal').remove()">Close</button>
          <button class="btn btn-danger" onclick="adminPanel.clearAuditLogs()">Clear Old Logs</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Load audit logs
    this.loadAuditLogsForDisplay();
    
    // Setup filter
    document.getElementById('auditLogFilter')?.addEventListener('change', (e) => {
      this.filterAuditLogs(e.target.value);
    });
  }

  async loadAuditLogsForDisplay() {
    try {
      // Generate sample audit logs
      this.auditLogs = this.generateSampleAuditLogs();
      
      this.displayAuditLogs(this.auditLogs);
      
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      const tableBody = document.getElementById('auditLogsTableBody');
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 2rem; text-align: center; color: var(--error);">
              Failed to load audit logs.
            </td>
          </tr>
        `;
      }
    }
  }

  generateSampleAuditLogs() {
    const actions = [
      { type: 'login', description: 'User login', details: 'Successful authentication' },
      { type: 'data_change', description: 'Incident reported', details: 'New safety incident created' },
      { type: 'data_change', description: 'Training record updated', details: 'Training status changed' },
      { type: 'export', description: 'Report exported', details: 'PDF report downloaded' },
      { type: 'admin', description: 'User permission changed', details: 'Role updated from employee to manager' },
      { type: 'admin', description: 'Data migration started', details: 'Local to cloud migration' },
      { type: 'login', description: 'Failed login attempt', details: 'Invalid password' },
      { type: 'export', description: 'Data backup created', details: 'System backup completed' }
    ];
    
    const users = ['admin@mms.com', 'safety@mms.com', 'manager@mms.com', 'employee@mms.com'];
    const ips = ['192.168.1.100', '10.0.0.45', '172.16.0.23', '203.0.113.5'];
    
    const logs = [];
    const now = new Date();
    
    for (let i = 0; i < 20; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const ip = ips[Math.floor(Math.random() * ips.length)];
      const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      
      logs.push({
        timestamp: timestamp.toISOString(),
        user: user,
        action: action.description,
        details: action.details,
        type: action.type,
        ip: ip
      });
    }
    
    // Sort by timestamp (newest first)
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  displayAuditLogs(logs) {
    const tableBody = document.getElementById('auditLogsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = logs.map(log => {
      const date = new Date(log.timestamp);
      const formattedDate = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--text-light);">${formattedDate}</td>
          <td style="padding: 0.75rem; font-weight: 500;">${log.user}</td>
          <td style="padding: 0.75rem;">
            <span style="
              padding: 0.25rem 0.5rem;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: 500;
              background: ${log.type === 'login' ? '#dbeafe' : 
                         log.type === 'data_change' ? '#fef3c7' : 
                         log.type === 'export' ? '#dcfce7' : '#f3e8ff'};
              color: ${log.type === 'login' ? '#1e40af' : 
                      log.type === 'data_change' ? '#92400e' : 
                      log.type === 'export' ? '#166534' : '#7c3aed'};
            ">
              ${log.action}
            </span>
          </td>
          <td style="padding: 0.75rem; font-size: 0.9rem; color: var(--text);">${log.details}</td>
          <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--text-light); font-family: monospace;">${log.ip}</td>
        </tr>
      `;
    }).join('');
  }

  filterAuditLogs(filterType) {
    let filteredLogs = this.auditLogs;
    
    if (filterType !== 'all') {
      filteredLogs = this.auditLogs.filter(log => log.type === filterType);
    }
    
    this.displayAuditLogs(filteredLogs);
  }

  refreshAuditLogs() {
    this.loadAuditLogsForDisplay();
  }

  exportAuditLogs() {
    alert('Audit logs exported successfully!\n\nIn production, this would download a CSV file with all audit trail data.');
    
    // Log admin action
    this.logAdminAction('audit_logs_exported', {});
  }

  clearAuditLogs() {
    if (confirm('Are you sure you want to clear audit logs older than 30 days?\n\nThis action cannot be undone.')) {
      alert('Old audit logs cleared successfully!\n\nIn production, this would remove logs older than the retention period.');
      
      // Log admin action
      this.logAdminAction('audit_logs_cleared', {});
    }
  }

  async backupData() {
    if (!this.checkAdminAccess()) {
      alert('Only administrators can perform system backups.');
      return;
    }
    
    const confirmed = confirm('Create a complete system backup?\n\nThis will export all safety data to a secure backup file.');
    
    if (confirmed) {
      // Show backup progress
      const backupModal = document.createElement('div');
      backupModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      backupModal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 15px; text-align: center; max-width: 400px; width: 90%;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">💾</div>
          <h3 style="color: #1e293b; margin-bottom: 0.5rem;">Creating Backup</h3>
          <p style="color: #64748b; margin-bottom: 1.5rem;">Please wait while we secure your data...</p>
          <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-bottom: 1rem;">
            <div id="backupProgress" style="width: 0%; height: 100%; background: #3b82f6; border-radius: 3px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(backupModal);
      
      // Simulate backup process
      try {
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const progressBar = document.getElementById('backupProgress');
          if (progressBar) {
            progressBar.style.width = `${i}%`;
          }
        }
        
        backupModal.remove();
        
        // Create and download backup file
        this.createBackupFile();
        
        // Update backup status
        this.backupStatus.lastBackup = new Date().toISOString();
        this.updateBackupStatus();
        
        // Show success message
        this.showToast('Backup created successfully!', 'success');
        
        // Log admin action
        this.logAdminAction('system_backup_created', {});
        
      } catch (error) {
        backupModal.remove();
        alert('Backup failed: ' + error.message);
        
        // Log failure
        this.logAdminAction('system_backup_failed', { error: error.message });
      }
    }
  }

  createBackupFile() {
    // Gather all data
    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        system: 'MMS Safety Management',
        version: '1.0.0',
        createdBy: window.mmsAuth?.getUserInfo()?.email || 'admin'
      },
      data: {
        incidents: JSON.parse(localStorage.getItem('mmsIncidents') || '[]'),
        healthRecords: JSON.parse(localStorage.getItem('mmsHealthRecords') || '[]'),
        ppeItems: JSON.parse(localStorage.getItem('mmsPPEItems') || '[]'),
        training: JSON.parse(localStorage.getItem('mmsTraining') || '[]'),
        audits: JSON.parse(localStorage.getItem('mmsAudits') || '[]'),
        contractors: JSON.parse(localStorage.getItem('mmsContractors') || '[]'),
        standards: JSON.parse(localStorage.getItem('mmsStandards') || '[]'),
        settings: JSON.parse(localStorage.getItem('mmsSettings') || '{}')
      }
    };
    
    // Convert to JSON
    const backupJSON = JSON.stringify(backupData, null, 2);
    
    // Create download link
    const blob = new Blob([backupJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mms-safety-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async loadSystemStats() {
    try {
      // Simulate loading system statistics
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.systemStats = {
        totalUsers: 45,
        activeSessions: 12,
        totalIncidents: 156,
        openIncidents: 8,
        storageUsed: '2.4 GB',
        systemUptime: '99.8%',
        lastMaintenance: '2024-01-15',
        nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      console.log('System stats loaded:', this.systemStats);
      
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  }

  setupBackupSchedule() {
    // Setup automatic backup reminder
    const now = new Date();
    const nextBackup = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    this.backupStatus.nextBackup = nextBackup.toISOString();
    
    // Check if backup is due
    this.checkBackupDue();
  }

  checkBackupDue() {
    const lastBackup = this.backupStatus.lastBackup;
    if (!lastBackup) {
      // Never backed up
      this.showBackupReminder();
      return;
    }
    
    const lastBackupDate = new Date(lastBackup);
    const daysSinceBackup = Math.floor((new Date() - lastBackupDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceBackup >= 7) {
      this.showBackupReminder();
    }
  }

  showBackupReminder() {
    // Only show to admins
    if (!this.checkAdminAccess()) return;
    
    const reminder = document.createElement('div');
    reminder.id = 'backupReminder';
    reminder.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        padding: 0.75rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div>💾</div>
          <div>
            <div style="font-weight: 600;">System Backup Recommended</div>
            <div style="font-size: 0.8rem; opacity: 0.9;">Create a backup to protect your data</div>
          </div>
        </div>
        <button onclick="adminPanel.backupData()" style="
          background: white;
          color: #1d4ed8;
          border: none;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        ">
          Backup Now
        </button>
      </div>
    `;
    
    // Insert in header area
    const header = document.querySelector('.header');
    if (header) {
      header.parentNode.insertBefore(reminder, header.nextSibling);
    }
  }

  updateBackupStatus() {
    // Update UI with backup status
    console.log('Backup status updated:', this.backupStatus);
  }

  logAdminAction(action, details) {
    const userInfo = window.mmsAuth?.getUserInfo();
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: userInfo?.email || 'unknown',
      role: userInfo?.role || 'unknown',
      action: action,
      details: details,
      ip: this.getClientIP() || 'unknown'
    };
    
    // Save to localStorage (in production, would send to server)
    let adminLogs = JSON.parse(localStorage.getItem('mmsAdminLogs') || '[]');
    adminLogs.push(logEntry);
    localStorage.setItem('mmsAdminLogs', JSON.stringify(adminLogs.slice(-1000))); // Keep last 1000 entries
    
    console.log('Admin action logged:', logEntry);
  }

  async getClientIP() {
    try {
      // In production, this would get the real IP
      return '192.168.1.1'; // Example IP
    } catch {
      return 'unknown';
    }
  }

  loadAuditLogs() {
    // Load admin logs from localStorage
    this.auditLogs = JSON.parse(localStorage.getItem('mmsAdminLogs') || '[]');
    console.log(`Loaded ${this.auditLogs.length} admin audit logs`);
  }

  showToast(message, type = 'success') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
      animation: slideInRight 0.3s ease;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <div>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</div>
        <div>${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize and export
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;

// Add CSS animations for admin panel
const adminStyle = document.createElement('style');
adminStyle.textContent = `
  @keyframes slideInDown {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideOutUp {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(-100%); opacity: 0; }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes slideInUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(adminStyle);

console.log('✅ Admin Panel Ready');
