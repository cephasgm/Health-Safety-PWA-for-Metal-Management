// Incident Investigator Toolkit - MMS Safety System
import { mmsDB } from './database-service.js';

class IncidentInvestigator {
  constructor() {
    this.investigationTemplates = {
      minor: {
        steps: [
          { id: 'interview', title: 'Interview Witnesses', duration: '2h', required: true },
          { id: 'photos', title: 'Collect Photos', duration: '1h', required: true },
          { id: 'analysis', title: 'Root Cause Analysis', duration: '3h', required: true },
          { id: 'report', title: 'Investigation Report', duration: '2h', required: true }
        ],
        timeline: '72 hours'
      },
      serious: {
        steps: [
          { id: 'secure', title: 'Secure Scene', duration: 'Immediate', required: true },
          { id: 'witnesses', title: 'Interview All Witnesses', duration: '4h', required: true },
          { id: 'documents', title: 'Collect Documents', duration: '2h', required: true },
          { id: 'root_cause', title: 'Root Cause Analysis', duration: '6h', required: true },
          { id: 'corrective', title: 'Corrective Actions', duration: '4h', required: true },
          { id: 'report', title: 'Full Investigation Report', duration: '4h', required: true },
          { id: 'review', title: 'Management Review', duration: '2h', required: true }
        ],
        timeline: '7 days'
      },
      critical: {
        steps: [
          { id: 'emergency', title: 'Emergency Response', duration: 'Immediate', required: true },
          { id: 'regulatory', title: 'Notify Regulators', duration: '24h', required: true },
          { id: 'team', title: 'Form Investigation Team', duration: '2h', required: true },
          { id: 'evidence', title: 'Preserve Evidence', duration: '4h', required: true },
          { id: 'interviews', title: 'Formal Interviews', duration: '8h', required: true },
          { id: 'analysis', title: 'Comprehensive Analysis', duration: '12h', required: true },
          { id: 'actions', title: 'Immediate Actions', duration: '4h', required: true },
          { id: 'report', title: 'Regulatory Report', duration: '8h', required: true },
          { id: 'followup', title: 'Follow-up Monitoring', duration: 'Ongoing', required: true }
        ],
        timeline: '30 days'
      }
    };
  }

  // Start new investigation
  async startInvestigation(incidentId, severity = 'minor') {
    try {
      const template = this.investigationTemplates[severity] || this.investigationTemplates.minor;
      const investigationId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const investigation = {
        id: investigationId,
        incident_id: incidentId,
        severity: severity,
        status: 'in_progress',
        start_date: new Date().toISOString(),
        due_date: this.calculateDueDate(severity),
        assigned_to: window.mmsAuth?.currentUser?.email || 'Unassigned',
        assigned_by: window.mmsAuth?.currentUser?.email,
        steps: template.steps.map(step => ({
          ...step,
          status: 'pending',
          started_at: null,
          completed_at: null,
          notes: '',
          evidence: []
        })),
        timeline: template.timeline,
        created_at: new Date().toISOString(),
        company: 'mms_metal_management'
      };
      
      // Save to database
      await mmsDB.saveInvestigation(investigation);
      
      // Update incident status
      await mmsDB.updateIncident(incidentId, {
        investigation_status: 'investigation_started',
        investigation_id: investigationId,
        investigation_assigned_to: investigation.assigned_to,
        investigation_due_date: investigation.due_date
      });
      
      console.log(`✅ Investigation started: ${investigationId} for incident ${incidentId}`);
      
      return {
        success: true,
        investigation: investigation,
        message: `Investigation started. Due in ${template.timeline}.`
      };
      
    } catch (error) {
      console.error('❌ Failed to start investigation:', error);
      return {
        success: false,
        error: 'Failed to start investigation'
      };
    }
  }

