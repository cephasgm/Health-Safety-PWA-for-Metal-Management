// admin-panel.js - Admin Dashboard and Data Migration
import { db, storage } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class AdminPanel {
  constructor() {
    this.migrationInProgress = false;
    this.migrationStats = {
      total: 0,
      migrated: 0,
      failed: 0,
      skipped: 0
    };
    this.COMPANY_ID = 'mms_metal_management';
    this.init();
  }

  init() {
    console.log('⚙️ Admin Panel Initializing...');
    
    // Setup migration button if needed
    this.setupMigrationUI();
    
    // Check admin access on auth state changes
    if (window.mmsAuth) {
      // Listen for auth state changes
      setTimeout(() => {
        this.checkAdminAccess();
      }, 1000);
    }
    
    // Add CSS for admin panel
    this.addAdminStyles();
  }

  checkAdminAccess() {
    const isAdmin = window.mmsAuth?.userRole === 'admin';
    console.log(`🔍 Admin access check: ${isAdmin ? '✅ Granted' : '❌ Denied'}`);
    
    if (!isAdmin) {
      // Hide admin panel elements
      const adminElements = document.querySelectorAll('[data-permission="admin"]');
      adminElements.forEach(el => {
        el.style.display = 'none';
      });
      return false;
    }
    
    // Show admin elements
    const adminElements = document.querySelectorAll('[data-permission="admin"]');
    adminElements.forEach(el => {
      el.style.display = '';
    });
    
    // Check for local data to migrate
    setTimeout(() => {
      this.checkLocalStorageData();
    }, 2000);
    
    return true;
  }

  addAdminStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Admin Panel Styles */
      .admin-badge {
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
      }
      
      .migration-alert {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 1rem;
        border-radius: 12px;
        margin: 1rem 0;
        animation: slideIn 0.5s ease;
        border-left: 4px solid #fbbf24;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      }
      
      .migration-success {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 1rem;
        border-radius: 12px;
        margin: 1rem 0;
        animation: slideIn 0.5s ease;
        border-left: 4px solid #34d399;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
      
      .migration-error {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        padding: 1rem;
        border-radius: 12px;
        margin: 1rem 0;
        animation: slideIn 0.5s ease;
        border-left: 4px solid #f87171;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
      
      .migration-progress {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        overflow: hidden;
        margin: 1rem 0;
      }
      
      .migration-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #3b82f6);
        border-radius: 4px;
        transition: width 0.5s ease;
        width: 0%;
      }
      
      .migration-step {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        margin-bottom: 0.5rem;
      }
      
      .migration-step-icon {
        font-size: 1.5rem;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
      }
      
      .admin-modal {
        background: linear-gradient(135deg, #1e293b, #0f172a);
        color: white;
        border: 1px solid #334155;
      }
      
      .admin-modal .modal-content {
        background: #1e293b;
        color: white;
        border: 1px solid #475569;
      }
      
      .admin-modal .btn {
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      @keyframes slideIn {
        from {
          transform: translateY(-20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }

  setupMigrationUI() {
    // Check if migration alert already exists
    if (document.getElementById('migrationAlert')) {
      return;
    }
    
    // This will be triggered when checkLocalStorageData finds data
    console.log('📋 Migration UI setup complete');
  }

  checkLocalStorageData() {
    if (!this.checkAdminAccess()) {
      console.log('⚠️ Skipping local data check - not admin');
      return;
    }
    
    const keys = [
      'mmsIncidents',
      'mmsHealthRecords', 
      'mmsPPEItems',
      'mmsTraining',
      'mmsAudits',
      'mmsContractors',
      'mmsStandards',
      'mmsEquipment',
      'mmsRiskAssessments'
    ];
    
    let hasLocalData = false;
    let totalRecords = 0;
    
    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasLocalData = true;
            totalRecords += parsed.length;
            console.log(`📦 Found ${parsed.length} ${key} in localStorage`);
          }
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    });
    
    if (hasLocalData) {
      console.log(`📊 Total local records found: ${totalRecords}`);
      this.showMigrationAlert(totalRecords);
      return true;
    }
    
    console.log('📭 No local data found to migrate');
    return false;
  }

  showMigrationAlert(recordCount) {
    // Remove existing alert if any
    this.removeMigrationAlert();
    
    const alertHTML = `
      <div id="migrationAlert" class="migration-alert">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2rem;">☁️</div>
            <div>
              <div style="font-weight: 600; font-size: 1.1rem;">Local Data Found</div>
              <div style="font-size: 0.9rem; opacity: 0.9;">
                ${recordCount} safety records found in browser storage
              </div>
              <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                ⚠️ Data is only accessible on this device
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="window.adminPanel.startMigration()" 
                    style="
                      padding: 0.5rem 1.5rem;
                      background: white;
                      color: #d97706;
                      border: none;
                      border-radius: 8px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.3s;
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(255,255,255,0.2)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
              <span>☁️</span>
              Migrate to Cloud
            </button>
            <button onclick="window.adminPanel.dismissMigrationAlert()" 
                    style="
                      padding: 0.5rem 1rem;
                      background: transparent;
                      color: white;
                      border: 1px solid rgba(255,255,255,0.3);
                      border-radius: 8px;
                      cursor: pointer;
                      transition: all 0.3s;
                    "
                    onmouseover="this.style.background='rgba(255,255,255,0.1)'">
              Later
            </button>
          </div>
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>✅</span>
            <span>Cloud benefits: Secure backup • Multi-device access • Team collaboration • Better analytics</span>
          </div>
        </div>
      </div>
    `;
    
    // Insert at top of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const firstChild = mainContent.firstChild;
      if (firstChild) {
        firstChild.insertAdjacentHTML('beforebegin', alertHTML);
      } else {
        mainContent.innerHTML = alertHTML + mainContent.innerHTML;
      }
    }
    
    console.log('📢 Migration alert displayed');
  }

  removeMigrationAlert() {
    const alert = document.getElementById('migrationAlert');
    if (alert) {
      alert.remove();
    }
  }

  dismissMigrationAlert() {
    const alert = document.getElementById('migrationAlert');
    if (alert) {
      alert.style.animation = 'slideIn 0.5s ease reverse forwards';
      setTimeout(() => {
        this.removeMigrationAlert();
      }, 500);
      
      // Remember dismissal for 7 days
      localStorage.setItem('mmsMigrationDismissed', new Date().toISOString());
    }
  }

  async startMigration() {
    if (this.migrationInProgress) {
      alert('Migration is already in progress');
      return;
    }
    
    if (!this.checkAdminAccess()) {
      alert('Admin access required to migrate data');
      return;
    }
    
    // Show confirmation dialog
    const confirmed = await this.showMigrationConfirmation();
    if (!confirmed) return;
    
    this.migrationInProgress = true;
    this.migrationStats = { total: 0, migrated: 0, failed: 0, skipped: 0 };
    
    // Show migration modal
    this.showMigrationModal();
    
    try {
      // Start migration process
      await this.executeMigration();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.showMigrationError(error.message);
      
    } finally {
      this.migrationInProgress = false;
      this.hideMigrationModal();
      
      // Update UI
      setTimeout(() => {
        this.checkLocalStorageData();
      }, 3000);
    }
  }

  showMigrationConfirmation() {
    return new Promise((resolve) => {
      const modalHTML = `
        <div id="migrationConfirmModal" class="modal show" style="display: block;">
          <div class="modal-content admin-modal" style="max-width: 500px;">
            <div style="text-align: center; padding: 2rem;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
              <h3 style="color: white; margin-bottom: 1rem;">Data Migration to Cloud</h3>
              
              <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; text-align: left;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="color: #10b981;">✅</span>
                  <span>Secure cloud backup</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="color: #3b82f6;">✅</span>
                  <span>Access from any device</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="color: #8b5cf6;">✅</span>
                  <span>Team collaboration</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="color: #f59e0b;">✅</span>
                  <span>Better analytics & reporting</span>
                </div>
              </div>
              
              <div style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ef4444;">
                <div style="font-weight: 600; color: #fca5a5; margin-bottom: 0.5rem;">⚠️ Important Notice</div>
                <div style="font-size: 0.9rem; color: #fecaca;">
                  Local data will be cleared after successful migration. 
                  Ensure you have a stable internet connection.
                </div>
              </div>
              
              <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button onclick="window.adminPanel.confirmMigration(true)" 
                        style="
                          flex: 1;
                          padding: 0.75rem;
                          background: linear-gradient(135deg, #10b981, #059669);
                          color: white;
                          border: none;
                          border-radius: 8px;
                          font-weight: 600;
                          cursor: pointer;
                          transition: all 0.3s;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'"
                        onmouseout="this.style.transform='translateY(0)'">
                  ☁️ Start Migration
                </button>
                <button onclick="window.adminPanel.confirmMigration(false)" 
                        style="
                          flex: 1;
                          padding: 0.75rem;
                          background: transparent;
                          color: white;
                          border: 1px solid rgba(255,255,255,0.3);
                          border-radius: 8px;
                          cursor: pointer;
                          transition: all 0.3s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.1)'">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Store resolve function
      window.adminPanel.confirmMigration = (result) => {
        const modal = document.getElementById('migrationConfirmModal');
        if (modal) modal.remove();
        resolve(result);
      };
    });
  }

  async executeMigration() {
    console.log('🚀 Starting data migration...');
    
    const migrationPlan = [
      { 
        key: 'mmsIncidents', 
        collection: 'incidents',
        name: 'Incidents',
        icon: '🚨'
      },
      { 
        key: 'mmsHealthRecords', 
        collection: 'employees',
        name: 'Employee Records',
        icon: '👥'
      },
      { 
        key: 'mmsPPEItems', 
        collection: 'ppe_inventory',
        name: 'PPE Items',
        icon: '🥽'
      },
      { 
        key: 'mmsTraining', 
        collection: 'training_records',
        name: 'Training Records',
        icon: '🎓'
      },
      { 
        key: 'mmsAudits', 
        collection: 'safety_audits',
        name: 'Audits',
        icon: '🔍'
      },
      { 
        key: 'mmsContractors', 
        collection: 'contractors',
        name: 'Contractors',
        icon: '👷'
      },
      { 
        key: 'mmsStandards', 
        collection: 'safety_standards',
        name: 'Standards',
        icon: '📋'
      },
      { 
        key: 'mmsEquipment', 
        collection: 'equipment',
        name: 'Equipment',
        icon: '🔧'
      },
      { 
        key: 'mmsRiskAssessments', 
        collection: 'risk_assessments',
        name: 'Risk Assessments',
        icon: '📊'
      }
    ];
    
    // Update progress bar
    this.updateMigrationProgress(0, 'Preparing migration...');
    
    let totalRecords = 0;
    let successfulMigrations = 0;
    
    // First, count total records
    migrationPlan.forEach(item => {
      const data = localStorage.getItem(item.key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            totalRecords += parsed.length;
          }
        } catch (e) {
          console.error(`Error counting ${item.key}:`, e);
        }
      }
    });
    
    this.migrationStats.total = totalRecords;
    
    // Process each data type
    for (let i = 0; i < migrationPlan.length; i++) {
      const item = migrationPlan[i];
      const data = localStorage.getItem(item.key);
      
      if (!data) {
        this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: No data found`, 'skipped');
        this.migrationStats.skipped++;
        continue;
      }
      
      try {
        const records = JSON.parse(data);
        if (!Array.isArray(records) || records.length === 0) {
          this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: No records`, 'skipped');
          this.migrationStats.skipped++;
          continue;
        }
        
        // Update step
        this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: Migrating ${records.length} records...`, 'processing');
        
        // Migrate to Firebase
        const result = await this.migrateToFirebase(records, item.collection, item.name);
        
        if (result.success) {
          this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: ✅ ${records.length} migrated`, 'success');
          this.migrationStats.migrated += records.length;
          successfulMigrations++;
          
          // Clear localStorage for this item
          localStorage.removeItem(item.key);
          
        } else {
          this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: ❌ Failed`, 'error');
          this.migrationStats.failed += records.length;
        }
        
        // Update progress
        const progress = Math.round(((i + 1) / migrationPlan.length) * 100);
        this.updateMigrationProgress(progress, `Processed ${i + 1} of ${migrationPlan.length} data types`);
        
      } catch (error) {
        console.error(`Error migrating ${item.key}:`, error);
        this.updateMigrationStep(i + 1, `${item.icon} ${item.name}: ❌ Error`, 'error');
        this.migrationStats.failed++;
      }
    }
    
    // Final update
    this.updateMigrationProgress(100, 'Migration complete!');
    
    // Show results
    setTimeout(() => {
      this.showMigrationResults();
    }, 1000);
    
    return {
      success: successfulMigrations > 0,
      stats: this.migrationStats
    };
  }

  async migrateToFirebase(records, collectionName, dataType) {
    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      const batch = writeBatch(db);
      const user = window.mmsAuth?.currentUser;
      
      records.forEach((record, index) => {
        const docId = record.id || `${collectionName}_${Date.now()}_${index}`;
        const docRef = doc(db, collectionName, docId);
        
        const migratedRecord = {
          ...record,
          // Migration metadata
          migrated_from: 'localStorage',
          migrated_at: serverTimestamp(),
          migrated_by: user?.email || 'system',
          migration_batch: new Date().toISOString(),
          original_local_id: record.id,
          company: this.COMPANY_ID,
          
          // Ensure timestamps
          created_at: record.created_at || serverTimestamp(),
          updated_at: serverTimestamp()
        };
        
        batch.set(docRef, migratedRecord);
      });
      
      await batch.commit();
      console.log(`✅ Successfully migrated ${records.length} ${dataType} to Firestore`);
      
      return {
        success: true,
        count: records.length
      };
      
    } catch (error) {
      console.error(`❌ Failed to migrate ${dataType}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  showMigrationModal() {
    const modalHTML = `
      <div id="migrationModal" class="modal show" style="display: block; background: rgba(0,0,0,0.9);">
        <div class="modal-content admin-modal" style="max-width: 600px;">
          <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 2s infinite;">☁️</div>
            <h3 style="color: white; margin-bottom: 0.5rem;">Migrating Data to Cloud</h3>
            <p style="color: #94a3b8; margin-bottom: 2rem;">Securing your safety records...</p>
            
            <div class="migration-progress">
              <div id="migrationProgressBar" class="migration-progress-bar"></div>
            </div>
            
            <div id="migrationStatus" style="
              font-size: 0.9rem;
              color: #cbd5e1;
              margin: 1rem 0;
              min-height: 20px;
            ">Starting migration...</div>
            
            <div id="migrationSteps" style="
              background: rgba(255,255,255,0.05);
              border-radius: 8px;
              padding: 1rem;
              max-height: 300px;
              overflow-y: auto;
              margin-top: 1rem;
              text-align: left;
            ">
              <!-- Steps will be added here -->
            </div>
            
            <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
              <div style="font-size: 0.85rem; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>🔒 Data is being encrypted</span>
                <span>☁️ Backed up to Google Cloud</span>
                <span>📱 Accessible from any device</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  hideMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        modal.remove();
      }, 500);
    }
  }

  updateMigrationProgress(percentage, message) {
    const progressBar = document.getElementById('migrationProgressBar');
    const status = document.getElementById('migrationStatus');
    
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    
    if (status) {
      status.textContent = message;
    }
  }

  updateMigrationStep(stepNumber, message, status = 'processing') {
    const stepsContainer = document.getElementById('migrationSteps');
    if (!stepsContainer) return;
    
    const stepId = `migrationStep${stepNumber}`;
    let stepElement = document.getElementById(stepId);
    
    if (!stepElement) {
      stepElement = document.createElement('div');
      stepElement.id = stepId;
      stepElement.className = 'migration-step';
      stepsContainer.appendChild(stepElement);
    }
    
    let icon = '⏳';
    if (status === 'success') icon = '✅';
    if (status === 'error') icon = '❌';
    if (status === 'skipped') icon = '⏭️';
    
    stepElement.innerHTML = `
      <div class="migration-step-icon">${icon}</div>
      <div style="flex: 1;">
        <div style="font-weight: ${status === 'processing' ? '600' : '400'}; color: white;">${message}</div>
        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">
          ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    `;
    
    // Scroll to bottom
    stepsContainer.scrollTop = stepsContainer.scrollHeight;
  }

  showMigrationResults() {
    this.removeMigrationAlert();
    this.hideMigrationModal();
    
    const successHTML = `
      <div id="migrationSuccess" class="migration-success">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 2.5rem;">🎉</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem;">Migration Complete!</div>
            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.25rem;">
              Successfully migrated ${this.migrationStats.migrated} safety records to cloud storage.
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
          <div style="text-align: center; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 600; color: #10b981;">${this.migrationStats.migrated}</div>
            <div style="font-size: 0.75rem;">Migrated</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 600; color: ${this.migrationStats.failed > 0 ? '#ef4444' : '#94a3b8'}">${this.migrationStats.failed}</div>
            <div style="font-size: 0.75rem;">Failed</div>
          </div>
          <div style="text-align: center; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b;">${this.migrationStats.skipped}</div>
            <div style="font-size: 0.75rem;">Skipped</div>
          </div>
        </div>
        
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>✅</span>
            <span>Your data is now securely stored in the cloud and accessible from any device.</span>
          </div>
          <button onclick="location.reload()" 
                  style="
                    margin-top: 1rem;
                    padding: 0.5rem 1.5rem;
                    background: white;
                    color: #059669;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'"
                  onmouseout="this.style.transform='translateY(0)'">
            🔄 Reload to Load Cloud Data
          </button>
        </div>
      </div>
    `;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const firstChild = mainContent.firstChild;
      if (firstChild) {
        firstChild.insertAdjacentHTML('beforebegin', successHTML);
      } else {
        mainContent.innerHTML = successHTML + mainContent.innerHTML;
      }
    }
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      const successAlert = document.getElementById('migrationSuccess');
      if (successAlert) {
        successAlert.style.animation = 'slideIn 0.5s ease reverse forwards';
        setTimeout(() => successAlert.remove(), 500);
      }
    }, 30000);
  }

  showMigrationError(errorMessage) {
    const errorHTML = `
      <div id="migrationError" class="migration-error">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 2.5rem;">❌</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem;">Migration Failed</div>
            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.25rem;">
              ${errorMessage || 'An unknown error occurred'}
            </div>
          </div>
        </div>
        
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 0.85rem; margin-bottom: 1rem;">
            <span>⚠️</span>
            <span>Your local data has been preserved. Please try again or contact support.</span>
          </div>
          <button onclick="window.adminPanel.startMigration()" 
                  style="
                    padding: 0.5rem 1rem;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.background='rgba(255,255,255,0.3)'">
            🔄 Retry Migration
          </button>
        </div>
      </div>
    `;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const firstChild = mainContent.firstChild;
      if (firstChild) {
        firstChild.insertAdjacentHTML('beforebegin', errorHTML);
      }
    }
  }

  // Other admin functions
  async manageUsers() {
    alert('User Management - Coming soon!\n\nThis feature will allow admins to:\n• View all users\n• Assign roles\n• Reset passwords\n• Manage permissions');
    // TODO: Implement user management interface
  }

  async viewAuditLogs() {
    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      const logsRef = collection(db, 'audit_logs');
      const q = query(
        logsRef, 
        where('company', '==', this.COMPANY_ID),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const logs = [];
      
      snapshot.forEach(doc => {
        logs.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      this.showAuditLogs(logs);
      
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      alert(`Failed to load audit logs: ${error.message}`);
    }
  }

  showAuditLogs(logs) {
    const modalHTML = `
      <div id="auditLogsModal" class="modal show" style="display: block;">
        <div class="modal-content admin-modal" style="max-width: 800px; max-height: 80vh;">
          <button class="close-modal" onclick="document.getElementById('auditLogsModal').remove()">×</button>
          <div class="modal-header">
            <h2>Audit Logs</h2>
            <p>System activity and user actions</p>
          </div>
          
          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table" style="color: white;">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody id="auditLogsBody">
                ${logs.length > 0 ? logs.map(log => `
                  <tr>
                    <td>${log.timestamp?.toDate?.().toLocaleString() || 'Unknown'}</td>
                    <td>${log.user_email || 'Unknown'}</td>
                    <td><span class="admin-badge" style="font-size: 0.7rem;">${log.user_role || 'Unknown'}</span></td>
                    <td>${log.action || 'Unknown'}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                      ${JSON.stringify(log.details || {})}
                    </td>
                    <td>${log.ip_address || 'Unknown'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">
                      No audit logs found
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
          
          <div class="action-buttons" style="margin-top: 2rem;">
            <button class="btn btn-outline" onclick="document.getElementById('auditLogsModal').remove()" style="color: white; border-color: rgba(255,255,255,0.3);">
              Close
            </button>
            <button class="btn btn-primary" onclick="window.adminPanel.exportAuditLogs()">
              📄 Export Logs
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  exportAuditLogs() {
    alert('Audit logs export - Coming soon!');
    // TODO: Implement export functionality
  }

  async backupData() {
    try {
      // Create comprehensive backup
      const backup = {
        timestamp: new Date().toISOString(),
        company: this.COMPANY_ID,
        backup_type: 'full_system',
        data: {}
      };
      
      // Collect all local data
      const keys = [
        'mmsIncidents', 'mmsHealthRecords', 'mmsPPEItems', 'mmsTraining',
        'mmsAudits', 'mmsContractors', 'mmsStandards', 'mmsEquipment'
      ];
      
      keys.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            backup.data[key] = JSON.parse(data);
          } catch (e) {
            backup.data[key] = data;
          }
        }
      });
      
      // Create download
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mms-safety-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert(`✅ Backup created successfully!\n\nFile: ${a.download}`);
      
    } catch (error) {
      console.error('Backup failed:', error);
      alert(`❌ Backup failed: ${error.message}`);
    }
  }

  // Utility function to check if migration was recently dismissed
  shouldShowMigrationAlert() {
    const dismissedAt = localStorage.getItem('mmsMigrationDismissed');
    if (!dismissedAt) return true;
    
    const dismissedDate = new Date(dismissedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return dismissedDate < sevenDaysAgo;
  }
}

// Initialize and export
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;

// Make admin functions globally available
window.manageUsers = () => adminPanel.manageUsers();
window.viewAuditLogs = () => adminPanel.viewAuditLogs();
window.backupData = () => adminPanel.backupData();
window.migrateToCloud = () => adminPanel.startMigration();

console.log('✅ Admin Panel Ready');
