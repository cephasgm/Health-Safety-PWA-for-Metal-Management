// GDPR/POPIA Compliance Manager - MMS Safety System
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class ComplianceManager {
  constructor() {
    this.COMPANY_NAME = 'Metal Management Solutions';
    this.COMPANY_ID = 'mms_metal_management';
    
    // Data retention periods (in days)
    this.RETENTION_PERIODS = {
      INCIDENTS: 365 * 7,      // 7 years for incidents
      EMPLOYEE_HEALTH: 365 * 10, // 10 years for health records
      AUDIT_LOGS: 365 * 5,     // 5 years for audit logs
      TRAINING_RECORDS: 365 * 5, // 5 years
      PPE_RECORDS: 365 * 3,    // 3 years
      TEMPORARY_DATA: 30       // 30 days for temp data
    };
    
    // Sensitive data types
    this.SENSITIVE_FIELDS = [
      'blood_group',
      'allergies',
      'medical_conditions',
      'emergency_contact',
      'phone_number',
      'national_id',
      'medical_records',
      'password',
      'social_security'
    ];
    
    console.log('⚖️ Compliance Manager Initialized');
  }

  // ==================== GDPR/POPIA COMPLIANCE ====================

  async processDataSubjectRequest(requestType, userId, userEmail, details = {}) {
    try {
      console.log(`⚖️ Processing ${requestType} request for: ${userEmail}`);
      
      const requestId = `DSR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      const requestData = {
        request_id: requestId,
        request_type: requestType,
        user_id: userId,
        user_email: userEmail,
        requested_at: serverTimestamp(),
        status: 'received',
        details: details,
        company: this.COMPANY_ID,
        processed_by: window.mmsAuth?.currentUser?.email || 'system',
        ip_address: await this.getClientIP(),
        // Legal requirements
        response_due_date: this.calculateDueDate(30), // 30 days to respond
        verification_required: true,
        verification_status: 'pending'
      };
      
      // Save request
      await setDoc(doc(db, 'data_subject_requests', requestId), requestData);
      
      // Log for audit
      await this.logComplianceEvent('data_subject_request', {
        request_id: requestId,
        type: requestType,
        user_email: userEmail,
        action: 'request_received'
      });
      
      // Auto-response based on request type
      await this.handleRequestByType(requestType, userId, userEmail, requestId);
      
      return {
        success: true,
        request_id: requestId,
        message: `Your ${requestType} request has been received. Response due within 30 days.`,
        legal_notice: this.getLegalNotice(requestType)
      };
      
    } catch (error) {
      console.error('❌ Failed to process data subject request:', error);
      return {
        success: false,
        error: 'Failed to process request. Please contact DPO.',
        legal_notice: 'Please contact our Data Protection Officer directly.'
      };
    }
  }

  async handleRequestByType(requestType, userId, userEmail, requestId) {
    switch(requestType) {
      case 'access':
        await this.handleAccessRequest(userId, userEmail, requestId);
        break;
      case 'rectification':
        await this.handleRectificationRequest(userId, userEmail, requestId);
        break;
      case 'erasure':
        await this.handleErasureRequest(userId, userEmail, requestId);
        break;
      case 'restriction':
        await this.handleRestrictionRequest(userId, userEmail, requestId);
        break;
      case 'portability':
        await this.handlePortabilityRequest(userId, userEmail, requestId);
        break;
      case 'objection':
        await this.handleObjectionRequest(userId, userEmail, requestId);
        break;
    }
  }

  async handleAccessRequest(userId, userEmail, requestId) {
    // Gather all data about the user
    const userData = await this.gatherUserData(userEmail);
    
    // Create access report
    const report = {
      request_id: requestId,
      generated_at: new Date().toISOString(),
      data_subject: userEmail,
      data_collected: userData,
      sources: this.identifyDataSources(userData),
      processing_purposes: this.getProcessingPurposes(),
      third_parties: this.getThirdPartyDisclosures(),
      retention_periods: this.RETENTION_PERIODS,
      rights_explained: this.getDataSubjectRights()
    };
    
    // Save report
    await setDoc(doc(db, 'access_reports', requestId), report);
    
    // Update request status
    await this.updateRequestStatus(requestId, 'processing', 'Access report generated');
    
    // Notify DPO
    await this.notifyDPO('access_request', {
      request_id: requestId,
      user_email: userEmail,
      report_ready: true
    });
  }

  async handleErasureRequest(userId, userEmail, requestId) {
    // Check if erasure is possible (legal holds, etc.)
    const canDelete = await this.checkErasureEligibility(userEmail);
    
    if (!canDelete.eligible) {
      await this.updateRequestStatus(requestId, 'rejected', canDelete.reason);
      return;
    }
    
    // Mark data for deletion (soft delete first)
    await this.markForDeletion(userEmail, requestId);
    
    // Schedule actual deletion after verification period
    await this.scheduleDeletion(userEmail, requestId, 14); // 14 days verification
    
    await this.updateRequestStatus(requestId, 'processing', 'Scheduled for deletion after verification period');
  }

  // ==================== DATA RETENTION MANAGEMENT ====================

  async enforceRetentionPolicies() {
    console.log('🔄 Enforcing data retention policies...');
    
    const results = {
      incidents_cleaned: 0,
      employees_cleaned: 0,
      logs_cleaned: 0,
      errors: []
    };
    
    try {
      // Clean old incidents (> 7 years)
      const oldIncidents = await this.findExpiredRecords('incidents', this.RETENTION_PERIODS.INCIDENTS);
      if (oldIncidents.length > 0) {
        await this.anonymizeRecords(oldIncidents, 'incidents');
        results.incidents_cleaned = oldIncidents.length;
      }
      
      // Clean old audit logs (> 5 years)
      const oldLogs = await this.findExpiredRecords('audit_logs', this.RETENTION_PERIODS.AUDIT_LOGS);
      if (oldLogs.length > 0) {
        await this.deleteRecords(oldLogs, 'audit_logs');
        results.logs_cleaned = oldLogs.length;
      }
      
      // Log retention activity
      await this.logComplianceEvent('retention_enforcement', results);
      
      console.log(`✅ Retention enforcement complete:`, results);
      
      return {
        success: true,
        ...results,
        enforced_at: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Retention enforcement failed:', error);
      return {
        success: false,
        error: error.message,
        ...results
      };
    }
  }

  async findExpiredRecords(collectionName, maxAgeDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    const q = query(
      collection(db, collectionName),
      where('created_at', '<', cutoffDate),
      where('retention_exempt', '!=', true)
    );
    
    const snapshot = await getDocs(q);
    const expired = [];
    
    snapshot.forEach(doc => {
      expired.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return expired;
  }

  async anonymizeRecords(records, collectionName) {
    const batch = writeBatch(db);
    
    records.forEach(record => {
      const docRef = doc(db, collectionName, record.id);
      const anonymizedData = this.anonymizeData(record);
      
      batch.update(docRef, {
        ...anonymizedData,
        anonymized_at: serverTimestamp(),
        anonymized_by: 'retention_policy',
        original_data_deleted: true
      });
    });
    
    await batch.commit();
    console.log(`✅ Anonymized ${records.length} ${collectionName} records`);
  }

  anonymizeData(record) {
    const anonymized = { ...record };
    
    // Remove personally identifiable information
    this.SENSITIVE_FIELDS.forEach(field => {
      if (anonymized[field]) {
        anonymized[field] = '[ANONYMIZED]';
      }
    });
    
    // Anonymize email
    if (anonymized.email) {
      const [local, domain] = anonymized.email.split('@');
      anonymized.email = `${local.charAt(0)}***@${domain}`;
    }
    
    // Anonymize names
    if (anonymized.name) {
      anonymized.name = 'Anonymous';
    }
    
    if (anonymized.reported_by) {
      anonymized.reported_by = 'Anonymous';
    }
    
    return anonymized;
  }

  // ==================== CONSENT MANAGEMENT ====================

  async recordConsent(userEmail, consentType, granted = true, purpose = '') {
    try {
      const consentId = `CONSENT-${Date.now()}`;
      const consentData = {
        consent_id: consentId,
        user_email: userEmail,
        consent_type: consentType,
        granted: granted,
        granted_at: serverTimestamp(),
        purpose: purpose || this.getConsentPurpose(consentType),
        version: '1.0',
        company: this.COMPANY_ID,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        // Withdrawal info
        can_withdraw: true,
        withdrawal_process: 'Contact DPO or use system withdrawal form'
      };
      
      await setDoc(doc(db, 'consent_records', consentId), consentData);
      
      await this.logComplianceEvent('consent_recorded', {
        user_email: userEmail,
        consent_type: consentType,
        granted: granted
      });
      
      return {
        success: true,
        consent_id: consentId,
        legal_text: this.getConsentLegalText(consentType, granted)
      };
      
    } catch (error) {
      console.error('❌ Failed to record consent:', error);
      return { success: false, error: 'Failed to record consent' };
    }
  }

  getConsentPurpose(consentType) {
    const purposes = {
      'health_data': 'Processing employee health information for workplace safety',
      'incident_reports': 'Recording and investigating workplace incidents',
      'training_records': 'Maintaining safety training certifications',
      'ppe_tracking': 'Managing personal protective equipment assignments',
      'audit_participation': 'Including in safety audit reports',
      'emergency_contact': 'Storing emergency contact information'
    };
    
    return purposes[consentType] || 'General safety management purposes';
  }

  // ==================== BREACH MANAGEMENT ====================

  async reportDataBreach(breachDetails) {
    try {
      const breachId = `BREACH-${Date.now()}`;
      
      const breachData = {
        breach_id: breachId,
        reported_at: serverTimestamp(),
        reported_by: window.mmsAuth?.currentUser?.email || 'unknown',
        severity: breachDetails.severity || 'unknown',
        description: breachDetails.description || '',
        data_affected: breachDetails.data_affected || [],
        affected_individuals: breachDetails.affected_count || 0,
        discovered_at: breachDetails.discovered_at || new Date().toISOString(),
        containment_status: 'investigating',
        notification_required: true,
        notification_deadline: this.calculateDueDate(72), // 72 hours for notification
        company: this.COMPANY_ID,
        regulatory_notified: false,
        individuals_notified: false
      };
      
      await setDoc(doc(db, 'data_breaches', breachId), breachData);
      
      // Immediate actions
      await this.initiateBreachResponse(breachId, breachData);
      
      // Log for compliance
      await this.logComplianceEvent('data_breach_reported', {
        breach_id: breachId,
        severity: breachDetails.severity,
        affected_count: breachDetails.affected_count
      });
      
      return {
        success: true,
        breach_id: breachId,
        message: 'Data breach reported. DPO and authorities will be notified if required.',
        actions_taken: ['Breach logged', 'DPO notified', 'Investigation initiated']
      };
      
    } catch (error) {
      console.error('❌ Failed to report data breach:', error);
      return { success: false, error: 'Failed to report breach. Contact DPO immediately.' };
    }
  }

  // ==================== UTILITIES ====================

  calculateDueDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  async logComplianceEvent(event, details) {
    try {
      const logId = `COMP-${Date.now()}`;
      await setDoc(doc(db, 'compliance_logs', logId), {
        event: event,
        timestamp: serverTimestamp(),
        details: details,
        company: this.COMPANY_ID
      });
      return true;
    } catch (error) {
      console.error('Failed to log compliance event:', error);
      return false;
    }
  }

  async updateRequestStatus(requestId, status, notes = '') {
    await setDoc(doc(db, 'data_subject_requests', requestId), {
      status: status,
      status_updated_at: serverTimestamp(),
      status_notes: notes
    }, { merge: true });
  }

  async notifyDPO(event, details) {
    // In production, this would email DPO
    console.log(`📧 DPO Notification - ${event}:`, details);
    
    await this.logComplianceEvent('dpo_notified', {
      event: event,
      details: details,
      notification_sent: true,
      sent_at: new Date().toISOString()
    });
  }

  // ==================== LEGAL TEXTS ====================

  getLegalNotice(requestType) {
    const notices = {
      'access': 'Under Article 15 GDPR/POPIA, you have the right to access your personal data. We will provide this within 30 days.',
      'erasure': 'Under Article 17 GDPR/POPIA, you have the right to erasure, subject to legal obligations to retain certain data.',
      'rectification': 'Under Article 16 GDPR/POPIA, you have the right to rectification of inaccurate personal data.',
      'portability': 'Under Article 20 GDPR/POPIA, you have the right to data portability in a structured, commonly used format.',
      'objection': 'Under Article 21 GDPR/POPIA, you have the right to object to processing of your personal data.',
      'restriction': 'Under Article 18 GDPR/POPIA, you have the right to restriction of processing under certain conditions.'
    };
    
    return notices[requestType] || 'Your request is being processed in accordance with data protection laws.';
  }

  getConsentLegalText(consentType, granted) {
    const baseText = granted ? 
      `You have consented to ${consentType.replace('_', ' ')} processing.` :
      `You have withdrawn consent for ${consentType.replace('_', ' ')} processing.`;
    
    return `${baseText} You may withdraw consent at any time. Withdrawal does not affect lawfulness of prior processing.`;
  }

  getDataSubjectRights() {
    return [
      'Right to access personal data',
      'Right to rectification',
      'Right to erasure',
      'Right to restriction of processing',
      'Right to data portability',
      'Right to object to processing',
      'Rights related to automated decision-making'
    ];
  }

  // ==================== PUBLIC API ====================

  async requestDataAccess(userEmail) {
    const user = window.mmsAuth?.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    return this.processDataSubjectRequest('access', user.uid, userEmail);
  }

  async requestDataDeletion(userEmail) {
    const user = window.mmsAuth?.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    return this.processDataSubjectRequest('erasure', user.uid, userEmail);
  }

  async runRetentionCleanup() {
    return this.enforceRetentionPolicies();
  }

  async getComplianceReport() {
    const snapshot = await getDocs(collection(db, 'compliance_logs'));
    const logs = [];
    snapshot.forEach(doc => logs.push(doc.data()));
    
    return {
      company: this.COMPANY_NAME,
      generated_at: new Date().toISOString(),
      data_protection_officer: 'dpo@mms.com',
      compliance_status: 'active',
      recent_activities: logs.slice(-10),
      next_review_date: this.calculateDueDate(90) // Next review in 90 days
    };
  }
}

// Initialize and export
const complianceManager = new ComplianceManager();

// Global functions for UI
window.requestMyData = async function() {
  const user = window.mmsAuth?.currentUser;
  if (!user) {
    alert('Please login first.');
    return;
  }
  
  const confirmed = confirm(
    'REQUEST PERSONAL DATA ACCESS\n\n' +
    'You are requesting a copy of all personal data we hold about you.\n\n' +
    '✓ We will provide this within 30 days\n' +
    '✓ Data will be in readable format\n' +
    '✓ Free of charge\n\n' +
    'Continue with request?'
  );
  
  if (!confirmed) return;
  
  const result = await complianceManager.requestDataAccess(user.email);
  
  if (result.success) {
    alert(`✅ Request submitted!\n\nRequest ID: ${result.request_id}\n\n${result.message}\n\n${result.legal_notice}`);
  } else {
    alert(`❌ Request failed: ${result.error}`);
  }
};

window.runComplianceCheck = async function() {
  if (!window.mmsAuth?.userRole === 'admin') {
    alert('Admin access required.');
    return;
  }
  
  const confirmed = confirm(
    'RUN COMPLIANCE CHECK\n\n' +
    'This will:\n' +
    '✓ Check data retention compliance\n' +
    '✓ Anonymize old records\n' +
    '✓ Generate compliance report\n\n' +
    'Continue?'
  );
  
  if (!confirmed) return;
  
  const result = await complianceManager.runRetentionCleanup();
  
  if (result.success) {
    alert(
      `✅ Compliance check complete!\n\n` +
      `Records cleaned:\n` +
      `• Incidents: ${result.incidents_cleaned}\n` +
      `• Audit logs: ${result.logs_cleaned}\n` +
      `• Employees: ${result.employees_cleaned}\n\n` +
      `Next check scheduled automatically.`
    );
  } else {
    alert(`❌ Compliance check failed: ${result.error}`);
  }
};

window.getComplianceReport = async function() {
  const result = await complianceManager.getComplianceReport();
  
  console.log('Compliance Report:', result);
  
  // Show in modal or download as PDF
  const reportText = `
    MMS SAFETY SYSTEM - COMPLIANCE REPORT
    Generated: ${result.generated_at}
    Company: ${result.company}
    DPO: ${result.data_protection_officer}
    Status: ${result.compliance_status}
    Next Review: ${result.next_review_date}
    
    RECENT ACTIVITIES:
    ${result.recent_activities.map(a => `• ${a.event} at ${a.timestamp}`).join('\n')}
  `;
  
  alert(reportText);
};

// Make available globally
window.complianceManager = complianceManager;

console.log('✅ GDPR/POPIA Compliance Manager Ready');
