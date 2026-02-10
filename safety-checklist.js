// Safety Checklist System - MMS Safety
import { mmsDB } from './database-service.js';

class SafetyChecklistSystem {
    constructor() {
        this.checklists = {
            daily: this.getDailyChecklist(),
            weekly: this.getWeeklyChecklist(),
            monthly: this.getMonthlyChecklist(),
            equipment: this.getEquipmentChecklist(),
            site: this.getSiteInspectionChecklist()
        };
        this.init();
    }

    init() {
        console.log('✅ Safety Checklist System Initialized');
        this.loadUserChecklists();
    }

    getDailyChecklist() {
        return {
            id: 'DAILY_SAFETY_CHECK',
            title: 'Daily Safety Inspection',
            frequency: 'daily',
            department: 'All',
            items: [
                { id: 'DAILY_1', question: 'Are all emergency exits clear and unobstructed?', type: 'yes_no', critical: true },
                { id: 'DAILY_2', question: 'Are fire extinguishers in place and charged?', type: 'yes_no', critical: true },
                { id: 'DAILY_3', question: 'Are first aid kits fully stocked?', type: 'yes_no', critical: true },
                { id: 'DAILY_4', question: 'Are safety signs visible and legible?', type: 'yes_no', critical: false },
                { id: 'DAILY_5', question: 'Are walkways clear of trip hazards?', type: 'yes_no', critical: true },
                { id: 'DAILY_6', question: 'Is PPE being worn correctly?', type: 'yes_no', critical: true },
                { id: 'DAILY_7', question: 'Are machines properly guarded?', type: 'yes_no', critical: true },
                { id: 'DAILY_8', question: 'Are chemical containers properly labeled?', type: 'yes_no', critical: true },
                { id: 'DAILY_9', question: 'Is housekeeping satisfactory?', type: 'yes_no_na', critical: false },
                { id: 'DAILY_10', question: 'Any safety concerns to report?', type: 'text', critical: false }
            ],
            locations: ['All'],
            required_by: ['safety_officer', 'supervisor']
        };
    }

    getWeeklyChecklist() {
        return {
            id: 'WEEKLY_EQUIPMENT_CHECK',
            title: 'Weekly Equipment Safety Check',
            frequency: 'weekly',
            department: 'Operations',
            items: [
                { id: 'WEEKLY_1', question: 'Check forklift brakes and steering', type: 'yes_no_na', critical: true },
                { id: 'WEEKLY_2', question: 'Inspect crane cables and hooks', type: 'yes_no_na', critical: true },
                { id: 'WEEKLY_3', question: 'Test emergency stop buttons', type: 'yes_no', critical: true },
                { id: 'WEEKLY_4', question: 'Check welding equipment grounding', type: 'yes_no_na', critical: true },
                { id: 'WEEKLY_5', question: 'Inspect electrical panels and cords', type: 'yes_no', critical: true },
                { id: 'WEEKLY_6', question: 'Test ventilation systems', type: 'yes_no_na', critical: false },
                { id: 'WEEKLY_7', question: 'Check compressed air systems', type: 'yes_no_na', critical: false }
            ],
            locations: ['Warehouse', 'Manufacturing'],
            required_by: ['maintenance', 'safety_officer']
        };
    }

    getMonthlyChecklist() {
        return {
            id: 'MONTHLY_COMPLIANCE_CHECK',
            title: 'Monthly Compliance Audit',
            frequency: 'monthly',
            department: 'Safety',
            items: [
                { id: 'MONTHLY_1', question: 'Review incident reports and trends', type: 'rating_5', critical: false },
                { id: 'MONTHLY_2', question: 'Check training completion rates', type: 'percentage', critical: false },
                { id: 'MONTHLY_3', question: 'Verify PPE inspection records', type: 'yes_no', critical: true },
                { id: 'MONTHLY_4', question: 'Review risk assessment updates', type: 'yes_no', critical: true },
                { id: 'MONTHLY_5', question: 'Check emergency drill records', type: 'yes_no', critical: true },
                { id: 'MONTHLY_6', question: 'Verify contractor safety compliance', type: 'yes_no', critical: false },
                { id: 'MONTHLY_7', question: 'Review safety committee minutes', type: 'yes_no', critical: false }
            ],
            locations: ['All'],
            required_by: ['safety_officer', 'manager']
        };
    }

