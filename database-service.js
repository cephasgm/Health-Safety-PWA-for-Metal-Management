// MMS Safety Database Service - Production
import { db, storage, analytics } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

class MMSDatabaseService {
  constructor() {
    this.COMPANY_ID = 'mms_metal_management';
    this.COMPANY_NAME = 'Metal Management Solutions';
    
    // Collections structure
    this.COLLECTIONS = {
      INCIDENTS: 'incidents',
      EMPLOYEES: 'employees', 
      PPE: 'ppe_inventory',
      TRAINING: 'training_records',
      AUDITS: 'safety_audits',
      CONTRACTORS: 'contractors',
      STANDARDS: 'safety_standards',
      LOGS: 'audit_logs',
      LOCATIONS: 'locations'
    };
    
    // MMS Locations
    this.MMS_LOCATIONS = [
      { code: 'CT', name: 'Cape Town HQ', country: 'South Africa' },
      { code: 'DBN', name: 'Cosco Durban', country: 'South Africa' },
      { code: 'AGL', name: 'AGL Durban', country: 'South Africa' },
      { code: 'DAR', name: 'Impala Dar', country: 'Tanzania' },
      { code: 'POL', name: 'Polytra Dar', country: 'Tanzania' },
      { code: 'ACC', name: 'Access Dar', country: 'Tanzania' },
      { code: 'WBCT', name: 'WBCT Bulk Shed', country: 'Namibia' },
      { code: 'WBQ', name: 'WBCT Quay Side Shed', country: 'Namibia' },
      { code: 'BWB', name: 'Bridge Walvis Bay', country: 'Namibia' },
      { code: 'PWB', name: 'Pindulo Walvis Bay', country: 'Namibia' },
      { code: 'RGT', name: 'Reload Giga Terminal', country: 'Zambia' },
      { code: 'ACH', name: 'AGL Chingola Hub', country: 'Zambia' },
      { code: 'PKT', name: 'Polytra Kitwe', country: 'Zambia' },
      { code: 'IND', name: 'Impala Ndola', country: 'Zambia' },
      { code: 'SLS', name: 'SLS Ndola', country: 'Zambia' },
      { code: 'PZM', name: 'Poseidon Zambia', country: 'Zambia' },
      { code: 'PKM', name: 'Polytra Kapiri Mposhi', country: 'Zambia' }
    ];
    
    console.log('📦 MMS Database Service Initialized');
  }

  // ==================== CORE OPERATIONS ====================
  
  generateId(prefix) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  async logAction(action, details = {}) {
    try {
      const logId = this.generateId('LOG');
      const user = window.mmsAuth?.currentUser;
      
      const logData = {
        action: action,
        user_id: user?.uid || 'unknown',
        user_email: user?.email || 'unknown',
        user_role: window.mmsAuth?.userRole || 'guest',
        user_location: window.mmsAuth?.userLocation || 'unknown',
        timestamp: serverTimestamp(),
        details: details,
        company: this.COMPANY_ID,
        ip_address: await this.getClientIP()
      };
      
      await setDoc(doc(db, this.COLLECTIONS.LOGS, logId), logData);
      return true;
    } catch (error) {
      console.error('Failed to log action:', error);
      return false;
    }
  }

  // ==================== INCIDENT MANAGEMENT ====================
  
  async createIncident(incidentData) {
    try {
      const incidentId = this.generateId('INC');
      const user = window.mmsAuth?.currentUser;
      
      const firestoreData = {
        // Core data
        id: incidentId,
        incident_number: `MMS-INC-${new Date().getFullYear()}-${incidentId.split('-')[2]}`,
        
        // Incident details
        type: incidentData.type || 'Unspecified',
        severity: incidentData.severity || 'Medium',
        location: incidentData.location || 'Unknown',
        department: incidentData.department || 'Unknown',
        
        // Description
        description: incidentData.description || '',
        immediate_actions: incidentData.actions || '',
        recommendations: incidentData.recommendations || '',
        
        // People
        reported_by: incidentData.reportedBy || user?.email || 'Unknown',
        reported_by_id: user?.uid || 'unknown',
        
        // Metadata
        status: 'Reported',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        date_time: Timestamp.fromDate(new Date(incidentData.date || new Date())),
        
        // Company
        company: this.COMPANY_ID,
        company_name: this.COMPANY_NAME,
        
        // Attachments placeholder
        attachments: [],
        
        // Investigation
        investigation_status: 'Pending',
        investigation_assigned_to: '',
        investigation_due_date: null,
        
        // Follow-up
        corrective_actions: '',
        closure_date: null,
        closed_by: ''
      };
      
      // Save to Firestore
      await setDoc(doc(db, this.COLLECTIONS.INCIDENTS, incidentId), firestoreData);
      
      // Log the action
      await this.logAction('incident_created', {
        incident_id: incidentId,
        type: incidentData.type,
        location: incidentData.location,
        severity: incidentData.severity
      });
      
      console.log(`✅ Incident created: ${incidentId}`);
      
      return {
        success: true,
        id: incidentId,
        incident_number: firestoreData.incident_number,
        message: 'Incident reported successfully',
        data: firestoreData
      };
      
    } catch (error) {
      console.error('❌ Failed to create incident:', error);
      
      await this.logAction('incident_creation_failed', {
        error: error.message,
        data: incidentData
      });
      
      return {
        success: false,
        error: 'Failed to save incident. Please try again.',
        details: error.message
      };
    }
  }

