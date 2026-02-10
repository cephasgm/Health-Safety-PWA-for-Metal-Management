// Equipment Inspections Module - MMS Safety
import { mmsDB } from './database-service.js';

class EquipmentInspections {
    constructor() {
        this.equipmentTypes = [
            'Forklift', 'Crane', 'Hoist', 'Conveyor', 'Press Machine',
            'Welding Machine', 'Grinder', 'Drill Press', 'Lathe', 'Mill',
            'Compressor', 'Generator', 'Boiler', 'Chiller', 'HVAC System',
            'Fire Extinguisher', 'Fire Alarm System', 'Emergency Shower',
            'Eye Wash Station', 'First Aid Kit', 'Safety Harness', 'Ladder',
            'Scaffolding', 'PPE Station', 'Chemical Storage', 'Electrical Panel'
        ];
        
        this.inspectionStatuses = [
            'Scheduled', 'In Progress', 'Completed', 'Failed', 'Overdue'
        ];
        
        this.init();
    }
    
    init() {
        console.log('🔧 Equipment Inspections Module Initialized');
        this.loadEquipmentList();
    }
    
    async loadEquipmentList() {
        try {
            // Load from Firebase or localStorage
            const saved = localStorage.getItem('mmsEquipment');
            if (saved) {
                this.equipmentList = JSON.parse(saved);
            } else {
                this.equipmentList = await this.getDefaultEquipment();
                this.saveEquipmentList();
            }
            
            return this.equipmentList;
        } catch (error) {
            console.error('Failed to load equipment:', error);
            return [];
        }
    }
    
    async getDefaultEquipment() {
        // Sample equipment data for MMS
        return [
            {
                id: 'EQP-001',
                name: 'Forklift - Toyota 8FGU25',
                type: 'Forklift',
                location: 'Cape Town HQ',
                serialNumber: 'FL-CT-2023-001',
                manufacturer: 'Toyota',
                model: '8FGU25',
                year: 2023,
                lastInspection: '2024-01-15',
                nextInspection: '2024-04-15',
                inspectionFrequency: 'Quarterly',
                status: 'Operational',
                assignedTo: 'Warehouse Team',
                maintenanceHistory: [
                    { date: '2024-01-15', type: 'Routine', performedBy: 'John Doe', notes: 'All systems OK' }
                ]
            },
            {
                id: 'EQP-002',
                name: 'Overhead Crane - 5 Ton',
                type: 'Crane',
                location: 'Cosco Durban',
                serialNumber: 'CR-DBN-2022-001',
                manufacturer: 'Kone Cranes',
                model: 'KCL 5T',
                year: 2022,
                lastInspection: '2024-02-01',
                nextInspection: '2024-05-01',
                inspectionFrequency: 'Quarterly',
                status: 'Operational',
                assignedTo: 'Loading Bay',
                maintenanceHistory: [
                    { date: '2024-02-01', type: 'Safety Check', performedBy: 'Safety Officer', notes: 'Brakes adjusted' }
                ]
            }
        ];
    }
    
    saveEquipmentList() {
        localStorage.setItem('mmsEquipment', JSON.stringify(this.equipmentList));
    }
    