    getEquipmentChecklist() {
        return {
            id: 'EQUIPMENT_SAFETY_CHECK',
            title: 'Equipment Pre-Use Safety Check',
            frequency: 'per_use',
            department: 'Operations',
            items: [
                { id: 'EQ_1', question: 'Equipment appears in good condition', type: 'yes_no', critical: true },
                { id: 'EQ_2', question: 'All safety guards are in place', type: 'yes_no', critical: true },
                { id: 'EQ_3', question: 'Emergency stops are functional', type: 'yes_no', critical: true },
                { id: 'EQ_4', question: 'Warning labels are visible', type: 'yes_no', critical: false },
                { id: 'EQ_5', question: 'No unusual noises or vibrations', type: 'yes_no', critical: true },
                { id: 'EQ_6', question: 'Operator is trained and certified', type: 'yes_no', critical: true },
                { id: 'EQ_7', question: 'Work area is clear and safe', type: 'yes_no', critical: true }
            ],
            locations: ['Manufacturing', 'Warehouse'],
            required_by: ['operator', 'supervisor']
        };
    }

    getSiteInspectionChecklist() {
        return {
            id: 'SITE_INSPECTION',
            title: 'Construction Site Safety Inspection',
            frequency: 'daily',
            department: 'Construction',
            items: [
                { id: 'SITE_1', question: 'Perimeter fencing and signage in place', type: 'yes_no', critical: true },
                { id: 'SITE_2', question: 'Excavations properly supported', type: 'yes_no', critical: true },
                { id: 'SITE_3', question: 'Scaffolding erected by certified personnel', type: 'yes_no', critical: true },
                { id: 'SITE_4', question: 'Fall protection in use at height', type: 'yes_no', critical: true },
                { id: 'SITE_5', question: 'Electrical tools grounded and tagged', type: 'yes_no', critical: true },
                { id: 'SITE_6', question: 'Hot work permits current', type: 'yes_no', critical: true },
                { id: 'SITE_7', question: 'Material storage stable and secure', type: 'yes_no', critical: true }
            ],
            locations: ['Construction'],
            required_by: ['site_supervisor', 'safety_officer']
        };
    }

    async loadUserChecklists() {
        try {
            const userRole = window.mmsAuth?.userRole || 'employee';
            const userLocation = window.mmsAuth?.userLocation || 'Unknown';
            
            // Filter checklists by user role and location
            this.availableChecklists = {};
            
            for (const [key, checklist] of Object.entries(this.checklists)) {
                if (this.canAccessChecklist(checklist, userRole, userLocation)) {
                    this.availableChecklists[key] = checklist;
                }
            }
            
            console.log(`Loaded ${Object.keys(this.availableChecklists).length} checklists for ${userRole}`);
            return this.availableChecklists;
            
        } catch (error) {
            console.error('Failed to load checklists:', error);
            return {};
        }
    }

    canAccessChecklist(checklist, userRole, userLocation) {
        // Check role access
        if (!checklist.required_by.includes(userRole) && userRole !== 'admin') {
            return false;
        }
        
        // Check location access
        if (!checklist.locations.includes('All') && 
            !checklist.locations.includes(userLocation)) {
            return false;
        }
        
        return true;
    }