  async getIncidents(filters = {}) {
    try {
      let q = collection(db, this.COLLECTIONS.INCIDENTS);
      
      // Always filter by company
      q = query(q, where('company', '==', this.COMPANY_ID));
      
      // Apply user filters
      if (filters.location && filters.location !== 'All') {
        q = query(q, where('location', '==', filters.location));
      }
      
      if (filters.status && filters.status !== 'All') {
        q = query(q, where('status', '==', filters.status));
      }
      
      if (filters.type && filters.type !== 'All') {
        q = query(q, where('type', '==', filters.type));
      }
      
      if (filters.severity && filters.severity !== 'All') {
        q = query(q, where('severity', '==', filters.severity));
      }
      
      // Date range filter
      if (filters.startDate && filters.endDate) {
        const start = Timestamp.fromDate(new Date(filters.startDate));
        const end = Timestamp.fromDate(new Date(filters.endDate));
        q = query(q, where('date_time', '>=', start), where('date_time', '<=', end));
      }
      
      // Order and limit
      q = query(q, orderBy('created_at', 'desc'));
      
      if (filters.limit && filters.limit > 0) {
        q = query(q, limit(filters.limit));
      }
      
      const snapshot = await getDocs(q);
      const incidents = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        incidents.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamp to readable date
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          date_time: data.date_time?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      });
      