  // Update investigation step
  async updateStep(investigationId, stepId, updateData) {
    try {
      const investigation = await mmsDB.getInvestigation(investigationId);
      
      if (!investigation.success) {
        throw new Error('Investigation not found');
      }
      
      const stepIndex = investigation.data.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) {
        throw new Error('Step not found');
      }
      
      // Update step
      investigation.data.steps[stepIndex] = {
        ...investigation.data.steps[stepIndex],
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: window.mmsAuth?.currentUser?.email
      };
      
      // Check if all steps completed
      const allCompleted = investigation.data.steps.every(s => s.status === 'completed');
      if (allCompleted) {
        investigation.data.status = 'completed';
        investigation.data.completed_at = new Date().toISOString();
      }
      
      // Save updates
      await mmsDB.updateInvestigation(investigationId, {
        steps: investigation.data.steps,
        status: investigation.data.status,
        completed_at: investigation.data.completed_at,
        updated_at: new Date().toISOString()
      });
      
      return {
        success: true,
        investigation: investigation.data,
        step: investigation.data.steps[stepIndex]
      };
      
    } catch (error) {
      console.error('❌ Failed to update step:', error);
      return {
        success: false,
        error: 'Failed to update investigation step'
      };
    }
  }

  // Add evidence to investigation
  async addEvidence(investigationId, evidenceData) {
    try {
      const evidenceId = `EVD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const evidence = {
        id: evidenceId,
        investigation_id: investigationId,
        type: evidenceData.type || 'photo',
        description: evidenceData.description || '',
        file_url: evidenceData.file_url || '',
        file_name: evidenceData.file_name || '',
        collected_by: window.mmsAuth?.currentUser?.email,
        collected_at: new Date().toISOString(),
        location: evidenceData.location || '',
        notes: evidenceData.notes || '',
        tags: evidenceData.tags || []
      };
      
      await mmsDB.saveEvidence(evidence);
      
      return {
        success: true,
        evidence: evidence,
        message: 'Evidence added successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to add evidence:', error);
      return {
        success: false,
        error: 'Failed to add evidence'
      };
    }
  }

  // Root Cause Analysis (5 Whys method)
  async performRootCauseAnalysis(incidentId) {
    try {
      const analysisId = `RCA-${Date.now()}`;
      
      const analysis = {
        id: analysisId,
        incident_id: incidentId,
        method: '5_whys',
        steps: [
          { question: 'What happened?', answer: '', level: 1 },
          { question: 'Why did it happen?', answer: '', level: 2 },
          { question: 'Why did that happen?', answer: '', level: 3 },
          { question: 'Why did that happen?', answer: '', level: 4 },
          { question: 'Why did that happen?', answer: '', level: 5 }
        ],
        root_cause: '',
        contributing_factors: [],
        conducted_by: window.mmsAuth?.currentUser?.email,
        conducted_at: new Date().toISOString(),
        verified: false
      };
      
      await mmsDB.saveRootCauseAnalysis(analysis);
      
      return {
        success: true,
        analysis: analysis,
        message: 'Root Cause Analysis template created'
      };
      
    } catch (error) {
      console.error('❌ Failed to create RCA:', error);
      return {
        success: false,
        error: 'Failed to create Root Cause Analysis'
      };
    }
  }

  // Generate investigation report
  async generateInvestigationReport(investigationId) {
    try {
      const investigation = await mmsDB.getInvestigation(investigationId);
      const incident = await mmsDB.getIncidentById(investigation.data.incident_id);
      
      if (!investigation.success || !incident.success) {
        throw new Error('Data not found');
      }
      
      const report = {
        id: `REP-${Date.now()}`,
        investigation_id: investigationId,
        incident_id: investigation.data.incident_id,
        title: `Investigation Report - ${incident.data.type} at ${incident.data.location}`,
        executive_summary: '',
        timeline_of_events: [],
        findings: [],
        root_causes: [],
        immediate_actions: [],
        corrective_actions: [],
        preventive_actions: [],
        recommendations: [],
        attachments: [],
        prepared_by: window.mmsAuth?.currentUser?.email,
        prepared_date: new Date().toISOString(),
        approved_by: '',
        approved_date: null,
        status: 'draft'
      };
      
      await mmsDB.saveInvestigationReport(report);
      
      return {
        success: true,
        report: report,
        message: 'Investigation report template created'
      };
      
    } catch (error) {
      console.error('❌ Failed to generate report:', error);
      return {
        success: false,
        error: 'Failed to generate investigation report'
      };
    }
  }

  // Calculate due date based on severity
  calculateDueDate(severity) {
    const dueDate = new Date();
    
    switch(severity) {
      case 'critical':
        dueDate.setDate(dueDate.getDate() + 30);
        break;
      case 'serious':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'minor':
      default:
        dueDate.setDate(dueDate.getDate() + 3);
        break;
    }
    
    return dueDate.toISOString();
  }

  // Investigation checklist
  getInvestigationChecklist(severity) {
    const checklists = {
      minor: [
        'Interview affected employee',
        'Take photos of scene',
        'Review work procedures',
        'Identify immediate causes',
        'Document findings',
        'Recommend corrective actions'
      ],
      serious: [
        'Secure incident scene',
        'Interview all witnesses',
        'Collect physical evidence',
        'Review CCTV footage',
        'Analyze work procedures',
        'Interview supervisors',
        'Review training records',
        'Identify root causes',
        'Develop action plan',
        'Prepare formal report'
      ],
      critical: [
        'Activate emergency response',
        'Notify management',
        'Notify regulators (if required)',
        'Preserve evidence',
        'Form investigation team',
        'Conduct formal interviews',
        'Review all documentation',
        'Analyze systems failures',
        'Consult experts if needed',
        'Develop comprehensive action plan',
        'Prepare regulatory reports',
        'Implement immediate controls',
        'Schedule follow-up review'
      ]
    };
    
    return checklists[severity] || checklists.minor;
  }

  // Investigation progress tracking
  getInvestigationProgress(investigation) {
    if (!investigation || !investigation.steps) return 0;
    
    const completedSteps = investigation.steps.filter(s => s.status === 'completed').length;
    const totalSteps = investigation.steps.length;
    
    return Math.round((completedSteps / totalSteps) * 100);
  }

  // Time since incident calculator
  getTimeSinceIncident(incidentDate) {
    const incident = new Date(incidentDate);
    const now = new Date();
    const diffMs = now - incident;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
  }
}

// Add methods to database service
if (window.mmsDB) {
  // Investigation methods
  window.mmsDB.saveInvestigation = async function(investigation) {
    const docRef = doc(db, 'investigations', investigation.id);
    await setDoc(docRef, investigation);
    return { success: true };
  };

  window.mmsDB.getInvestigation = async function(investigationId) {
    const docRef = doc(db, 'investigations', investigationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Investigation not found' };
    }
  };

  window.mmsDB.updateInvestigation = async function(investigationId, updates) {
    const docRef = doc(db, 'investigations', investigationId);
    await updateDoc(docRef, updates);
    return { success: true };
  };

  window.mmsDB.saveEvidence = async function(evidence) {
    const docRef = doc(db, 'investigation_evidence', evidence.id);
    await setDoc(docRef, evidence);
    return { success: true };
  };

  window.mmsDB.saveRootCauseAnalysis = async function(analysis) {
    const docRef = doc(db, 'root_cause_analysis', analysis.id);
    await setDoc(docRef, analysis);
    return { success: true };
  };

  window.mmsDB.saveInvestigationReport = async function(report) {
    const docRef = doc(db, 'investigation_reports', report.id);
    await setDoc(docRef, report);
    return { success: true };
  };
}

// Create and export instance
const incidentInvestigator = new IncidentInvestigator();
window.incidentInvestigator = incidentInvestigator;

console.log('✅ Incident Investigator Toolkit Ready');