    async startChecklist(checklistId) {
        const checklist = this.checklists[checklistId] || this.availableChecklists[checklistId];
        if (!checklist) {
            throw new Error('Checklist not found');
        }
        
        const sessionId = `CHK-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const session = {
            session_id: sessionId,
            checklist_id: checklist.id,
            checklist_title: checklist.title,
            started_at: new Date().toISOString(),
            started_by: window.mmsAuth?.currentUser?.email,
            started_by_role: window.mmsAuth?.userRole,
            location: window.mmsAuth?.userLocation,
            status: 'in_progress',
            items: checklist.items.map(item => ({
                ...item,
                answer: null,
                comment: '',
                timestamp: null,
                photos: []
            })),
            score: 0,
            critical_findings: 0
        };
        
        // Save session to localStorage for continuity
        localStorage.setItem(`checklist_session_${sessionId}`, JSON.stringify(session));
        
        return {
            success: true,
            session: session,
            checklist: checklist
        };
    }

    async saveChecklistAnswer(sessionId, itemId, answer, comment = '', photos = []) {
        try {
            const sessionKey = `checklist_session_${sessionId}`;
            const session = JSON.parse(localStorage.getItem(sessionKey));
            
            if (!session) {
                throw new Error('Session not found');
            }
            
            // Update item answer
            const itemIndex = session.items.findIndex(item => item.id === itemId);
            if (itemIndex === -1) {
                throw new Error('Item not found in checklist');
            }
            
            session.items[itemIndex].answer = answer;
            session.items[itemIndex].comment = comment;
            session.items[itemIndex].photos = photos;
            session.items[itemIndex].timestamp = new Date().toISOString();
            
            // Recalculate scores
            this.calculateSessionScores(session);
            
            // Save updated session
            localStorage.setItem(sessionKey, JSON.stringify(session));
            
            return {
                success: true,
                session: session,
                updated_item: session.items[itemIndex]
            };
            
        } catch (error) {
            console.error('Failed to save checklist answer:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateSessionScores(session) {
        let totalScore = 0;
        let maxScore = 0;
        let criticalFindings = 0;
        
        session.items.forEach(item => {
            if (item.type === 'yes_no' || item.type === 'yes_no_na') {
                maxScore += 1;
                if (item.answer === 'yes') {
                    totalScore += 1;
                } else if (item.answer === 'no' && item.critical) {
                    criticalFindings++;
                }
            } else if (item.type === 'rating_5') {
                maxScore += 5;
                totalScore += parseInt(item.answer) || 0;
            }
        });
        
        session.score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        session.critical_findings = criticalFindings;
        
        return session;
    }

    async completeChecklist(sessionId) {
        try {
            const sessionKey = `checklist_session_${sessionId}`;
            const session = JSON.parse(localStorage.getItem(sessionKey));
            
            if (!session) {
                throw new Error('Session not found');
            }
            
            session.status = 'completed';
            session.completed_at = new Date().toISOString();
            session.completed_by = window.mmsAuth?.currentUser?.email;
            
            // Final score calculation
            this.calculateSessionScores(session);
            
            // Save to Firebase
            if (window.mmsDB) {
                const result = await window.mmsDB.saveChecklistResult(session);
                if (result.success) {
                    console.log('Checklist saved to cloud:', sessionId);
                }
            }
            
            // Save to localStorage as completed
            localStorage.setItem(sessionKey, JSON.stringify(session));
            
            // Archive completed checklists
            this.archiveCompletedSession(sessionId);
            
            return {
                success: true,
                session: session,
                message: 'Checklist completed successfully'
            };
            
        } catch (error) {
            console.error('Failed to complete checklist:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    archiveCompletedSession(sessionId) {
        const sessionKey = `checklist_session_${sessionId}`;
        const session = JSON.parse(localStorage.getItem(sessionKey));
        
        if (session) {
            // Move to completed archive
            const completedKey = `completed_checklist_${sessionId}`;
            localStorage.setItem(completedKey, JSON.stringify(session));
            
            // Remove from active sessions
            localStorage.removeItem(sessionKey);
        }
    }

    async getChecklistHistory(days = 30) {
        try {
            const history = [];
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            // Get from localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('completed_checklist_')) {
                    const session = JSON.parse(localStorage.getItem(key));
                    if (new Date(session.completed_at) >= cutoffDate) {
                        history.push(session);
                    }
                }
            }
            
            // Sort by date (newest first)
            history.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
            
            return {
                success: true,
                history: history,
                count: history.length
            };
            
        } catch (error) {
            console.error('Failed to get checklist history:', error);
            return {
                success: false,
                history: [],
                error: error.message
            };
        }
    }

    generateChecklistReport(session) {
        const report = {
            title: `Safety Checklist Report - ${session.checklist_title}`,
            date: session.completed_at,
            location: session.location,
            conducted_by: session.completed_by,
            score: `${session.score}%`,
            critical_findings: session.critical_findings,
            items: []
        };
        
        session.items.forEach(item => {
            report.items.push({
                question: item.question,
                answer: item.answer,
                comment: item.comment,
                critical: item.critical,
                status: item.critical && item.answer === 'no' ? 'FAIL' : 'PASS'
            });
        });
        
        return report;
    }

    renderChecklistUI(checklistId, containerId) {
        const checklist = this.checklists[checklistId];
        if (!checklist) {
            console.error('Checklist not found:', checklistId);
            return;
        }
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        let html = `
            <div class="checklist-container" style="background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: #1e293b; font-size: 1.25rem; font-weight: 600;">${checklist.title}</h3>
                    <div style="font-size: 0.875rem; color: #64748b; background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 20px;">
                        ${checklist.frequency.toUpperCase()} • ${checklist.department}
                    </div>
                </div>
                
                <div class="checklist-items">
        `;
        
        checklist.items.forEach((item, index) => {
            html += this.renderChecklistItem(item, index);
        });
        
        html += `
                </div>
                
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="window.safetyChecklist?.saveChecklistDraft()">
                            💾 Save Draft
                        </button>
                        <button class="btn btn-primary" onclick="window.safetyChecklist?.completeCurrentChecklist()">
                            ✅ Complete Checklist
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Initialize session
        this.startChecklist(checklistId).then(result => {
            if (result.success) {
                window.currentChecklistSession = result.session;
                console.log('Checklist session started:', result.session.session_id);
            }
        });
    }

