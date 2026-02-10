// Incident Investigator Toolkit - MMS Safety
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class IncidentInvestigator {
  constructor() {
    this.investigationStages = [
      'Initial Report',
      'Immediate Response',
      'Data Collection',
      'Root Cause Analysis',
      'Corrective Actions',
      'Verification',
      'Closure'
    ];
    
    this.rootCauseCategories = [
      'Human Factors',
      'Equipment Failure',
      'Procedural Issues',
      'Environmental Conditions',
      'Management Systems',
      'Training Deficiencies',
      'Communication Breakdown'
    ];
    
    this.investigationTemplates = {
      'Near Miss': this.getNearMissTemplate(),
      'First Aid': this.getFirstAidTemplate(),
      'Lost Time Injury': this.getLTITemplate(),
      'Property Damage': this.getPropertyDamageTemplate(),
      'Environmental': this.getEnvironmentalTemplate()
    };
  }

  // ==================== INVESTIGATION TEMPLATES ====================
  
  getNearMissTemplate() {
    return {
      title: 'Near Miss Investigation',
      steps: [
        {
          step: 1,
          title: 'Immediate Scene',
          questions: [
            'What was the hazardous condition?',
            'Who was involved/witnessed?',
            'What was the potential injury?',
            'What prevented the incident?'
          ]
        },
        {
          step: 2,
          title: 'Root Cause Analysis',
          questions: [
            'Was PPE being used correctly?',
            'Were procedures followed?',
            'Was equipment in safe condition?',
            'Were there environmental factors?'
          ]
        },
        {
          step: 3,
          title: 'Preventive Actions',
          questions: [
            'What immediate controls needed?',
            'What long-term solutions?',
            'Who needs to be informed?',
            'What training required?'
          ]
        }
      ]
    };
  }

  getLTITemplate() {
    return {
      title: 'Lost Time Injury Investigation',
      steps: [
        {
          step: 1,
          title: 'Emergency Response',
          questions: [
            'Time of incident and reporting',
            'First aid/medical response',
            'Emergency services contacted?',
            'Scene secured and preserved?'
          ]
        },
        {
          step: 2,
          title: 'Detailed Investigation',
          questions: [
            'Exact location and position',
            'Equipment/tools involved',
            'Work being performed',
            'Environmental conditions',
            'Witness statements'
          ]
        },
        {
          step: 3,
          title: 'Analysis',
          questions: [
            'Direct causes (what happened)',
            'Root causes (why it happened)',
            'System failures',
            'Previous similar incidents'
          ]
        },
        {
          step: 4,
          title: 'Corrective Actions',
          questions: [
            'Immediate actions taken',
            'Preventive measures',
            'Policy/procedure updates',
            'Training requirements',
            'Follow-up schedule'
          ]
        }
      ]
    };
  }

  getFirstAidTemplate() {
    return {
      title: 'First Aid Case Investigation',
      steps: [
        {
          step: 1,
          title: 'Injury Details',
          questions: [
            'Type and location of injury',
            'First aid treatment given',
            'Medical follow-up required?',
            'Return to work status'
          ]
        },
        {
          step: 2,
          title: 'Prevention',
          questions: [
            'Could injury have been prevented?',
            'Was PPE available and used?',
            'Were procedures adequate?',
            'Similar incidents previously?'
          ]
        }
      ]
    };
  }

  getPropertyDamageTemplate() {
    return {
      title: 'Property Damage Investigation',
      steps: [
        {
          step: 1,
          title: 'Damage Assessment',
          questions: [
            'Equipment/material damaged',
            'Estimated cost of damage',
            'Production impact',
            'Repair timeline'
          ]
        },
        {
          step: 2,
          title: 'Cause Analysis',
          questions: [
            'How damage occurred',
            'Operator error or equipment failure',
            'Maintenance history',
            'Operating conditions'
          ]
        }
      ]
    };
  }

  getEnvironmentalTemplate() {
    return {
      title: 'Environmental Incident Investigation',
      steps: [
        {
          step: 1,
          title: 'Impact Assessment',
          questions: [
            'Substance/material released',
            'Quantity and concentration',
            'Area affected',
            'Environmental impact'
          ]
        },
        {
          step: 2,
          title: 'Containment & Cleanup',
          questions: [
            'Immediate containment actions',
            'Cleanup procedures',
            'Waste disposal method',
            'Regulatory notifications'
          ]
        }
      ]
    };
  }

  // ==================== INVESTIGATION METHODS ====================
  
  async startInvestigation(incidentId, investigatorEmail) {
    try {
      const incidentRef = doc(db, 'incidents', incidentId);
      const incidentSnap = await getDoc(incidentRef);
      
      if (!incidentSnap.exists()) {
        throw new Error('Incident not found');
      }
      
      const incident = incidentSnap.data();
      
      // Get appropriate template
      const template = this.investigationTemplates[incident.type] || this.getNearMissTemplate();
      
      const investigation = {
        incident_id: incidentId,
        incident_type: incident.type,
        incident_description: incident.description,
        incident_location: incident.location,
        incident_date: incident.date_time || incident.created_at,
        
        // Investigation details
        investigator: investigatorEmail,
        investigation_started: serverTimestamp(),
        current_stage: 1,
        stages_completed: 0,
        total_stages: template.steps.length,
        
        // Template
        template_used: template.title,
        investigation_steps: template.steps.map(step => ({
          ...step,
          completed: false,
          completion_date: null,
          findings: '',
          evidence: [],
          photos: []
        })),
        
        // Root cause analysis
        root_causes: [],
        contributing_factors: [],
        
        // Evidence collection
        evidence_collected: [],
        witness_statements: [],
        photos_documents: [],
        
        // Timeline
        timeline_events: [
          {
            event: 'Investigation started',
            timestamp: serverTimestamp(),
            by: investigatorEmail
          }
        ],
        
        // Status
        status: 'In Progress',
        estimated_completion: null,
        last_updated: serverTimestamp(),
        
        // Metadata
        company: incident.company || 'mms_metal_management',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      // Create investigation document
      const investigationId = `INV-${incidentId.split('-')[1] || Date.now()}`;
      const investigationRef = doc(db, 'investigations', investigationId);
      
      await updateDoc(investigationRef, investigation);
      
      // Update incident status
      await updateDoc(incidentRef, {
        investigation_status: 'Assigned',
        investigation_assigned_to: investigatorEmail,
        investigation_assigned_date: serverTimestamp(),
        investigation_id: investigationId
      });
      
      console.log(`✅ Investigation started: ${investigationId}`);
      
      return {
        success: true,
        investigation_id: investigationId,
        incident_id: incidentId,
        message: 'Investigation started successfully',
        template: template.title,
        next_steps: template.steps[0]
      };
      
    } catch (error) {
      console.error('❌ Failed to start investigation:', error);
      return {
        success: false,
        error: 'Failed to start investigation',
        details: error.message
      };
    }
  }

  async updateInvestigationStage(investigationId, stageNumber, findings) {
    try {
      const investigationRef = doc(db, 'investigations', investigationId);
      const investigationSnap = await getDoc(investigationRef);
      
      if (!investigationSnap.exists()) {
        throw new Error('Investigation not found');
      }
      
      const investigation = investigationSnap.data();
      
      // Validate stage
      if (stageNumber < 1 || stageNumber > investigation.total_stages) {
        throw new Error('Invalid stage number');
      }
      
      // Update the specific stage
      const updatedSteps = investigation.investigation_steps.map(step => {
        if (step.step === stageNumber) {
          return {
            ...step,
            completed: true,
            completion_date: serverTimestamp(),
            findings: findings.findings || '',
            evidence: findings.evidence || [],
            photos: findings.photos || []
          };
        }
        return step;
      });
      
      // Calculate progress
      const completedStages = updatedSteps.filter(step => step.completed).length;
      const progress = Math.round((completedStages / investigation.total_stages) * 100);
      
      // Update investigation
      const updates = {
        investigation_steps: updatedSteps,
        current_stage: stageNumber + 1 <= investigation.total_stages ? stageNumber + 1 : stageNumber,
        stages_completed: completedStages,
        progress_percentage: progress,
        last_updated: serverTimestamp(),
        
        timeline_events: [
          ...(investigation.timeline_events || []),
          {
            event: `Stage ${stageNumber} completed: ${updatedSteps.find(s => s.step === stageNumber)?.title}`,
            timestamp: serverTimestamp(),
            by: window.mmsAuth?.currentUser?.email || 'unknown'
          }
        ]
      };
      
      // If all stages completed, mark as ready for review
      if (completedStages === investigation.total_stages) {
        updates.status = 'Ready for Review';
        updates.investigation_completed = serverTimestamp();
        
        updates.timeline_events.push({
          event: 'All investigation stages completed',
          timestamp: serverTimestamp(),
          by: window.mmsAuth?.currentUser?.email || 'unknown'
        });
      }
      
      await updateDoc(investigationRef, updates);
      
      console.log(`✅ Investigation stage ${stageNumber} updated`);
      
      return {
        success: true,
        investigation_id: investigationId,
        stage_completed: stageNumber,
        progress: `${progress}%`,
        next_stage: stageNumber + 1 <= investigation.total_stages ? stageNumber + 1 : null,
        message: `Stage ${stageNumber} completed successfully`
      };
      
    } catch (error) {
      console.error('❌ Failed to update investigation stage:', error);
      return {
        success: false,
        error: 'Failed to update investigation stage',
        details: error.message
      };
    }
  }

  async addRootCauseAnalysis(investigationId, rootCauseData) {
    try {
      const investigationRef = doc(db, 'investigations', investigationId);
      const investigationSnap = await getDoc(investigationRef);
      
      if (!investigationSnap.exists()) {
        throw new Error('Investigation not found');
      }
      
      const rootCause = {
        id: `RC-${Date.now()}`,
        category: rootCauseData.category,
        description: rootCauseData.description,
        evidence: rootCauseData.evidence || [],
        contributing_factors: rootCauseData.contributing_factors || [],
        analysis_method: rootCauseData.analysis_method || '5 Whys',
        identified_by: window.mmsAuth?.currentUser?.email || 'unknown',
        identified_date: serverTimestamp(),
        priority: rootCauseData.priority || 'Medium'
      };
      
      const investigation = investigationSnap.data();
      const currentRootCauses = investigation.root_causes || [];
      
      await updateDoc(investigationRef, {
        root_causes: [...currentRootCauses, rootCause],
        last_updated: serverTimestamp(),
        
        timeline_events: [
          ...(investigation.timeline_events || []),
          {
            event: `Root cause identified: ${rootCauseData.category}`,
            timestamp: serverTimestamp(),
            by: window.mmsAuth?.currentUser?.email || 'unknown'
          }
        ]
      });
      
      console.log(`✅ Root cause added to investigation ${investigationId}`);
      
      return {
        success: true,
        root_cause_id: rootCause.id,
        investigation_id: investigationId,
        message: 'Root cause analysis added successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to add root cause:', error);
      return {
        success: false,
        error: 'Failed to add root cause analysis'
      };
    }
  }

  async addCorrectiveAction(investigationId, actionData) {
    try {
      const action = {
        id: `CA-${Date.now()}`,
        description: actionData.description,
        responsible_person: actionData.responsible_person,
        department: actionData.department,
        due_date: Timestamp.fromDate(new Date(actionData.due_date)),
        priority: actionData.priority || 'Medium',
        status: 'Pending',
        created_by: window.mmsAuth?.currentUser?.email || 'unknown',
        created_date: serverTimestamp(),
        completion_date: null,
        verification_required: actionData.verification_required || false,
        verification_date: null,
        verification_by: null,
        notes: actionData.notes || ''
      };
      
      const investigationRef = doc(db, 'investigations', investigationId);
      const investigationSnap = await getDoc(investigationRef);
      
      if (!investigationSnap.exists()) {
        throw new Error('Investigation not found');
      }
      
      const investigation = investigationSnap.data();
      const currentActions = investigation.corrective_actions || [];
      
      await updateDoc(investigationRef, {
        corrective_actions: [...currentActions, action],
        last_updated: serverTimestamp(),
        
        timeline_events: [
          ...(investigation.timeline_events || []),
          {
            event: `Corrective action added: ${actionData.description.substring(0, 50)}...`,
            timestamp: serverTimestamp(),
            by: window.mmsAuth?.currentUser?.email || 'unknown'
          }
        ]
      });
      
      // Also add to incident
      const incidentRef = doc(db, 'incidents', investigation.incident_id);
      await updateDoc(incidentRef, {
        corrective_actions: [...(investigation.corrective_actions || []), action],
        updated_at: serverTimestamp()
      });
      
      console.log(`✅ Corrective action added to investigation ${investigationId}`);
      
      return {
        success: true,
        action_id: action.id,
        investigation_id: investigationId,
        message: 'Corrective action added successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to add corrective action:', error);
      return {
        success: false,
        error: 'Failed to add corrective action'
      };
    }
  }

  async completeInvestigation(investigationId, summary) {
    try {
      const investigationRef = doc(db, 'investigations', investigationId);
      const investigationSnap = await getDoc(investigationRef);
      
      if (!investigationSnap.exists()) {
        throw new Error('Investigation not found');
      }
      
      const investigation = investigationSnap.data();
      
      const updates = {
        status: 'Completed',
        investigation_completed: serverTimestamp(),
        completed_by: window.mmsAuth?.currentUser?.email || 'unknown',
        executive_summary: summary.executive_summary || '',
        lessons_learned: summary.lessons_learned || [],
        recommendations: summary.recommendations || [],
        closure_date: serverTimestamp(),
        last_updated: serverTimestamp(),
        
        timeline_events: [
          ...(investigation.timeline_events || []),
          {
            event: 'Investigation completed and closed',
            timestamp: serverTimestamp(),
            by: window.mmsAuth?.currentUser?.email || 'unknown'
          }
        ]
      };
      
      await updateDoc(investigationRef, updates);
      
      // Update incident status
      const incidentRef = doc(db, 'incidents', investigation.incident_id);
      await updateDoc(incidentRef, {
        investigation_status: 'Completed',
        investigation_completed_date: serverTimestamp(),
        status: 'Closed',
        closed_by: window.mmsAuth?.currentUser?.email || 'unknown',
        closure_date: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      console.log(`✅ Investigation ${investigationId} completed`);
      
      return {
        success: true,
        investigation_id: investigationId,
        incident_id: investigation.incident_id,
        message: 'Investigation completed successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to complete investigation:', error);
      return {
        success: false,
        error: 'Failed to complete investigation'
      };
    }
  }

  // ==================== ANALYSIS TOOLS ====================
  
  perform5WhysAnalysis(problemStatement) {
    const questions = [
      `1. Why did ${problemStatement} occur?`,
      `2. Why did that happen?`,
      `3. Why did that occur?`,
      `4. Why was that the case?`,
      `5. Why did that root cause exist?`
    ];
    
    return {
      method: '5 Whys Analysis',
      problem_statement: problemStatement,
      questions: questions,
      expected_outcome: 'Identify root cause by asking "why" repeatedly',
      template: questions.map((q, i) => ({
        question: q,
        answer: '',
        evidence: '',
        verified: false
      }))
    };
  }

  performFishboneDiagram(categories) {
    const defaultCategories = [
      'Manpower (People)',
      'Methods (Process)',
      'Machines (Equipment)',
      'Materials',
      'Measurements',
      'Environment'
    ];
    
    return {
      method: 'Fishbone Diagram (Ishikawa)',
      categories: categories || defaultCategories,
      structure: {
        main_bone: 'Problem/Effect',
        sub_bones: (categories || defaultCategories).map(cat => ({
          category: cat,
          causes: [],
          sub_causes: []
        }))
      },
      instructions: 'List causes under each category that contribute to the problem'
    };
  }

  performRiskMatrix(likelihood, severity) {
    const likelihoodScale = {
      1: 'Rare (Once in 10+ years)',
      2: 'Unlikely (Once in 5-10 years)',
      3: 'Possible (Once in 1-5 years)',
      4: 'Likely (Once per year)',
      5: 'Almost Certain (Multiple times per year)'
    };
    
    const severityScale = {
      1: 'Insignificant (No injury, minor damage)',
      2: 'Minor (First aid, minor damage)',
      3: 'Moderate (Medical treatment, moderate damage)',
      4: 'Major (Lost time injury, major damage)',
      5: 'Catastrophic (Fatality, extensive damage)'
    };
    
    const riskScore = likelihood * severity;
    let riskLevel = 'Low';
    let actionRequired = 'Monitor';
    
    if (riskScore >= 20) {
      riskLevel = 'Extreme';
      actionRequired = 'Immediate action required. Stop activity.';
    } else if (riskScore >= 15) {
      riskLevel = 'High';
      actionRequired = 'Urgent action required. Senior management attention.';
    } else if (riskScore >= 10) {
      riskLevel = 'Medium-High';
      actionRequired = 'Action required. Management responsibility specified.';
    } else if (riskScore >= 6) {
      riskLevel = 'Medium';
      actionRequired = 'Specific monitoring or response required.';
    } else if (riskScore >= 3) {
      riskLevel = 'Low-Medium';
      actionRequired = 'Routine procedures apply.';
    } else {
      riskLevel = 'Low';
      actionRequired = 'Manage by routine procedures.';
    }
    
    return {
      likelihood: {
        value: likelihood,
        description: likelihoodScale[likelihood] || 'Unknown'
      },
      severity: {
        value: severity,
        description: severityScale[severity] || 'Unknown'
      },
      risk_score: riskScore,
      risk_level: riskLevel,
      action_required: actionRequired,
      color: this.getRiskColor(riskLevel),
      matrix_position: `L${likelihood}-S${severity}`
    };
  }

  getRiskColor(level) {
    const colors = {
      'Extreme': '#7f1d1d',
      'High': '#dc2626',
      'Medium-High': '#ea580c',
      'Medium': '#f59e0b',
      'Low-Medium': '#84cc16',
      'Low': '#10b981'
    };
    return colors[level] || '#6b7280';
  }

  // ==================== REPORT GENERATION ====================
  
  generateInvestigationReport(investigationData) {
    const report = {
      header: {
        title: 'INCIDENT INVESTIGATION REPORT',
        company: 'Metal Management Solutions',
        report_id: `INV-REP-${Date.now()}`,
        date: new Date().toLocaleDateString()
      },
      
      incident_details: {
        incident_id: investigationData.incident_id,
        type: investigationData.incident_type,
        location: investigationData.incident_location,
        date: investigationData.incident_date?.toDate?.()?.toLocaleDateString() || 'Unknown',
        description: investigationData.incident_description
      },
      
      investigation_details: {
        investigator: investigationData.investigator,
        start_date: investigationData.investigation_started?.toDate?.()?.toLocaleDateString() || 'Unknown',
        end_date: investigationData.investigation_completed?.toDate?.()?.toLocaleDateString() || 'Ongoing',
        duration_days: this.calculateDuration(investigationData),
        status: investigationData.status
      },
      
      findings: {
        stages_completed: investigationData.stages_completed || 0,
        total_stages: investigationData.total_stages || 0,
        progress: investigationData.progress_percentage || 0,
        root_causes: investigationData.root_causes || [],
        contributing_factors: investigationData.contributing_factors || []
      },
      
      corrective_actions: {
        total_actions: investigationData.corrective_actions?.length || 0,
        pending: investigationData.corrective_actions?.filter(a => a.status === 'Pending').length || 0,
        completed: investigationData.corrective_actions?.filter(a => a.status === 'Completed').length || 0,
        actions: investigationData.corrective_actions || []
      },
      
      recommendations: investigationData.recommendations || [],
      lessons_learned: investigationData.lessons_learned || [],
      
      timeline: {
        events: investigationData.timeline_events || [],
        total_events: investigationData.timeline_events?.length || 0
      },
      
      footer: {
        generated_by: window.mmsAuth?.currentUser?.email || 'System',
        generated_date: new Date().toISOString(),
        version: '1.0',
        confidential: 'CONFIDENTIAL - For MMS internal use only'
      }
    };
    
    return report;
  }

  calculateDuration(investigationData) {
    try {
      const start = investigationData.investigation_started?.toDate();
      const end = investigationData.investigation_completed?.toDate() || new Date();
      
      if (!start) return 'Unknown';
      
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 'Unknown';
    }
  }

  // ==================== UTILITIES ====================
  
  async getOpenInvestigations() {
    try {
      const q = query(
        collection(db, 'investigations'),
        where('company', '==', 'mms_metal_management'),
        where('status', 'in', ['In Progress', 'Assigned', 'Ready for Review']),
        orderBy('investigation_started', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const investigations = [];
      
      snapshot.forEach(doc => {
        investigations.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        data: investigations,
        count: investigations.length
      };
      
    } catch (error) {
      console.error('❌ Failed to get open investigations:', error);
      return {
        success: false,
        error: 'Failed to load investigations',
        data: []
      };
    }
  }

  async getInvestigationById(investigationId) {
    try {
      const docRef = doc(db, 'investigations', investigationId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: {
            id: docSnap.id,
            ...docSnap.data()
          }
        };
      } else {
        return {
          success: false,
          error: 'Investigation not found'
        };
      }
      
    } catch (error) {
      console.error('❌ Failed to get investigation:', error);
      return {
        success: false,
        error: 'Failed to load investigation'
      };
    }
  }
}

// Create global instance
const incidentInvestigator = new IncidentInvestigator();

// Global functions for UI
window.startInvestigation = async function(incidentId) {
  const user = window.mmsAuth?.currentUser;
  if (!user) {
    alert('Please login to start investigation');
    return;
  }
  
  const confirmed = confirm(`Start investigation for incident ${incidentId}?\n\nYou will be assigned as the investigator.`);
  if (!confirmed) return;
  
  const result = await incidentInvestigator.startInvestigation(incidentId, user.email);
  
  if (result.success) {
    alert(`✅ Investigation started!\n\nInvestigation ID: ${result.investigation_id}\nTemplate: ${result.template}\n\nNext: ${result.next_steps.title}`);
    // Refresh or redirect to investigation page
    setTimeout(() => location.reload(), 2000);
  } else {
    alert(`❌ Failed to start investigation:\n${result.error}`);
  }
};

window.generateInvestigationReport = async function(investigationId) {
  const result = await incidentInvestigator.getInvestigationById(investigationId);
  
  if (result.success) {
    const report = incidentInvestigator.generateInvestigationReport(result.data);
    
    // Create printable report
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
      <html>
        <head>
          <title>Investigation Report - ${report.header.report_id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .section-title { color: #dc2626; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${report.header.title}</h1>
            <p><strong>Company:</strong> ${report.header.company}</p>
            <p><strong>Report ID:</strong> ${report.header.report_id}</p>
            <p><strong>Date:</strong> ${report.header.date}</p>
          </div>
          
          <div class="section">
            <h2 class="section-title">Incident Details</h2>
            <table>
              <tr><th>Incident ID</th><td>${report.incident_details.incident_id}</td></tr>
              <tr><th>Type</th><td>${report.incident_details.type}</td></tr>
              <tr><th>Location</th><td>${report.incident_details.location}</td></tr>
              <tr><th>Date</th><td>${report.incident_details.date}</td></tr>
              <tr><th>Description</th><td>${report.incident_details.description}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2 class="section-title">Investigation Summary</h2>
            <table>
              <tr><th>Investigator</th><td>${report.investigation_details.investigator}</td></tr>
              <tr><th>Status</th><td>${report.investigation_details.status}</td></tr>
              <tr><th>Progress</th><td>${report.findings.progress}% (${report.findings.stages_completed}/${report.findings.total_stages} stages)</td></tr>
            </table>
          </div>
          
          <div class="footer">
            <p>${report.footer.confidential}</p>
            <p>Generated by: ${report.footer.generated_by} on ${new Date(report.footer.generated_date).toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    
  } else {
    alert(`Failed to generate report: ${result.error}`);
  }
};

// Make investigator globally available
window.incidentInvestigator = incidentInvestigator;

console.log('✅ Incident Investigator Toolkit Ready');