      return {
        success: true,
        data: incidents,
        count: incidents.length,
        filters: filters,
        retrieved_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to get incidents:', error);
      return {
        success: false,
        error: 'Failed to load incidents',
        data: [],
        count: 0
      };
    }
  }

  async updateIncident(incidentId, updates) {
    try {
      const docRef = doc(db, this.COLLECTIONS.INCIDENTS, incidentId);
      const user = window.mmsAuth?.currentUser;
      
      const updateData = {
        ...updates,
        updated_at: serverTimestamp(),
        updated_by: user?.email || 'unknown',
        updated_by_id: user?.uid || 'unknown'
      };
      
      await updateDoc(docRef, updateData);
      
      await this.logAction('incident_updated', {
        incident_id: incidentId,
        updates: Object.keys(updates),
        updated_by: user?.email
      });
      
      console.log(`✅ Incident updated: ${incidentId}`);
      
      return {
        success: true,
        message: 'Incident updated successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to update incident:', error);
      return {
        success: false,
        error: 'Failed to update incident'
      };
    }
  }

  // ==================== EMPLOYEE MANAGEMENT ====================
  
  async saveEmployee(employeeData) {
    try {
      const employeeId = employeeData.employee_id || this.generateId('EMP');
      const user = window.mmsAuth?.currentUser;
      
      const employeeRecord = {
        // Employee info
        employee_id: employeeId,
        name: employeeData.name || 'Unknown',
        email: employeeData.email || '',
        phone: employeeData.phone || '',
        
        // Employment details
        location: employeeData.location || 'Unknown',
        department: employeeData.department || 'Unknown',
        position: employeeData.position || 'Unknown',
        employee_number: employeeData.employee_number || '',
        
        // Health info
        blood_group: employeeData.blood_group || '',
        allergies: employeeData.allergies || 'None',
        medical_conditions: employeeData.medical_conditions || 'None',
        
        // Medical records
        last_medical_exam: employeeData.last_medical_exam || '',
        next_medical_due: employeeData.next_medical_due || '',
        medical_status: employeeData.medical_status || 'Pending',
        medical_restrictions: employeeData.medical_restrictions || '',
        
        // Emergency contact
        emergency_contact_name: employeeData.emergency_contact_name || '',
        emergency_contact_phone: employeeData.emergency_contact_phone || '',
        emergency_contact_relation: employeeData.emergency_contact_relation || '',
        
        // Training
        safety_training: employeeData.safety_training || [],
        training_expiry_dates: employeeData.training_expiry_dates || {},
        
        // PPE
        assigned_ppe: employeeData.assigned_ppe || [],
        
        // Metadata
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user?.email || 'system',
        company: this.COMPANY_ID,
        
        // Status
        employment_status: employeeData.employment_status || 'Active',
        start_date: employeeData.start_date || '',
        notes: employeeData.notes || ''
      };
      
      await setDoc(doc(db, this.COLLECTIONS.EMPLOYEES, employeeId), employeeRecord);
      
      await this.logAction('employee_saved', {
        employee_id: employeeId,
        name: employeeData.name,
        location: employeeData.location
      });
      
      return {
        success: true,
        id: employeeId,
        message: 'Employee record saved successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to save employee:', error);
      return {
        success: false,
        error: 'Failed to save employee record'
      };
    }
  }

  async getEmployees(filters = {}) {
    try {
      let q = collection(db, this.COLLECTIONS.EMPLOYEES);
      
      q = query(q, where('company', '==', this.COMPANY_ID));
      
      if (filters.location && filters.location !== 'All') {
        q = query(q, where('location', '==', filters.location));
      }
      
      if (filters.department && filters.department !== 'All') {
        q = query(q, where('department', '==', filters.department));
      }
      
      if (filters.status && filters.status !== 'All') {
        q = query(q, where('employment_status', '==', filters.status));
      }
      
      q = query(q, orderBy('name', 'asc'));
      
      const snapshot = await getDocs(q);
      const employees = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        employees.push({
          id: doc.id,
          ...data,
          // Calculate if medical exam is overdue
          medical_overdue: data.next_medical_due ? 
            new Date(data.next_medical_due) < new Date() : false
        });
      });
      
      return {
        success: true,
        data: employees,
        count: employees.length
      };
      
    } catch (error) {
      console.error('❌ Failed to get employees:', error);
      return {
        success: false,
        error: 'Failed to load employees',
        data: []
      };
    }
  }

  // ==================== FILE MANAGEMENT ====================
  
  async uploadFile(file, context, referenceId) {
    try {
      // Validate file
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit');
      }
      
      // Allowed file types
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed. Use PDF, DOC, XLS, or images.');
      }
      
      // Create safe filename
      const timestamp = Date.now();
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileExt = originalName.split('.').pop();
      const fileName = `${context}_${referenceId}_${timestamp}.${fileExt}`;
      
      // Upload to Firebase Storage
      const storagePath = `mms_safety/${context}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      console.log(`✅ File uploaded: ${originalName} → ${storagePath}`);
      
      // Log the upload
      await this.logAction('file_uploaded', {
        file_name: originalName,
        file_size: file.size,
        file_type: file.type,
        context: context,
        reference_id: referenceId,
        storage_path: storagePath
      });
      
      return {
        success: true,
        url: downloadURL,
        path: storagePath,
        name: originalName,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString(),
        uploaded_by: window.mmsAuth?.currentUser?.email
      };
      
    } catch (error) {
      console.error('❌ File upload failed:', error);
      
      await this.logAction('file_upload_failed', {
        file_name: file.name,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message || 'Failed to upload file'
      };
    }
  }

  // ==================== DATA MIGRATION ====================
  
  async migrateLocalData() {
    try {
      console.log('🔄 Starting data migration from localStorage...');
      
      const migrationPlan = [
        { localStorageKey: 'mmsIncidents', collection: this.COLLECTIONS.INCIDENTS },
        { localStorageKey: 'mmsHealthRecords', collection: this.COLLECTIONS.EMPLOYEES },
        { localStorageKey: 'mmsPPEItems', collection: this.COLLECTIONS.PPE },
        { localStorageKey: 'mmsTraining', collection: this.COLLECTIONS.TRAINING },
        { localStorageKey: 'mmsAudits', collection: this.COLLECTIONS.AUDITS },
        { localStorageKey: 'mmsContractors', collection: this.COLLECTIONS.CONTRACTORS },
        { localStorageKey: 'mmsStandards', collection: this.COLLECTIONS.STANDARDS }
      ];
      
      let totalMigrated = 0;
      const batch = writeBatch(db);
      const user = window.mmsAuth?.currentUser;
      
      for (const migration of migrationPlan) {
        const localData = JSON.parse(localStorage.getItem(migration.localStorageKey) || '[]');
        
        console.log(`📦 Found ${localData.length} ${migration.localStorageKey} to migrate`);
        
        for (const item of localData) {
          const docId = item.id || `${migration.localStorageKey}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const docRef = doc(db, migration.collection, docId);
          
          const migratedItem = {
            ...item,
            // Migration metadata
            migrated_from: 'localStorage',
            migrated_at: serverTimestamp(),
            migrated_by: user?.email || 'system',
            migration_batch: new Date().toISOString(),
            original_local_id: item.id,
            company: this.COMPANY_ID,
            
            // Ensure timestamps
            created_at: item.created_at || serverTimestamp(),
            updated_at: serverTimestamp()
          };
          
          batch.set(docRef, migratedItem);
          totalMigrated++;
        }
      }
      
      if (totalMigrated > 0) {
        await batch.commit();
        
        // Clear localStorage after successful migration
        migrationPlan.forEach(m => localStorage.removeItem(m.localStorageKey));
        
        console.log(`✅ Migration complete: ${totalMigrated} records migrated`);
        
        await this.logAction('data_migration_complete', {
          records_migrated: totalMigrated,
          migration_time: new Date().toISOString()
        });
        
        return {
          success: true,
          migrated: totalMigrated,
          message: `Successfully migrated ${totalMigrated} records to cloud storage`,
          timestamp: new Date().toISOString()
        };
        
      } else {
        return {
          success: true,
          migrated: 0,
          message: 'No local data found to migrate'
        };
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      
      await this.logAction('data_migration_failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: 'Migration failed. Data remains in browser for safety.',
        details: error.message
      };
    }
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

  async getDashboardStats() {
    try {
      const [incidents, employees, training] = await Promise.all([
        this.getIncidents({ limit: 1000 }),
        this.getEmployees(),
        this.getTrainingRecords({ limit: 1000 })
      ]);
      
      const stats = {
        incidents: {
          total: incidents.success ? incidents.data.length : 0,
          reported_today: incidents.success ? incidents.data.filter(i => {
            const incidentDate = new Date(i.date_time || i.created_at);
            const today = new Date();
            return incidentDate.toDateString() === today.toDateString();
          }).length : 0,
          open: incidents.success ? incidents.data.filter(i => i.status === 'Reported').length : 0,
          closed: incidents.success ? incidents.data.filter(i => i.status === 'Closed').length : 0
        },
        employees: {
          total: employees.success ? employees.data.length : 0,
          medical_overdue: employees.success ? employees.data.filter(e => e.medical_overdue).length : 0
        },
        training: {
          total: training.success ? training.data.length : 0,
          expired: training.success ? training.data.filter(t => {
            if (!t.expiry_date) return false;
            return new Date(t.expiry_date) < new Date();
          }).length : 0
        },
        updated_at: new Date().toISOString()
      };
      
      return {
        success: true,
        stats: stats,
        company: this.COMPANY_NAME
      };
      
    } catch (error) {
      console.error('❌ Failed to get dashboard stats:', error);
      return {
        success: false,
        stats: {},
        error: 'Failed to load statistics'
      };
    }
  }

  // Helper method for training records (simplified)
  async getTrainingRecords(filters = {}) {
    try {
      let q = collection(db, this.COLLECTIONS.TRAINING);
      q = query(q, where('company', '==', this.COMPANY_ID));
      
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }
      
      const snapshot = await getDocs(q);
      const records = [];
      
      snapshot.forEach(doc => {
        records.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return { success: true, data: records };
    } catch (error) {
      return { success: false, data: [], error: error.message };
    }
  }
}

