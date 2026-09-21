/* ═══════════════════════════════════════════════════════════════
   MMS Safety — Compliance Manager
   ═══════════════════════════════════════════════════════════════

   Combines:
     1. ISO 45001:2018 alignment (Clauses 4–10, evidence packages,
        legal requirements, management review, corrective actions)
     2. GDPR / POPIA data protection (subject requests, consent,
        retention, breach reporting)

   Firestore collections used:
     ISO 45001:
       - compliance_obligations
       - management_reviews
       - corrective_actions
     GDPR / POPIA:
       - data_subject_requests
       - access_reports
       - consent_records
       - data_breaches
       - compliance_logs

   No mock data. No seed data. Empty collections render empty states.
   ═══════════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════════
// ISO 45001 CLAUSE REGISTER
// ═══════════════════════════════════════════════════════════════

const ISO_45001_CLAUSES = {
    '4': {
        title: 'Context of the Organization',
        category: 'Context',
        subclauses: {
            '4.1': { title: 'Understanding the organization and its context' },
            '4.2': { title: 'Understanding the needs and expectations of workers and interested parties', records: ['contractors', 'stakeholders'] },
            '4.3': { title: 'Determining the scope of the OH&S management system' },
            '4.4': { title: 'OH&S management system' }
        }
    },
    '5': {
        title: 'Leadership and Worker Participation',
        category: 'Leadership',
        subclauses: {
            '5.1': { title: 'Leadership and commitment' },
            '5.2': { title: 'OH&S policy' },
            '5.3': { title: 'Organizational roles, responsibilities and authorities' },
            '5.4': { title: 'Consultation and participation of workers' }
        }
    },
    '6': {
        title: 'Planning',
        category: 'Planning',
        subclauses: {
            '6.1.1': { title: 'General' },
            '6.1.2': { title: 'Hazard identification and assessment of risks and opportunities', records: ['hazards', 'riskAssessments'] },
            '6.1.3': { title: 'Determination of legal requirements and other requirements', records: ['compliance_obligations'] },
            '6.1.4': { title: 'Planning action' },
            '6.2':   { title: 'OH&S objectives and planning to achieve them' }
        }
    },
    '7': {
        title: 'Support',
        category: 'Support',
        subclauses: {
            '7.1': { title: 'Resources' },
            '7.2': { title: 'Competence', records: ['mmsTraining'] },
            '7.3': { title: 'Awareness' },
            '7.4': { title: 'Communication' },
            '7.5': { title: 'Documented information' }
        }
    },
    '8': {
        title: 'Operation',
        category: 'Operation',
        subclauses: {
            '8.1.1': { title: 'General operational planning and control' },
            '8.1.2': { title: 'Eliminating hazards and reducing OH&S risks', records: ['mmsRiskAssessments'] },
            '8.1.3': { title: 'Management of change' },
            '8.1.4': { title: 'Procurement', records: ['contractors'] },
            '8.2':   { title: 'Emergency preparedness and response', records: ['emergency_drills'] },
            '8.1':   { title: 'Incident management', records: ['mmsIncidents', 'mmsPPEItems'] }
        }
    },
    '9': {
        title: 'Performance Evaluation',
        category: 'Performance',
        subclauses: {
            '9.1.1': { title: 'General monitoring, measurement, analysis and performance evaluation' },
            '9.1.2': { title: 'Evaluation of compliance', records: ['mmsStandards', 'compliance_obligations'] },
            '9.2':   { title: 'Internal audit', records: ['mmsAudits'] },
            '9.3':   { title: 'Management review', records: ['management_reviews'] }
        }
    },
    '10': {
        title: 'Improvement',
        category: 'Improvement',
        subclauses: {
            '10.1': { title: 'General' },
            '10.2': { title: 'Incident, nonconformity and corrective action', records: ['corrective_actions', 'mmsIncidents'] },
            '10.3': { title: 'Continual improvement' }
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE MANAGER CLASS
// ═══════════════════════════════════════════════════════════════

class ComplianceManager {
    constructor() {
        this.COMPANY_NAME = 'Metal Management Solutions';
        this.COMPANY_ID = 'mms_metal_management';

        this.RETENTION_PERIODS = {
            INCIDENTS:        365 * 7,
            EMPLOYEE_HEALTH:  365 * 10,
            AUDIT_LOGS:       365 * 5,
            TRAINING_RECORDS: 365 * 5,
            PPE_RECORDS:      365 * 3,
            TEMPORARY_DATA:   30
        };

        this.SENSITIVE_FIELDS = [
            'blood_group', 'allergies', 'medical_conditions', 'emergency_contact',
            'phone_number', 'national_id', 'medical_records', 'password', 'social_security'
        ];

        console.log('[compliance-manager] Initialized');
    }

    // ═══════════════════════════════════════════════════════════
    // ISO 45001 — CLAUSE REGISTER
    // ═══════════════════════════════════════════════════════════

    getClauses() {
        return ISO_45001_CLAUSES;
    }

    getClauseById(id) {
        // Accepts '4', '6.1.2', '6.1', etc.
        const parts = String(id).split('.');
        const topLevel = ISO_45001_CLAUSES[parts[0]];
        if (!topLevel) return null;
        if (parts.length === 1) return { ...topLevel, id };

        // Subclause
        const sub = topLevel.subclauses[id] || topLevel.subclauses[parts.slice(0, 2).join('.')];
        if (!sub) return null;
        return { ...sub, id, parent: topLevel };
    }

    // ═══════════════════════════════════════════════════════════
    // ISO 45001 — EVIDENCE PACKAGE GENERATOR
    // ═══════════════════════════════════════════════════════════

    /**
     * Gather all records mapped to a clause's subclauses.
     * Returns a structured object ready for PDF export.
     */
    async generateEvidencePackage(clauseId) {
        const clause = this.getClauseById(clauseId);
        if (!clause) {
            return { success: false, error: `Clause ${clauseId} not found` };
        }

        const package_ = {
            clause_id: clauseId,
            clause_title: clause.title,
            generated_at: new Date().toISOString(),
            generated_by: window.mmsCurrentUser?.email || 'system',
            company: this.COMPANY_NAME,
            subclauses: []
        };

        // For each subclause, gather records
        const subclauses = clause.subclauses || { [clauseId]: clause };
        for (const [subId, sub] of Object.entries(subclauses)) {
            const subEntry = {
                subclause_id: subId,
                title: sub.title,
                records: []
            };

            if (sub.records && sub.records.length > 0) {
                for (const collectionName of sub.records) {
                    try {
                        const snap = await getDocs(collection(db, collectionName));
                        const items = [];
                        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
                        subEntry.records.push({
                            collection: collectionName,
                            count: items.length,
                            items: items.slice(0, 100) // cap for payload size
                        });
                    } catch (err) {
                        subEntry.records.push({
                            collection: collectionName,
                            count: 0,
                            error: err.code || err.message
                        });
                    }
                }
            }

            package_.subclauses.push(subEntry);
        }

        // Log the generation event
        await this.logComplianceEvent('evidence_package_generated', {
            clause_id: clauseId,
            generated_by: package_.generated_by
        });

        return { success: true, package: package_ };
    }

    // ═══════════════════════════════════════════════════════════
    // ISO 45001 — LEGAL REQUIREMENTS REGISTER (Clause 6.1.3)
    // ═══════════════════════════════════════════════════════════

    async listObligations() {
        const snap = await getDocs(collection(db, 'compliance_obligations'));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    async createObligation(data) {
        if (!data.title || !data.source) {
            return { success: false, error: 'Title and source are required' };
        }

        const id = 'OBL-' + Date.now();
        const record = {
            id,
            title: data.title,
            source: data.source,                       // e.g., 'OSHA', 'ISO 45001', 'Tanzania OSHA Act'
            reference: data.reference || '',           // e.g., 'Section 14(2)'
            jurisdiction: data.jurisdiction || '',     // e.g., 'Tanzania', 'Zambia'
            category: data.category || 'Legal',        // Legal / Other
            description: data.description || '',
            compliance_status: data.compliance_status || 'In Progress', // Compliant / Non-Compliant / In Progress / Pending Review
            owner: data.owner || (window.mmsCurrentUser?.email || ''),
            review_date: data.review_date || '',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown'
        };

        await setDoc(doc(db, 'compliance_obligations', id), record);
        await this.logComplianceEvent('obligation_created', { id, title: data.title });

        return { success: true, obligation: record };
    }

    async updateObligation(id, updates) {
        const ref = doc(db, 'compliance_obligations', id);
        await setDoc(ref, {
            ...updates,
            updated_at: serverTimestamp(),
            updated_by: window.mmsCurrentUser?.email || 'unknown'
        }, { merge: true });
        await this.logComplianceEvent('obligation_updated', { id, updates });
        return { success: true };
    }

    // ═══════════════════════════════════════════════════════════
    // ISO 45001 — MANAGEMENT REVIEW (Clause 9.3)
    // ═══════════════════════════════════════════════════════════

    async listManagementReviews() {
        const snap = await getDocs(collection(db, 'management_reviews'));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const da = a.review_date || a.created_at_iso || '';
            const db_ = b.review_date || b.created_at_iso || '';
            return db_.localeCompare(da);
        });
    }

    async createManagementReview(data) {
        if (!data.review_date || !data.chair) {
            return { success: false, error: 'Review date and chair are required' };
        }

        const id = 'MR-' + Date.now();
        const record = {
            id,
            review_date: data.review_date,
            period_covered: data.period_covered || '',
            chair: data.chair,
            attendees: data.attendees || [],
            location: data.location || '',
            // ISO 9.3 required inputs
            inputs: {
                previous_actions_status: data.previous_actions_status || '',
                external_internal_changes: data.external_internal_changes || '',
                interested_parties_needs: data.interested_parties_needs || '',
                ohs_performance: data.ohs_performance || '',        // incidents, NCs, audits
                legal_compliance: data.legal_compliance || '',
                resources_adequacy: data.resources_adequacy || '',
                opportunities_for_improvement: data.opportunities_for_improvement || ''
            },
            // ISO 9.3 required outputs
            outputs: {
                improvement_opportunities: data.improvement_opportunities || '',
                changes_needed: data.changes_needed || '',
                resource_needs: data.resource_needs || '',
                action_items: data.action_items || []
            },
            status: 'Completed',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown'
        };

        await setDoc(doc(db, 'management_reviews', id), record);
        await this.logComplianceEvent('management_review_created', {
            id, review_date: data.review_date, chair: data.chair
        });

        return { success: true, review: record };
    }

    // ═══════════════════════════════════════════════════════════
    // ISO 45001 — CORRECTIVE ACTIONS (Clause 10.2)
    // ═══════════════════════════════════════════════════════════

    async listCorrectiveActions() {
        const snap = await getDocs(collection(db, 'corrective_actions'));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const da = a.due_date || '';
            const db_ = b.due_date || '';
            return da.localeCompare(db_);
        });
    }

    async createCorrectiveAction(data) {
        if (!data.title || !data.source) {
            return { success: false, error: 'Title and source are required' };
        }

        const id = 'CA-' + Date.now();
        const record = {
            id,
            title: data.title,
            source: data.source,                 // 'incident' | 'audit' | 'inspection' | 'near_miss' | 'other'
            source_ref: data.source_ref || '',   // ID of the incident/audit record
            description: data.description || '',
            root_cause: data.root_cause || '',
            immediate_action: data.immediate_action || '',
            corrective_action: data.corrective_action || '',
            owner: data.owner || (window.mmsCurrentUser?.email || ''),
            due_date: data.due_date || '',
            priority: data.priority || 'Medium',       // Low / Medium / High / Critical
            status: 'Open',                            // Open / In Progress / Verified / Closed
            effectiveness_verified: false,
            verified_by: '',
            verified_at: '',
            created_at: serverTimestamp(),
            created_by: window.mmsCurrentUser?.email || 'unknown'
        };

        await setDoc(doc(db, 'corrective_actions', id), record);
        await this.logComplianceEvent('corrective_action_created', {
            id, title: data.title, priority: record.priority
        });

        return { success: true, action: record };
    }

    async updateCorrectiveAction(id, updates) {
        const ref = doc(db, 'corrective_actions', id);
        const patch = {
            ...updates,
            updated_at: serverTimestamp(),
            updated_by: window.mmsCurrentUser?.email || 'unknown'
        };
        if (updates.status === 'Closed') {
            patch.closed_at = serverTimestamp();
        }
        if (updates.effectiveness_verified === true) {
            patch.verified_by = window.mmsCurrentUser?.email || 'unknown';
            patch.verified_at = new Date().toISOString();
        }
        await setDoc(ref, patch, { merge: true });
        await this.logComplianceEvent('corrective_action_updated', { id, updates });
        return { success: true };
    }

    // ═══════════════════════════════════════════════════════════
    // GDPR / POPIA — DATA SUBJECT REQUESTS
    // ═══════════════════════════════════════════════════════════

    async processDataSubjectRequest(requestType, userId, userEmail, details = {}) {
        try {
            console.log(`[compliance] ${requestType} request for: ${userEmail}`);

            const requestId = 'DSR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

            const requestData = {
                request_id: requestId,
                request_type: requestType,
                user_id: userId,
                user_email: userEmail,
                requested_at: serverTimestamp(),
                status: 'received',
                details,
                company: this.COMPANY_ID,
                processed_by: window.mmsCurrentUser?.email || 'system',
                ip_address: await this.getClientIP(),
                response_due_date: this.calculateDueDate(30),
                verification_required: true,
                verification_status: 'pending'
            };

            await setDoc(doc(db, 'data_subject_requests', requestId), requestData);

            await this.logComplianceEvent('data_subject_request', {
                request_id: requestId,
                type: requestType,
                user_email: userEmail,
                action: 'request_received'
            });

            await this.handleRequestByType(requestType, userId, userEmail, requestId);

            return {
                success: true,
                request_id: requestId,
                message: `Your ${requestType} request has been received. Response due within 30 days.`,
                legal_notice: this.getLegalNotice(requestType)
            };
        } catch (error) {
            console.error('[compliance] Failed to process request:', error);
            return {
                success: false,
                error: 'Failed to process request. Please contact DPO.',
                legal_notice: 'Please contact our Data Protection Officer directly.'
            };
        }
    }

    async handleRequestByType(requestType, userId, userEmail, requestId) {
        const handlers = {
            access:        () => this.handleAccessRequest(userId, userEmail, requestId),
            rectification: () => this.updateRequestStatus(requestId, 'processing', 'Awaiting user-supplied corrections'),
            erasure:       () => this.handleErasureRequest(userId, userEmail, requestId),
            restriction:   () => this.updateRequestStatus(requestId, 'processing', 'Restriction applied pending review'),
            portability:   () => this.handlePortabilityRequest(userId, userEmail, requestId),
            objection:     () => this.updateRequestStatus(requestId, 'processing', 'Objection logged for review')
        };
        const fn = handlers[requestType];
        if (fn) await fn();
    }

    async handleAccessRequest(userId, userEmail, requestId) {
        const userData = await this.gatherUserData(userEmail);

        const report = {
            request_id: requestId,
            generated_at: new Date().toISOString(),
            data_subject: userEmail,
            data_collected: userData,
            processing_purposes: this.getProcessingPurposes(),
            third_parties: [],
            retention_periods: this.RETENTION_PERIODS,
            rights_explained: this.getDataSubjectRights()
        };

        await setDoc(doc(db, 'access_reports', requestId), report);
        await this.updateRequestStatus(requestId, 'processing', 'Access report generated');
        await this.notifyDPO('access_request', { request_id: requestId, user_email: userEmail, report_ready: true });
    }

    async handleErasureRequest(userId, userEmail, requestId) {
        await this.updateRequestStatus(
            requestId,
            'processing',
            'Erasure request logged. Legal retention obligations may prevent immediate deletion of some records.'
        );
    }

    async handlePortabilityRequest(userId, userEmail, requestId) {
        const data = await this.gatherUserData(userEmail);
        const report = {
            request_id: requestId,
            generated_at: new Date().toISOString(),
            data_subject: userEmail,
            portable_data: data
        };
        await setDoc(doc(db, 'access_reports', requestId), report);
        await this.updateRequestStatus(requestId, 'processing', 'Portability export generated');
    }

    async gatherUserData(userEmail) {
        const collected = {};
        const collectionsToScan = [
            'users', 'mmsIncidents', 'mmsTraining', 'mmsPPEItems',
            'mmsHealthRecords', 'consent_records'
        ];
        for (const c of collectionsToScan) {
            try {
                const q = query(collection(db, c), where('email', '==', userEmail));
                const snap = await getDocs(q);
                collected[c] = [];
                snap.forEach(d => collected[c].push({ id: d.id, ...d.data() }));
            } catch (err) {
                collected[c] = { error: err.code || err.message };
            }
        }
        return collected;
    }

    // ═══════════════════════════════════════════════════════════
    // GDPR / POPIA — RETENTION
    // ═══════════════════════════════════════════════════════════

    async enforceRetentionPolicies() {
        console.log('[compliance] Enforcing retention policies…');
        const results = { incidents_cleaned: 0, logs_cleaned: 0, errors: [] };

        try {
            const oldIncidents = await this.findExpiredRecords('mmsIncidents', this.RETENTION_PERIODS.INCIDENTS);
            if (oldIncidents.length > 0) {
                await this.anonymizeRecords(oldIncidents, 'mmsIncidents');
                results.incidents_cleaned = oldIncidents.length;
            }

            const oldLogs = await this.findExpiredRecords('compliance_logs', this.RETENTION_PERIODS.AUDIT_LOGS);
            if (oldLogs.length > 0) {
                await this.deleteRecords(oldLogs, 'compliance_logs');
                results.logs_cleaned = oldLogs.length;
            }

            await this.logComplianceEvent('retention_enforcement', results);
            return { success: true, ...results, enforced_at: new Date().toISOString() };
        } catch (error) {
            console.error('[compliance] Retention failed:', error);
            return { success: false, error: error.message, ...results };
        }
    }

    async findExpiredRecords(collectionName, maxAgeDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxAgeDays);
        const q = query(collection(db, collectionName), where('created_at', '<', cutoff));
        const snap = await getDocs(q);
        const expired = [];
        snap.forEach(d => expired.push({ id: d.id, ...d.data() }));
        return expired;
    }

    async anonymizeRecords(records, collectionName) {
        const batch = writeBatch(db);
        records.forEach(record => {
            const ref = doc(db, collectionName, record.id);
            const patch = this.anonymizeData(record);
            patch.anonymized_at = serverTimestamp();
            patch.anonymized_by = 'retention_policy';
            batch.update(ref, patch);
        });
        await batch.commit();
        console.log(`[compliance] Anonymized ${records.length} records in ${collectionName}`);
    }

    async deleteRecords(records, collectionName) {
        const batch = writeBatch(db);
        records.forEach(record => {
            batch.delete(doc(db, collectionName, record.id));
        });
        await batch.commit();
    }

    anonymizeData(record) {
        const out = { ...record };
        this.SENSITIVE_FIELDS.forEach(field => {
            if (out[field]) out[field] = '[ANONYMIZED]';
        });
        if (out.email && typeof out.email === 'string' && out.email.includes('@')) {
            const [local, domain] = out.email.split('@');
            out.email = local.charAt(0) + '***@' + domain;
        }
        if (out.name) out.name = 'Anonymous';
        if (out.reported_by) out.reported_by = 'Anonymous';
        return out;
    }

    // ═══════════════════════════════════════════════════════════
    // GDPR / POPIA — CONSENT
    // ═══════════════════════════════════════════════════════════

    async recordConsent(userEmail, consentType, granted = true, purpose = '') {
        try {
            const id = 'CONSENT-' + Date.now();
            const record = {
                consent_id: id,
                user_email: userEmail,
                consent_type: consentType,
                granted: !!granted,
                granted_at: serverTimestamp(),
                purpose: purpose || this.getConsentPurpose(consentType),
                version: '1.0',
                company: this.COMPANY_ID,
                ip_address: await this.getClientIP(),
                user_agent: navigator.userAgent,
                can_withdraw: true
            };
            await setDoc(doc(db, 'consent_records', id), record);
            await this.logComplianceEvent('consent_recorded', { user_email: userEmail, consent_type: consentType, granted });
            return { success: true, consent_id: id, legal_text: this.getConsentLegalText(consentType, granted) };
        } catch (error) {
            console.error('[compliance] Consent record failed:', error);
            return { success: false, error: 'Failed to record consent' };
        }
    }

    getConsentPurpose(consentType) {
        const purposes = {
            health_data:         'Processing employee health information for workplace safety',
            incident_reports:    'Recording and investigating workplace incidents',
            training_records:    'Maintaining safety training certifications',
            ppe_tracking:        'Managing personal protective equipment assignments',
            audit_participation: 'Including in safety audit reports',
            emergency_contact:   'Storing emergency contact information'
        };
        return purposes[consentType] || 'General safety management purposes';
    }

    // ═══════════════════════════════════════════════════════════
    // GDPR / POPIA — BREACH REPORTING
    // ═══════════════════════════════════════════════════════════

    async reportDataBreach(breachDetails) {
        try {
            const id = 'BREACH-' + Date.now();
            const data = {
                breach_id: id,
                reported_at: serverTimestamp(),
                reported_by: window.mmsCurrentUser?.email || 'unknown',
                severity: breachDetails.severity || 'unknown',
                description: breachDetails.description || '',
                data_affected: breachDetails.data_affected || [],
                affected_individuals: breachDetails.affected_count || 0,
                discovered_at: breachDetails.discovered_at || new Date().toISOString(),
                containment_status: 'investigating',
                notification_required: true,
                notification_deadline: this.calculateDueDate(72),
                company: this.COMPANY_ID,
                regulatory_notified: false,
                individuals_notified: false
            };
            await setDoc(doc(db, 'data_breaches', id), data);
            await this.logComplianceEvent('data_breach_reported', {
                breach_id: id,
                severity: data.severity,
                affected_count: data.affected_individuals
            });
            await this.notifyDPO('data_breach', { breach_id: id, severity: data.severity });
            return {
                success: true,
                breach_id: id,
                message: 'Data breach logged. DPO notification queued.',
                actions_taken: ['Breach logged', 'DPO notification queued']
            };
        } catch (error) {
            console.error('[compliance] Breach report failed:', error);
            return { success: false, error: 'Failed to log breach. Contact DPO immediately.' };
        }
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    calculateDueDate(daysFromNow) {
        const d = new Date();
        d.setDate(d.getDate() + daysFromNow);
        return d.toISOString();
    }

    async getClientIP() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }

    async logComplianceEvent(event, details) {
        try {
            const id = 'COMP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            await setDoc(doc(db, 'compliance_logs', id), {
                event,
                timestamp: serverTimestamp(),
                timestamp_iso: new Date().toISOString(),
                details,
                company: this.COMPANY_ID
            });
            return true;
        } catch (error) {
            console.warn('[compliance] Log failed:', error.code || error.message);
            return false;
        }
    }

    async updateRequestStatus(requestId, status, notes = '') {
        await setDoc(doc(db, 'data_subject_requests', requestId), {
            status,
            status_updated_at: serverTimestamp(),
            status_notes: notes
        }, { merge: true });
    }

    async notifyDPO(event, details) {
        // TODO: wire to email service (SendGrid / Firebase Functions) in Phase 4
        console.warn('[compliance] notifyDPO not yet wired to email — event:', event, details);
        await this.logComplianceEvent('dpo_notify_pending', {
            event, details, notification_sent: false
        });
    }

    // ═══════════════════════════════════════════════════════════
    // LEGAL TEXT
    // ═══════════════════════════════════════════════════════════

    getLegalNotice(requestType) {
        const notices = {
            access:        'Under Article 15 GDPR / Section 23 POPIA, you have the right to access your personal data.',
            erasure:       'Under Article 17 GDPR / Section 24 POPIA, you have the right to erasure, subject to legal retention obligations.',
            rectification: 'Under Article 16 GDPR / Section 24 POPIA, you have the right to rectification of inaccurate data.',
            portability:   'Under Article 20 GDPR / Section 23 POPIA, you have the right to data portability.',
            objection:     'Under Article 21 GDPR / Section 11 POPIA, you have the right to object to processing.',
            restriction:   'Under Article 18 GDPR, you have the right to restriction of processing.'
        };
        return notices[requestType] || 'Your request is being processed in accordance with applicable data protection law.';
    }

    getConsentLegalText(consentType, granted) {
        const base = granted
            ? `You have consented to ${consentType.replace(/_/g, ' ')} processing.`
            : `You have withdrawn consent for ${consentType.replace(/_/g, ' ')} processing.`;
        return `${base} You may withdraw consent at any time. Withdrawal does not affect lawfulness of prior processing.`;
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

    getProcessingPurposes() {
        return [
            'Workplace health and safety management',
            'Incident recording and investigation',
            'Regulatory compliance (OSHA / ISO 45001)',
            'Emergency response',
            'Training and competence tracking'
        ];
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC HELPERS
    // ═══════════════════════════════════════════════════════════

    async requestDataAccess(userEmail) {
        const u = window.mmsCurrentUser;
        if (!u) throw new Error('User not authenticated');
        return this.processDataSubjectRequest('access', u.uid, userEmail);
    }

    async requestDataDeletion(userEmail) {
        const u = window.mmsCurrentUser;
        if (!u) throw new Error('User not authenticated');
        return this.processDataSubjectRequest('erasure', u.uid, userEmail);
    }

    async runRetentionCleanup() {
        return this.enforceRetentionPolicies();
    }

    async getComplianceReport() {
        const snap = await getDocs(collection(db, 'compliance_logs'));
        const logs = [];
        snap.forEach(d => logs.push(d.data()));
        return {
            company: this.COMPANY_NAME,
            generated_at: new Date().toISOString(),
            data_protection_officer: 'dpo@mms.com',
            compliance_status: 'active',
            recent_activities: logs.slice(-10),
            next_review_date: this.calculateDueDate(90)
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// INSTANCE
// ═══════════════════════════════════════════════════════════════

const complianceManager = new ComplianceManager();
window.complianceManager = complianceManager;

// ═══════════════════════════════════════════════════════════════
// UI RENDERERS — populate the placeholder modals in dashboard.html
// ═══════════════════════════════════════════════════════════════

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isAdmin() {
    return !!(window.mmsCurrentUser && window.mmsCurrentUser.isAdmin);
}

// ─── Legal Requirements Register (Clause 6.1.3) ───
async function renderObligations() {
    const host = document.getElementById('complianceObligationsContent');
    if (!host) return;

    host.innerHTML = '<div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>';

    try {
        const items = await complianceManager.listObligations();

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:600;">Legal & Other Requirements Register</div>
                    <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">ISO 45001 Clause 6.1.3 — ${items.length} ${items.length === 1 ? 'entry' : 'entries'}</div>
                </div>
                ${isAdmin() ? '<button class="btn btn-primary" onclick="window.__cmShowObligationForm()">+ Add Requirement</button>' : ''}
            </div>
        `;

        if (items.length === 0) {
            html += `
                <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
                    <div style="font-size:3rem; margin-bottom:0.75rem;">⚖️</div>
                    <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No legal requirements recorded yet</div>
                    <div style="font-size:0.9rem;">Add the applicable laws, regulations, and standards your operations must comply with.</div>
                </div>`;
        } else {
            html += '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
                '<th>Title</th><th>Source</th><th>Jurisdiction</th><th>Status</th><th>Owner</th>' +
                '</tr></thead><tbody>';
            items.forEach(o => {
                const cls = o.compliance_status === 'Compliant' ? 'status-compliant'
                          : o.compliance_status === 'Non-Compliant' ? 'status-noncompliant'
                          : o.compliance_status === 'In Progress' ? 'status-inprogress'
                          : 'status-pending';
                html += `<tr>
                    <td><div style="font-weight:500;">${escapeHtml(o.title)}</div>${o.reference ? `<div style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(o.reference)}</div>` : ''}</td>
                    <td>${escapeHtml(o.source)}</td>
                    <td>${escapeHtml(o.jurisdiction || '—')}</td>
                    <td><span class="standard-status ${cls}">${escapeHtml(o.compliance_status)}</span></td>
                    <td style="font-size:0.78rem; color:#64748b;">${escapeHtml(o.owner || '—')}</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
        }

        host.innerHTML = html;
    } catch (err) {
        console.error('[compliance] renderObligations failed:', err);
        host.innerHTML = `<div style="text-align:center; padding:3rem; color:#991b1b;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not load requirements</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
        </div>`;
    }
}

window.__cmShowObligationForm = function () {
    const host = document.getElementById('complianceObligationsContent');
    if (!host) return;
    host.innerHTML = `
        <div style="font-weight:600; margin-bottom:1.25rem;">Add Legal / Other Requirement</div>
        <div class="form-group"><label>Title *</label><input id="cm-obl-title" placeholder="e.g., OSHA (Tanzania) Act 2003"></div>
        <div class="form-row">
            <div class="form-group"><label>Source *</label><input id="cm-obl-source" placeholder="e.g., Tanzania OSHA"></div>
            <div class="form-group"><label>Reference</label><input id="cm-obl-ref" placeholder="e.g., Section 14(2)"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Jurisdiction</label>
                <select id="cm-obl-juris">
                    <option value="">Select</option>
                    <option>South Africa</option><option>Tanzania</option>
                    <option>Namibia</option><option>Zambia</option>
                    <option>International</option>
                </select>
            </div>
            <div class="form-group"><label>Category</label>
                <select id="cm-obl-cat">
                    <option>Legal</option><option>Other</option>
                </select>
            </div>
        </div>
        <div class="form-group"><label>Description</label><textarea id="cm-obl-desc" rows="3"></textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Compliance Status</label>
                <select id="cm-obl-status">
                    <option>Compliant</option><option>Non-Compliant</option>
                    <option>In Progress</option><option>Pending Review</option>
                </select>
            </div>
            <div class="form-group"><label>Next Review Date</label><input type="date" id="cm-obl-review"></div>
        </div>
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__cmSaveObligation()">Save</button>
            <button class="btn btn-outline" onclick="window.__cmRenderObligations()">Cancel</button>
        </div>
    `;
};

window.__cmSaveObligation = async function () {
    const data = {
        title: document.getElementById('cm-obl-title').value.trim(),
        source: document.getElementById('cm-obl-source').value.trim(),
        reference: document.getElementById('cm-obl-ref').value.trim(),
        jurisdiction: document.getElementById('cm-obl-juris').value,
        category: document.getElementById('cm-obl-cat').value,
        description: document.getElementById('cm-obl-desc').value.trim(),
        compliance_status: document.getElementById('cm-obl-status').value,
        review_date: document.getElementById('cm-obl-review').value
    };
    const result = await complianceManager.createObligation(data);
    if (result.success) {
        window.__cmRenderObligations();
    } else {
        alert(result.error);
    }
};

window.__cmRenderObligations = renderObligations;

// ─── Management Reviews (Clause 9.3) ───
async function renderReviews() {
    const host = document.getElementById('managementReviewContent');
    if (!host) return;

    host.innerHTML = '<div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>';

    try {
        const items = await complianceManager.listManagementReviews();

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:600;">Management Review Register</div>
                    <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">ISO 45001 Clause 9.3 — ${items.length} ${items.length === 1 ? 'review' : 'reviews'}</div>
                </div>
                ${isAdmin() ? '<button class="btn btn-primary" onclick="window.__cmShowReviewForm()">+ New Review</button>' : ''}
            </div>
        `;

        if (items.length === 0) {
            html += `
                <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
                    <div style="font-size:3rem; margin-bottom:0.75rem;">📈</div>
                    <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No management reviews recorded yet</div>
                    <div style="font-size:0.9rem;">Top management reviews the OH&S system periodically per ISO 45001 Clause 9.3.</div>
                </div>`;
        } else {
            html += items.map(r => {
                const dateStr = r.review_date || '—';
                return `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem 1.25rem; margin-bottom:0.75rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
                            <div>
                                <div style="font-weight:600;">${escapeHtml(dateStr)} ${r.period_covered ? '— ' + escapeHtml(r.period_covered) : ''}</div>
                                <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">Chair: ${escapeHtml(r.chair || '—')} • Attendees: ${(r.attendees || []).length}</div>
                            </div>
                            <span class="standard-status status-compliant">${escapeHtml(r.status || 'Completed')}</span>
                        </div>
                        ${r.outputs?.improvement_opportunities ? `<div style="margin-top:0.65rem; font-size:0.85rem;"><strong>Improvements:</strong> ${escapeHtml(r.outputs.improvement_opportunities)}</div>` : ''}
                        ${r.outputs?.action_items?.length ? `<div style="margin-top:0.5rem; font-size:0.85rem; color:#64748b;">${r.outputs.action_items.length} action item(s)</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        host.innerHTML = html;
    } catch (err) {
        console.error('[compliance] renderReviews failed:', err);
        host.innerHTML = `<div style="text-align:center; padding:3rem; color:#991b1b;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not load reviews</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
        </div>`;
    }
}

window.__cmShowReviewForm = function () {
    const host = document.getElementById('managementReviewContent');
    if (!host) return;
    const today = new Date().toISOString().slice(0, 10);
    host.innerHTML = `
        <div style="font-weight:600; margin-bottom:1.25rem;">New Management Review</div>
        <div class="form-row">
            <div class="form-group"><label>Review Date *</label><input type="date" id="cm-mr-date" value="${today}"></div>
            <div class="form-group"><label>Period Covered</label><input id="cm-mr-period" placeholder="e.g., Q3 2026"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Chair *</label><input id="cm-mr-chair" placeholder="Name"></div>
            <div class="form-group"><label>Location</label><input id="cm-mr-loc" placeholder="e.g., Head Office"></div>
        </div>
        <div class="form-group"><label>Attendees (comma-separated emails or names)</label><input id="cm-mr-att" placeholder="a@mms.com, b@mms.com"></div>
        <div style="margin:1.25rem 0 0.75rem; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700;">ISO 9.3 Required Inputs</div>
        <div class="form-group"><label>Status of actions from previous reviews</label><textarea id="cm-mr-in-prev" rows="2"></textarea></div>
        <div class="form-group"><label>Changes in external and internal issues</label><textarea id="cm-mr-in-changes" rows="2"></textarea></div>
        <div class="form-group"><label>Needs and expectations of interested parties</label><textarea id="cm-mr-in-parties" rows="2"></textarea></div>
        <div class="form-group"><label>OH&S performance (incidents, nonconformities, audits)</label><textarea id="cm-mr-in-perf" rows="2"></textarea></div>
        <div class="form-group"><label>Adequacy of resources</label><textarea id="cm-mr-in-res" rows="2"></textarea></div>
        <div style="margin:1.25rem 0 0.75rem; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700;">ISO 9.3 Required Outputs</div>
        <div class="form-group"><label>Opportunities for improvement</label><textarea id="cm-mr-out-improve" rows="2"></textarea></div>
        <div class="form-group"><label>Changes needed to the OH&S management system</label><textarea id="cm-mr-out-change" rows="2"></textarea></div>
        <div class="form-group"><label>Resource needs</label><textarea id="cm-mr-out-res" rows="2"></textarea></div>
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__cmSaveReview()">Save Review</button>
            <button class="btn btn-outline" onclick="window.__cmRenderReviews()">Cancel</button>
        </div>
    `;
};

window.__cmSaveReview = async function () {
    const data = {
        review_date: document.getElementById('cm-mr-date').value,
        period_covered: document.getElementById('cm-mr-period').value.trim(),
        chair: document.getElementById('cm-mr-chair').value.trim(),
        location: document.getElementById('cm-mr-loc').value.trim(),
        attendees: document.getElementById('cm-mr-att').value.split(',').map(s => s.trim()).filter(Boolean),
        previous_actions_status: document.getElementById('cm-mr-in-prev').value.trim(),
        external_internal_changes: document.getElementById('cm-mr-in-changes').value.trim(),
        interested_parties_needs: document.getElementById('cm-mr-in-parties').value.trim(),
        ohs_performance: document.getElementById('cm-mr-in-perf').value.trim(),
        resources_adequacy: document.getElementById('cm-mr-in-res').value.trim(),
        improvement_opportunities: document.getElementById('cm-mr-out-improve').value.trim(),
        changes_needed: document.getElementById('cm-mr-out-change').value.trim(),
        resource_needs: document.getElementById('cm-mr-out-res').value.trim()
    };
    const result = await complianceManager.createManagementReview(data);
    if (result.success) {
        window.__cmRenderReviews();
    } else {
        alert(result.error);
    }
};

window.__cmRenderReviews = renderReviews;

// ─── Corrective Actions (Clause 10.2) ───
async function renderCorrectiveActions() {
    const host = document.getElementById('correctiveActionsContent');
    if (!host) return;

    host.innerHTML = '<div style="padding:3rem; text-align:center; color:#64748b;">Loading…</div>';

    try {
        const items = await complianceManager.listCorrectiveActions();

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:600;">Corrective Action Tracker</div>
                    <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem;">ISO 45001 Clause 10.2 — ${items.length} ${items.length === 1 ? 'action' : 'actions'}</div>
                </div>
                <button class="btn btn-primary" onclick="window.__cmShowActionForm()">+ New Action</button>
            </div>
        `;

        if (items.length === 0) {
            html += `
                <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
                    <div style="font-size:3rem; margin-bottom:0.75rem;">🛠️</div>
                    <div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No corrective actions recorded</div>
                    <div style="font-size:0.9rem;">Track nonconformities from incidents, audits, and inspections through to verified closure.</div>
                </div>`;
        } else {
            html += '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
                '<th>ID</th><th>Title</th><th>Source</th><th>Priority</th><th>Owner</th><th>Due</th><th>Status</th>' +
                '</tr></thead><tbody>';
            items.forEach(a => {
                const cls = a.status === 'Closed' ? 'status-compliant'
                          : a.status === 'Verified' ? 'status-compliant'
                          : a.status === 'In Progress' ? 'status-inprogress'
                          : 'status-pending';
                html += `<tr>
                    <td style="font-family:monospace; font-size:0.75rem;">${escapeHtml(a.id)}</td>
                    <td>${escapeHtml(a.title)}</td>
                    <td>${escapeHtml(a.source)}${a.source_ref ? `<div style="font-size:0.72rem; color:#94a3b8;">${escapeHtml(a.source_ref)}</div>` : ''}</td>
                    <td>${escapeHtml(a.priority || '—')}</td>
                    <td style="font-size:0.78rem; color:#64748b;">${escapeHtml(a.owner || '—')}</td>
                    <td style="font-size:0.78rem;">${escapeHtml(a.due_date || '—')}</td>
                    <td><span class="standard-status ${cls}">${escapeHtml(a.status)}</span></td>
                </tr>`;
            });
            html += '</tbody></table></div>';
        }

        host.innerHTML = html;
    } catch (err) {
        console.error('[compliance] renderCorrectiveActions failed:', err);
        host.innerHTML = `<div style="text-align:center; padding:3rem; color:#991b1b;">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">⚠️</div>
            <div style="font-weight:600;">Could not load corrective actions</div>
            <div style="font-size:0.85rem; margin-top:0.35rem;">${escapeHtml(err.code || err.message)}</div>
        </div>`;
    }
}

window.__cmShowActionForm = function () {
    const host = document.getElementById('correctiveActionsContent');
    if (!host) return;
    host.innerHTML = `
        <div style="font-weight:600; margin-bottom:1.25rem;">New Corrective Action</div>
        <div class="form-group"><label>Title *</label><input id="cm-ca-title" placeholder="Short description"></div>
        <div class="form-row">
            <div class="form-group"><label>Source *</label>
                <select id="cm-ca-source">
                    <option value="">Select</option>
                    <option value="incident">Incident</option>
                    <option value="audit">Audit finding</option>
                    <option value="inspection">Inspection</option>
                    <option value="near_miss">Near miss</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group"><label>Source Reference (ID)</label><input id="cm-ca-ref" placeholder="e.g., INC-123456"></div>
        </div>
        <div class="form-group"><label>Description</label><textarea id="cm-ca-desc" rows="2"></textarea></div>
        <div class="form-group"><label>Root cause analysis</label><textarea id="cm-ca-root" rows="2"></textarea></div>
        <div class="form-group"><label>Immediate action taken</label><textarea id="cm-ca-imm" rows="2"></textarea></div>
        <div class="form-group"><label>Corrective action planned</label><textarea id="cm-ca-corr" rows="2"></textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Owner</label><input id="cm-ca-owner" placeholder="Responsible person"></div>
            <div class="form-group"><label>Due Date</label><input type="date" id="cm-ca-due"></div>
        </div>
        <div class="form-group"><label>Priority</label>
            <select id="cm-ca-priority">
                <option>Low</option><option selected>Medium</option>
                <option>High</option><option>Critical</option>
            </select>
        </div>
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="window.__cmSaveAction()">Save Action</button>
            <button class="btn btn-outline" onclick="window.__cmRenderCorrectiveActions()">Cancel</button>
        </div>
    `;
};

window.__cmSaveAction = async function () {
    const data = {
        title: document.getElementById('cm-ca-title').value.trim(),
        source: document.getElementById('cm-ca-source').value,
        source_ref: document.getElementById('cm-ca-ref').value.trim(),
        description: document.getElementById('cm-ca-desc').value.trim(),
        root_cause: document.getElementById('cm-ca-root').value.trim(),
        immediate_action: document.getElementById('cm-ca-imm').value.trim(),
        corrective_action: document.getElementById('cm-ca-corr').value.trim(),
        owner: document.getElementById('cm-ca-owner').value.trim(),
        due_date: document.getElementById('cm-ca-due').value,
        priority: document.getElementById('cm-ca-priority').value
    };
    const result = await complianceManager.createCorrectiveAction(data);
    if (result.success) {
        window.__cmRenderCorrectiveActions();
    } else {
        alert(result.error);
    }
};

window.__cmRenderCorrectiveActions = renderCorrectiveActions;

// ═══════════════════════════════════════════════════════════════
// AUTO-BIND — hook into modal open (works whether app.js loaded
// before or after this module)
// ═══════════════════════════════════════════════════════════════

function attachModalObserver() {
    const targets = {
        complianceObligationsModal: renderObligations,
        managementReviewModal:      renderReviews,
        correctiveActionsModal:     renderCorrectiveActions
    };

    Object.keys(targets).forEach(id => {
        const modal = document.getElementById(id);
        if (!modal) {
            console.warn('[compliance] Modal not found:', id);
            return;
        }
        // Initial render if modal starts open (rare)
        if (modal.classList.contains('show')) targets[id]();

        // Watch for class changes (openModal adds .show)
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('show')) targets[id]();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    console.log('[compliance] Modal observers attached');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachModalObserver);
} else {
    attachModalObserver();
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL WINDOW HELPERS
// ═══════════════════════════════════════════════════════════════

window.requestMyData = async function () {
    const u = window.mmsCurrentUser;
    if (!u) { alert('Please sign in first.'); return; }

    const confirmed = confirm(
        'REQUEST PERSONAL DATA ACCESS\n\n' +
        'You are requesting a copy of all personal data we hold about you.\n\n' +
        '✓ We will provide this within 30 days\n' +
        '✓ Data will be in readable format\n' +
        '✓ Free of charge\n\n' +
        'Continue with request?'
    );
    if (!confirmed) return;

    const result = await complianceManager.requestDataAccess(u.email);
    if (result.success) {
        alert('✅ Request submitted!\n\nRequest ID: ' + result.request_id + '\n\n' + result.message + '\n\n' + result.legal_notice);
    } else {
        alert('❌ Request failed: ' + result.error);
    }
};

window.runComplianceCheck = async function () {
    if (!isAdmin()) { alert('Admin access required.'); return; }

    const confirmed = confirm(
        'RUN COMPLIANCE CHECK\n\n' +
        'This will:\n' +
        '✓ Enforce data retention policies\n' +
        '✓ Anonymize records past retention\n' +
        '✓ Delete expired compliance logs\n\n' +
        'Continue?'
    );
    if (!confirmed) return;

    const result = await complianceManager.runRetentionCleanup();
    if (result.success) {
        alert(
            '✅ Compliance check complete!\n\n' +
            'Records cleaned:\n' +
            '• Incidents: ' + result.incidents_cleaned + '\n' +
            '• Compliance logs: ' + result.logs_cleaned
        );
    } else {
        alert('❌ Compliance check failed: ' + result.error);
    }
};

window.getComplianceReport = async function () {
    const result = await complianceManager.getComplianceReport();
    console.log('Compliance Report:', result);
    const summary =
        'MMS SAFETY SYSTEM — COMPLIANCE REPORT\n' +
        'Generated: ' + result.generated_at + '\n' +
        'Company: ' + result.company + '\n' +
        'DPO: ' + result.data_protection_officer + '\n' +
        'Status: ' + result.compliance_status + '\n' +
        'Next Review: ' + result.next_review_date;
    alert(summary);
};

window.generateEvidencePackage = async function (clauseId) {
    const result = await complianceManager.generateEvidencePackage(clauseId);
    if (!result.success) {
        alert('Failed: ' + result.error);
        return;
    }
    console.log('Evidence package:', result.package);
    // Download JSON for now — PDF export in Phase 2
    const blob = new Blob([JSON.stringify(result.package, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evidence-' + clauseId + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

console.log('[compliance-manager] Ready');