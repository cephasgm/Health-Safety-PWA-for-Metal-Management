// Chemical Register Module - MMS Safety
import { mmsDB } from './database-service.js';

class ChemicalRegister {
    constructor() {
        this.hazardClasses = [
            'Flammable', 'Corrosive', 'Toxic', 'Oxidizing', 'Explosive',
            'Compressed Gas', 'Health Hazard', 'Environmental Hazard',
            'Irritant', 'Carcinogen', 'Mutagen', 'Reproductive Toxin'
        ];
        
        this.storageRequirements = [
            'Flammable Cabinet', 'Corrosive Cabinet', 'Fume Hood',
            'Refrigerator', 'Safety Can', 'Gas Cylinder Cage',
            'Ventilated Storage', 'Secondary Containment'
        ];
        
        this.safetyLevels = ['Low', 'Medium', 'High', 'Extreme'];
        this.init();
    }
    
    init() {
        console.log('🧪 Chemical Register Module Initialized');
        this.loadChemicalRegister();
    }
    
    async loadChemicalRegister() {
        try {
            const saved = localStorage.getItem('mmsChemicalRegister');
            if (saved) {
                this.chemicals = JSON.parse(saved);
            } else {
                this.chemicals = await this.getDefaultChemicals();
                this.saveChemicalRegister();
            }
            
            return this.chemicals;
        } catch (error) {
            console.error('Failed to load chemical register:', error);
            return [];
        }
    }
    
    async getDefaultChemicals() {
        // Sample chemicals for metal industry
        return [
            {
                id: 'CHEM-001',
                name: 'Hydrochloric Acid',
                casNumber: '7647-01-0',
                formula: 'HCl',
                manufacturer: 'ChemCo Inc.',
                supplier: 'Industrial Chemicals Ltd.',
                hazardClass: 'Corrosive',
                hazardSymbols: ['GHS05', 'GHS07'],
                riskPhrases: 'Causes severe skin burns and eye damage',
                safetyPhrases: 'Wear protective gloves/protective clothing/eye protection/face protection',
                storageRequirements: 'Corrosive Cabinet',
                safetyLevel: 'High',
                location: 'Cape Town HQ',
                storageArea: 'Chemical Store A',
                quantity: '25L',
                unit: 'liters',
                maxQuantity: '50L',
                reorderLevel: '10L',
                lastInventory: '2024-02-15',
                nextInventory: '2024-03-15',
                sdsAvailable: true,
                sdsLocation: 'Safety Office - Cabinet 3',
                handlingRequirements: 'Use in fume hood, wear acid-resistant PPE',
                disposalMethod: 'Neutralize with base, dispose as hazardous waste',
                emergencyProcedures: 'Use eyewash station, neutralize spills with sodium bicarbonate'
            },
            {
                id: 'CHEM-002',
                name: 'Acetone',
                casNumber: '67-64-1',
                formula: 'C3H6O',
                manufacturer: 'SolventPro',
                supplier: 'Chemical Supplies SA',
                hazardClass: 'Flammable',
                hazardSymbols: ['GHS02', 'GHS07'],
                riskPhrases: 'Highly flammable liquid and vapor',
                safetyPhrases: 'Keep away from heat/sparks/open flames/hot surfaces',
                storageRequirements: 'Flammable Cabinet',
                safetyLevel: 'Medium',
                location: 'Cosco Durban',
                storageArea: 'Flammables Store',
                quantity: '40L',
                unit: 'liters',
                maxQuantity: '100L',
                reorderLevel: '20L',
                lastInventory: '2024-02-10',
                nextInventory: '2024-03-10',
                sdsAvailable: true,
                sdsLocation: 'Online Portal',
                handlingRequirements: 'Use in well-ventilated area, no smoking',
                disposalMethod: 'Recycle through licensed contractor',
                emergencyProcedures: 'Use foam extinguisher, contain spill with absorbent'
            }
        ];
    }
    
    saveChemicalRegister() {
        localStorage.setItem('mmsChemicalRegister', JSON.stringify(this.chemicals));
    }
    