// Create and export global instance
const mmsDB = new MMSDatabaseService();

// Global migration function
window.migrateToCloud = async function() {
  if (!window.mmsAuth?.currentUser) {
    alert('Please login first to migrate data.');
    return;
  }
  
  const confirmed = confirm(
    '⚠️ DATA MIGRATION TO CLOUD ⚠️\n\n' +
    'This will move ALL your local safety data to secure cloud storage.\n\n' +
    '✅ Benefits:\n' +
    '- Access data from any device\n' +
    '- Automatic backups\n' +
    '- Team collaboration\n' +
    '- Better security\n\n' +
    '❌ Local data will be cleared after migration.\n\n' +
    'Continue with migration?'
  );
  
  if (!confirmed) return;
  
  const button = event.target;
  const originalText = button.innerHTML;
  button.innerHTML = '⏳ Migrating...';
  button.disabled = true;
  
  try {
    const result = await mmsDB.migrateLocalData();
    
    if (result.success) {
      button.innerHTML = '✅ Migration Complete!';
      button.style.background = '#10b981';
      
      setTimeout(() => {
        alert(
          `Migration Successful!\n\n` +
          `📊 ${result.migrated} records migrated to cloud\n` +
          `☁️ Data now securely stored\n` +
          `🔄 Page will reload to load cloud data`
        );
        
        // Reload to show cloud data
        setTimeout(() => location.reload(), 2000);
      }, 1000);
      
    } else {
      button.innerHTML = '❌ Migration Failed';
      button.style.background = '#ef4444';
      button.disabled = false;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
      }, 3000);
      
      alert(`Migration failed: ${result.error}\n\nData remains in browser for safety.`);
    }
    
  } catch (error) {
    button.innerHTML = '❌ Error';
    button.disabled = false;
    alert('Migration error: ' + error.message);
  }
};

// Make database instance globally available
window.mmsDB = mmsDB;

console.log('✅ MMS Database Service Ready');