    renderChecklistItem(item, index) {
        let inputHtml = '';
        
        switch(item.type) {
            case 'yes_no':
            case 'yes_no_na':
                inputHtml = `
                    <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="item_${item.id}" value="yes" 
                                   onchange="window.safetyChecklist?.updateItemAnswer('${item.id}', 'yes')">
                            <span>✅ Yes</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="item_${item.id}" value="no"
                                   onchange="window.safetyChecklist?.updateItemAnswer('${item.id}', 'no')">
                            <span>❌ No</span>
                        </label>
                        ${item.type === 'yes_no_na' ? `
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="item_${item.id}" value="na"
                                       onchange="window.safetyChecklist?.updateItemAnswer('${item.id}', 'na')">
                                <span>➖ N/A</span>
                            </label>
                        ` : ''}
                    </div>
                `;
                break;
                
            case 'rating_5':
                inputHtml = `
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        ${[1,2,3,4,5].map(rating => `
                            <button style="
                                padding: 0.5rem 0.75rem;
                                border: 1px solid #e2e8f0;
                                border-radius: 6px;
                                background: white;
                                cursor: pointer;
                                transition: all 0.2s;
                            " onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff'"
                              onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='white'"
                              onclick="window.safetyChecklist?.updateItemAnswer('${item.id}', '${rating}')">
                                ${rating}
                            </button>
                        `).join('')}
                    </div>
                `;
                break;
                
            case 'text':
                inputHtml = `
                    <textarea style="
                        width: 100%;
                        padding: 0.75rem;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        margin-top: 0.5rem;
                        font-family: inherit;
                        resize: vertical;
                        min-height: 80px;
                    " placeholder="Enter details here..."
                      onchange="window.safetyChecklist?.updateItemComment('${item.id}', this.value)"></textarea>
                `;
                break;
        }
        
        return `
            <div class="checklist-item" style="
                padding: 1rem;
                margin-bottom: 1rem;
                border: 1px solid ${item.critical ? '#fecaca' : '#e2e8f0'};
                border-radius: 8px;
                background: ${item.critical ? '#fef2f2' : 'white'};
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-weight: 500; color: #1e293b;">
                        ${index + 1}. ${item.question}
                    </div>
                    ${item.critical ? `
                        <div style="
                            font-size: 0.75rem;
                            background: #fee2e2;
                            color: #991b1b;
                            padding: 0.25rem 0.5rem;
                            border-radius: 4px;
                            font-weight: 600;
                        ">
                            CRITICAL
                        </div>
                    ` : ''}
                </div>
                
                ${inputHtml}
                
                ${item.type !== 'text' ? `
                    <div style="margin-top: 0.75rem;">
                        <input type="text" style="
                            width: 100%;
                            padding: 0.5rem;
                            border: 1px solid #e2e8f0;
                            border-radius: 6px;
                            font-size: 0.875rem;
                        " placeholder="Add comment (optional)"
                          onchange="window.safetyChecklist?.updateItemComment('${item.id}', this.value)">
                    </div>
                ` : ''}
                
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b;">
                    ${item.critical ? '⚠️ Critical safety item - must be addressed immediately if "No"' : ''}
                </div>
            </div>
        `;
    }