    // Chemical Management
    async addChemical(chemicalData) {
        try {
            const chemicalId = `CHEM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            
            const newChemical = {
                id: chemicalId,
                ...chemicalData,
                registeredDate: new Date().toISOString(),
                registeredBy: window.mmsAuth?.currentUser?.email || 'System',
                status: 'Active',
                inventoryHistory: [],
                incidentHistory: []
            };
            
            this.chemicals.push(newChemical);
            this.saveChemicalRegister();
            
            // Log to Firebase
            if (window.mmsDB) {
                await mmsDB.logAction('chemical_added', {
                    chemical_id: chemicalId,
                    name: chemicalData.name,
                    hazard_class: chemicalData.hazardClass,
                    location: chemicalData.location
                });
            }
            
            console.log(`✅ Chemical registered: ${chemicalId}`);
            return { success: true, id: chemicalId, chemical: newChemical };
            
        } catch (error) {
            console.error('Failed to add chemical:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Inventory Management
    async updateInventory(chemicalId, inventoryData) {
        try {
            const chemical = this.chemicals.find(chem => chem.id === chemicalId);
            if (!chemical) {
                return { success: false, error: 'Chemical not found' };
            }
            
            const inventoryRecord = {
                date: new Date().toISOString(),
                previousQuantity: chemical.quantity,
                newQuantity: inventoryData.quantity,
                adjustment: inventoryData.adjustment || 0,
                reason: inventoryData.reason || 'Routine inventory',
                performedBy: window.mmsAuth?.currentUser?.email || 'System',
                notes: inventoryData.notes
            };
            
            // Update chemical
            chemical.quantity = inventoryData.quantity;
            chemical.lastInventory = new Date().toISOString();
            
            if (!chemical.inventoryHistory) {
                chemical.inventoryHistory = [];
            }
            chemical.inventoryHistory.push(inventoryRecord);
            
            // Check reorder level
            const needsReorder = this.checkReorderNeeded(chemical);
            if (needsReorder) {
                await this.generateReorderAlert(chemical);
            }
            
            this.saveChemicalRegister();
            
            console.log(`✅ Inventory updated: ${chemicalId}`);
            return { 
                success: true, 
                chemical: chemical,
                needsReorder: needsReorder
            };
            
        } catch (error) {
            console.error('Failed to update inventory:', error);
            return { success: false, error: error.message };
        }
    }
    
    checkReorderNeeded(chemical) {
        if (!chemical.quantity || !chemical.reorderLevel || !chemical.unit) {
            return false;
        }
        
        const currentQty = parseFloat(chemical.quantity);
        const reorderLevel = parseFloat(chemical.reorderLevel);
        
        return currentQty <= reorderLevel;
    }
    
    async generateReorderAlert(chemical) {
        const alert = {
            chemicalId: chemical.id,
            chemicalName: chemical.name,
            currentQuantity: chemical.quantity,
            reorderLevel: chemical.reorderLevel,
            location: chemical.location,
            alertDate: new Date().toISOString(),
            urgency: chemical.safetyLevel === 'High' ? 'HIGH' : 'MEDIUM'
        };
        
        // Save alert
        if (!this.reorderAlerts) {
            this.reorderAlerts = [];
        }
        this.reorderAlerts.push(alert);
        localStorage.setItem('mmsChemicalAlerts', JSON.stringify(this.reorderAlerts));
        
        // Log to Firebase
        if (window.mmsDB) {
            await mmsDB.logAction('chemical_reorder_alert', alert);
        }
        
        return alert;
    }
    
    // Risk Assessment
    calculateChemicalRisk(chemical) {
        let riskScore = 0;
        
        // Hazard class scoring
        const hazardScores = {
            'Extreme': 4, 'High': 3, 'Medium': 2, 'Low': 1
        };
        
        // Safety level
        riskScore += hazardScores[chemical.safetyLevel] || 2;
        
        // Quantity factor
        const quantity = parseFloat(chemical.quantity) || 0;
        if (quantity > 100) riskScore += 2;
        else if (quantity > 50) riskScore += 1;
        
        // Location factor
        const sensitiveAreas = ['Office', 'Workshop', 'Near exits'];
        if (sensitiveAreas.some(area => chemical.location.includes(area))) {
            riskScore += 1;
        }
        
        // SDS availability
        if (!chemical.sdsAvailable) riskScore += 2;
        
        return {
            score: riskScore,
            level: riskScore >= 5 ? 'High Risk' : riskScore >= 3 ? 'Medium Risk' : 'Low Risk',
            factors: [
                `Safety Level: ${chemical.safetyLevel}`,
                `Quantity: ${chemical.quantity}`,
                `SDS: ${chemical.sdsAvailable ? 'Available' : 'Missing'}`
            ]
        };
    }
    
    // MSDS/SDS Management
    async recordSDS(chemicalId, sdsData) {
        try {
            const chemical = this.chemicals.find(chem => chem.id === chemicalId);
            if (!chemical) {
                return { success: false, error: 'Chemical not found' };
            }
            
            chemical.sdsAvailable = true;
            chemical.sdsLocation = sdsData.location;
            chemical.sdsExpiry = sdsData.expiryDate;
            chemical.sdsReviewDate = sdsData.reviewDate || new Date().toISOString();
            
            if (!chemical.sdsHistory) {
                chemical.sdsHistory = [];
            }
            
            chemical.sdsHistory.push({
                date: new Date().toISOString(),
                action: sdsData.action || 'SDS recorded',
                location: sdsData.location,
                reviewedBy: window.mmsAuth?.currentUser?.email || 'System'
            });
            
            this.saveChemicalRegister();
            
            console.log(`✅ SDS recorded for: ${chemicalId}`);
            return { success: true, chemical: chemical };
            
        } catch (error) {
            console.error('Failed to record SDS:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Reports
    getChemicalsByHazardClass(hazardClass) {
        return this.chemicals.filter(chem => chem.hazardClass === hazardClass);
    }
    
    getChemicalsByLocation(location) {
        return this.chemicals.filter(chem => chem.location === location);
    }
    
    getExpiringSDS(daysThreshold = 30) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
        
        return this.chemicals.filter(chemical => {
            if (!chemical.sdsExpiry) return false;
            const expiryDate = new Date(chemical.sdsExpiry);
            return expiryDate <= thresholdDate && expiryDate >= new Date();
        });
    }
    
    getReorderAlerts() {
        return this.chemicals.filter(chem => this.checkReorderNeeded(chem));
    }
    
    // Emergency Information
    getEmergencyInfo(chemicalId) {
        const chemical = this.chemicals.find(chem => chem.id === chemicalId);
        if (!chemical) return null;
        
        return {
            name: chemical.name,
            hazardClass: chemical.hazardClass,
            emergencyProcedures: chemical.emergencyProcedures,
            firstAid: chemical.firstAid || 'Refer to SDS',
            fireFighting: chemical.fireFighting || 'Use appropriate extinguisher for chemical class',
            spillProcedure: chemical.spillProcedure || 'Contain and absorb with appropriate material',
            protectiveEquipment: chemical.handlingRequirements || 'Wear appropriate PPE',
            sdsLocation: chemical.sdsLocation,
            emergencyContacts: ['Safety Officer: +27 21 123 4567', 'Poison Control: +27 21 555 1234']
        };
    }
    
    // Statistics
    getChemicalStatistics() {
        const totalChemicals = this.chemicals.length;
        const byHazard = {};
        const byLocation = {};
        
        this.chemicals.forEach(chem => {
            // Count by hazard class
            byHazard[chem.hazardClass] = (byHazard[chem.hazardClass] || 0) + 1;
            
            // Count by location
            byLocation[chem.location] = (byLocation[chem.location] || 0) + 1;
        });
        
        const sdsMissing = this.chemicals.filter(chem => !chem.sdsAvailable).length;
        const reorderNeeded = this.getReorderAlerts().length;
        const highRisk = this.chemicals.filter(chem => 
            this.calculateChemicalRisk(chem).level === 'High Risk'
        ).length;
        
        return {
            totalChemicals,
            byHazard,
            byLocation,
            sdsMissing,
            reorderNeeded,
            highRisk,
            complianceRate: totalChemicals > 0 ? 
                Math.round(((totalChemicals - sdsMissing) / totalChemicals) * 100) : 0
        };
    }
}

// Create and export instance
const chemicalRegister = new ChemicalRegister();

// UI Integration Functions
window.openChemicalRegister = function() {
    const modal = createChemicalModal();
    document.body.appendChild(modal);
    chemicalRegister.loadChemicalRegister().then(() => {
        renderChemicalTable();
    });
};

window.addNewChemical = function() {
    const form = createChemicalForm();
    document.body.appendChild(form);
};

window.viewChemicalDetails = function(chemicalId) {
    const chemical = chemicalRegister.chemicals.find(chem => chem.id === chemicalId);
    if (chemical) {
        const modal = createChemicalDetailModal(chemical);
        document.body.appendChild(modal);
    }
};

window.updateChemicalInventory = function(chemicalId) {
    const chemical = chemicalRegister.chemicals.find(chem => chem.id === chemicalId);
    if (chemical) {
        const modal = createInventoryModal(chemical);
        document.body.appendChild(modal);
    }
};

// Make globally available
window.chemicalRegister = chemicalRegister;

console.log('✅ Chemical Register Module Ready');