    // Equipment Management
    async addEquipment(equipmentData) {
        try {
            const equipmentId = `EQP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            
            const newEquipment = {
                id: equipmentId,
                ...equipmentData,
                createdDate: new Date().toISOString(),
                createdBy: window.mmsAuth?.currentUser?.email || 'System',
                status: 'Active',
                inspectionHistory: [],
                maintenanceHistory: []
            };
            
            this.equipmentList.push(newEquipment);
            this.saveEquipmentList();
            
            // Save to Firebase if available
            if (window.mmsDB) {
                await mmsDB.logAction('equipment_added', {
                    equipment_id: equipmentId,
                    type: equipmentData.type,
                    location: equipmentData.location
                });
            }
            
            console.log(`✅ Equipment added: ${equipmentId}`);
            return { success: true, id: equipmentId, equipment: newEquipment };
            
        } catch (error) {
            console.error('Failed to add equipment:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Inspection Management
    async scheduleInspection(equipmentId, inspectionData) {
        try {
            const equipment = this.equipmentList.find(eq => eq.id === equipmentId);
            if (!equipment) {
                return { success: false, error: 'Equipment not found' };
            }
            
            const inspectionId = `INS-${Date.now()}`;
            const inspection = {
                id: inspectionId,
                equipmentId: equipmentId,
                equipmentName: equipment.name,
                scheduledDate: inspectionData.scheduledDate,
                dueDate: inspectionData.dueDate,
                assignedTo: inspectionData.assignedTo || 'Safety Officer',
                status: 'Scheduled',
                createdBy: window.mmsAuth?.currentUser?.email || 'System',
                createdAt: new Date().toISOString()
            };
            
            // Add to equipment's inspection history
            if (!equipment.inspectionHistory) {
                equipment.inspectionHistory = [];
            }
            equipment.inspectionHistory.push(inspection);
            
            // Update next inspection date
            equipment.nextInspection = inspectionData.dueDate;
            
            this.saveEquipmentList();
            
            console.log(`✅ Inspection scheduled: ${inspectionId}`);
            return { success: true, inspection: inspection };
            
        } catch (error) {
            console.error('Failed to schedule inspection:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Complete Inspection
    async completeInspection(equipmentId, inspectionId, results) {
        try {
            const equipment = this.equipmentList.find(eq => eq.id === equipmentId);
            if (!equipment) {
                return { success: false, error: 'Equipment not found' };
            }
            
            const inspection = equipment.inspectionHistory.find(ins => ins.id === inspectionId);
            if (!inspection) {
                return { success: false, error: 'Inspection not found' };
            }
            
            // Update inspection
            inspection.status = 'Completed';
            inspection.completedDate = new Date().toISOString();
            inspection.completedBy = window.mmsAuth?.currentUser?.email || 'System';
            inspection.results = results;
            
            // Update equipment
            equipment.lastInspection = new Date().toISOString();
            equipment.status = results.passed ? 'Operational' : 'Needs Repair';
            
            if (results.notes) {
                equipment.maintenanceHistory.push({
                    date: new Date().toISOString(),
                    type: 'Inspection',
                    performedBy: inspection.completedBy,
                    notes: results.notes
                });
            }
            
            this.saveEquipmentList();
            
            // Log to Firebase
            if (window.mmsDB) {
                await mmsDB.logAction('inspection_completed', {
                    equipment_id: equipmentId,
                    inspection_id: inspectionId,
                    passed: results.passed,
                    findings: results.findings?.length || 0
                });
            }
            
            console.log(`✅ Inspection completed: ${inspectionId}`);
            return { success: true, inspection: inspection };
            
        } catch (error) {
            console.error('Failed to complete inspection:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Reports
    getOverdueInspections() {
        const today = new Date();
        return this.equipmentList.filter(equipment => {
            if (!equipment.nextInspection) return false;
            const dueDate = new Date(equipment.nextInspection);
            return dueDate < today && equipment.status !== 'Out of Service';
        });
    }
    
    getEquipmentByLocation(location) {
        return this.equipmentList.filter(eq => eq.location === location);
    }
    
    getInspectionSchedule(startDate, endDate) {
        const schedule = [];
        this.equipmentList.forEach(equipment => {
            if (equipment.nextInspection) {
                const dueDate = new Date(equipment.nextInspection);
                if (dueDate >= new Date(startDate) && dueDate <= new Date(endDate)) {
                    schedule.push({
                        equipment: equipment.name,
                        type: equipment.type,
                        location: equipment.location,
                        dueDate: equipment.nextInspection,
                        status: equipment.status,
                        assignedTo: equipment.assignedTo
                    });
                }
            }
        });
        
        return schedule.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }
    
    // Statistics
    getInspectionStatistics() {
        const totalEquipment = this.equipmentList.length;
        const operational = this.equipmentList.filter(eq => eq.status === 'Operational').length;
        const needsRepair = this.equipmentList.filter(eq => eq.status === 'Needs Repair').length;
        const outOfService = this.equipmentList.filter(eq => eq.status === 'Out of Service').length;
        
        const overdue = this.getOverdueInspections().length;
        const inspectionsThisMonth = this.equipmentList.reduce((count, eq) => {
            if (eq.lastInspection) {
                const lastInspection = new Date(eq.lastInspection);
                const now = new Date();
                if (lastInspection.getMonth() === now.getMonth() && 
                    lastInspection.getFullYear() === now.getFullYear()) {
                    return count + 1;
                }
            }
            return count;
        }, 0);
        
        return {
            totalEquipment,
            operational,
            needsRepair,
            outOfService,
            overdue,
            inspectionsThisMonth,
            complianceRate: totalEquipment > 0 ? 
                Math.round(((totalEquipment - overdue) / totalEquipment) * 100) : 0
        };
    }
}

// Create and export instance
const equipmentInspections = new EquipmentInspections();

// UI Integration Functions
window.openEquipmentInspections = function() {
    const modal = createEquipmentModal();
    document.body.appendChild(modal);
    equipmentInspections.loadEquipmentList().then(() => {
        renderEquipmentTable();
    });
};

window.scheduleEquipmentInspection = function(equipmentId) {
    const equipment = equipmentInspections.equipmentList.find(eq => eq.id === equipmentId);
    if (!equipment) {
        alert('Equipment not found');
        return;
    }
    
    const modal = createInspectionModal(equipment);
    document.body.appendChild(modal);
};

window.completeEquipmentInspection = function(equipmentId, inspectionId) {
    const results = promptForInspectionResults();
    equipmentInspections.completeInspection(equipmentId, inspectionId, results)
        .then(result => {
            if (result.success) {
                alert('Inspection completed successfully!');
                window.openEquipmentInspections();
            } else {
                alert('Failed: ' + result.error);
            }
        });
};

// Make globally available
window.equipmentInspections = equipmentInspections;

console.log('✅ Equipment Inspections Module Ready');