    // Helper methods for UI
    updateItemAnswer(itemId, answer) {
        if (!window.currentChecklistSession) return;
        
        this.saveChecklistAnswer(
            window.currentChecklistSession.session_id,
            itemId,
            answer
        ).then(result => {
            if (result.success) {
                window.currentChecklistSession = result.session;
                this.updateProgressUI();
            }
        });
    }

    updateItemComment(itemId, comment) {
        if (!window.currentChecklistSession) return;
        
        const session = window.currentChecklistSession;
        const itemIndex = session.items.findIndex(item => item.id === itemId);
        
        if (itemIndex !== -1) {
            session.items[itemIndex].comment = comment;
            localStorage.setItem(
                `checklist_session_${session.session_id}`,
                JSON.stringify(session)
            );
        }
    }

    updateProgressUI() {
        if (!window.currentChecklistSession) return;
        
        const session = window.currentChecklistSession;
        const totalItems = session.items.length;
        const completedItems = session.items.filter(item => item.answer !== null).length;
        const percentage = Math.round((completedItems / totalItems) * 100);
        
        // Update progress bar if exists
        const progressBar = document.getElementById('checklistProgress');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${completedItems}/${totalItems}`;
        }
        
        // Update score display
        const scoreDisplay = document.getElementById('checklistScore');
        if (scoreDisplay) {
            scoreDisplay.textContent = `${session.score}%`;
        }
    }

    saveChecklistDraft() {
        if (!window.currentChecklistSession) {
            alert('No active checklist session');
            return;
        }
        
        const session = window.currentChecklistSession;
        localStorage.setItem(
            `checklist_session_${session.session_id}`,
            JSON.stringify(session)
        );
        
        alert('Checklist draft saved successfully');
    }

    async completeCurrentChecklist() {
        if (!window.currentChecklistSession) {
            alert('No active checklist session');
            return;
        }
        
        const session = window.currentChecklistSession;
        const result = await this.completeChecklist(session.session_id);
        
        if (result.success) {
            alert(`Checklist completed!\n\nScore: ${session.score}%\nCritical Findings: ${session.critical_findings}`);
            
            // Generate report
            const report = this.generateChecklistReport(session);
            
            // Show report modal
            this.showChecklistReport(report);
            
            // Clear current session
            window.currentChecklistSession = null;
        } else {
            alert('Failed to complete checklist: ' + result.error);
        }
    }

    showChecklistReport(report) {
        const modalHtml = `
            <div style="
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
            ">
                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 2rem;
                    max-width: 800px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h2 style="color: #1e293b;">Checklist Report</h2>
                        <button onclick="this.closest('div[style*=\"fixed\"]').remove()" style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            cursor: pointer;
                            color: #64748b;
                        ">×</button>
                    </div>
                    
                    <div style="margin-bottom: 2rem;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                                <div style="font-size: 0.875rem; color: #64748b;">Title</div>
                                <div style="font-weight: 600;">${report.title}</div>
                            </div>
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                                <div style="font-size: 0.875rem; color: #64748b;">Score</div>
                                <div style="font-weight: 600; color: ${parseInt(report.score) > 80 ? '#10b981' : parseInt(report.score) > 60 ? '#f59e0b' : '#ef4444'}">
                                    ${report.score}
                                </div>
                            </div>
                            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                                <div style="font-size: 0.875rem; color: #64748b;">Critical Findings</div>
                                <div style="font-weight: 600; color: ${report.critical_findings > 0 ? '#ef4444' : '#10b981'}">
                                    ${report.critical_findings}
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 1.5rem;">
                            <h3 style="color: #1e293b; margin-bottom: 1rem; font-size: 1.125rem;">Items</h3>
                            <div style="background: #f8fafc; border-radius: 8px; overflow: hidden;">
                                ${report.items.map((item, index) => `
                                    <div style="
                                        padding: 1rem;
                                        border-bottom: 1px solid #e2e8f0;
                                        background: ${item.status === 'FAIL' ? '#fef2f2' : 'white'};
                                    ">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <div style="font-weight: 500;">${index + 1}. ${item.question}</div>
                                            <div style="
                                                font-size: 0.75rem;
                                                padding: 0.25rem 0.5rem;
                                                border-radius: 4px;
                                                background: ${item.status === 'FAIL' ? '#fee2e2' : '#dcfce7'};
                                                color: ${item.status === 'FAIL' ? '#991b1b' : '#166534'};
                                                font-weight: 600;
                                            ">
                                                ${item.status}
                                            </div>
                                        </div>
                                        <div style="font-size: 0.875rem; color: #475569;">
                                            <strong>Answer:</strong> ${item.answer || 'Not answered'}
                                        </div>
                                        ${item.comment ? `
                                            <div style="font-size: 0.875rem; color: #475569; margin-top: 0.25rem;">
                                                <strong>Comment:</strong> ${item.comment}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="window.safetyChecklist?.downloadReport(${JSON.stringify(report).replace(/"/g, '&quot;')})">
                            📥 Download PDF
                        </button>
                        <button class="btn btn-primary" onclick="this.closest('div[style*=\"fixed\"]').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    downloadReport(report) {
        // Simple text report download
        let reportText = `MMS SAFETY CHECKLIST REPORT\n`;
        reportText += `============================\n\n`;
        reportText += `Title: ${report.title}\n`;
        reportText += `Date: ${report.date}\n`;
        reportText += `Location: ${report.location}\n`;
        reportText += `Conducted By: ${report.conducted_by}\n`;
        reportText += `Score: ${report.score}\n`;
        reportText += `Critical Findings: ${report.critical_findings}\n\n`;
        reportText += `ITEMS:\n`;
        reportText += `------\n`;
        
        report.items.forEach((item, index) => {
            reportText += `${index + 1}. ${item.question}\n`;
            reportText += `   Answer: ${item.answer || 'N/A'}\n`;
            reportText += `   Status: ${item.status}\n`;
            if (item.comment) {
                reportText += `   Comment: ${item.comment}\n`;
            }
            reportText += `\n`;
        });
        
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MMS_Checklist_Report_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize and export
const safetyChecklist = new SafetyChecklistSystem();
window.safetyChecklist = safetyChecklist;

console.log('✅ Safety Checklist System Ready');
