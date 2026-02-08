// Main Application Logic for MMS Safety Dashboard
class MMSSafetyApp {
    constructor() {
        this.employees = [];
        this.incidents = [];
        this.ppeItems = [];
        this.audits = [];
        this.standards = [];
        this.currentSection = 'dashboard';
        this.currentCountryTab = 'all';
        this.currentChart = null;
        
        this.init();
    }

    init() {
        // Load all data
        this.loadAllData();
        
        // Initialize UI
        this.initUI();
        
        // Initialize charts
        this.initCharts();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update statistics
        this.updateStatistics();
        
        // Show dashboard by default
        this.showSection('dashboard');
    }

    loadAllData() {
        // Load employees
        const savedEmployees = localStorage.getItem('mms_employees');
        this.employees = savedEmployees ? JSON.parse(savedEmployees) : this.getDefaultEmployees();
        
        // Load incidents
        const savedIncidents = localStorage.getItem('mms_incidents');
        this.incidents = savedIncidents ? JSON.parse(savedIncidents) : [];
        
        // Load PPE items
        const savedPPE = localStorage.getItem('mms_ppe');
        this.ppeItems = savedPPE ? JSON.parse(savedPPE) : [];
        
        // Load audits
        const savedAudits = localStorage.getItem('mms_audits');
        this.audits = savedAudits ? JSON.parse(savedAudits) : [];
        
        // Load standards
        const savedStandards = localStorage.getItem('mms_standards');
        this.standards = savedStandards ? JSON.parse(savedStandards) : this.getDefaultStandards();
    }

    getDefaultEmployees() {
        return [
            // South Africa
            {
                id: 'SA001',
                name: 'Katlego Matsane',
                position: 'Inventory Control Specialist',
                country: 'south-africa',
                location: 'Cape Town (HQ)',
                department: 'Inventory',
                joinDate: '2022-01-15',
                status: 'Active',
                safetyTraining: 'Completed',
                lastMedical: '2024-01-15',
                nextMedical: '2025-01-15'
            },
            {
                id: 'SA002',
                name: 'Bonnie Sibande',
                position: 'Inventory Control Specialist',
                country: 'south-africa',
                location: 'Cape Town (HQ)',
                department: 'Inventory',
                joinDate: '2022-03-01',
                status: 'Active',
                safetyTraining: 'Completed',
                lastMedical: '2024-02-01',
                nextMedical: '2025-02-01'
            },
            // Zambia Team
            {
                id: 'ZM001',
                name: 'Alick Banda',
                position: 'Inventory Control Specialist',
                country: 'zambia',
                location: 'AGL Chingola Hub',
                department: 'Inventory',
                joinDate: '2021-06-01',
                status: 'Active',
                safetyTraining: 'Completed',
                lastMedical: '2024-01-20',
                nextMedical: '2025-01-20'
            },
            {
                id: 'ZM002',
                name: 'Alinaswe Mwanamoonga',
                position: 'Inventory Control Specialist',
                country: 'zambia',
                location: 'Polytra Kitwe',
                department: 'Inventory',
                joinDate: '2021-08-15',
                status: 'Active',
                safetyTraining: 'Completed',
                lastMedical: '2024-02-15',
                nextMedical: '2025-02-15'
            },
            // Add more default employees as needed
        ];
    }

    getDefaultStandards() {
        return [
            {
                id: 'STD001',
                name: 'ISO 45001:2018',
                code: 'ISO45001',
                type: 'International',
                status: 'Compliant',
                effectiveDate: '2024-01-01',
                description: 'Occupational health and safety management systems'
            },
            {
                id: 'STD002',
                name: 'OSHA Regulations',
                code: 'OSHA-29CFR',
                type: 'National',
                status: 'Compliant',
                effectiveDate: '2024-01-01',
                description: 'Workplace safety and health standards'
            }
        ];
    }

    saveAllData() {
        localStorage.setItem('mms_employees', JSON.stringify(this.employees));
        localStorage.setItem('mms_incidents', JSON.stringify(this.incidents));
        localStorage.setItem('mms_ppe', JSON.stringify(this.ppeItems));
        localStorage.setItem('mms_audits', JSON.stringify(this.audits));
        localStorage.setItem('mms_standards', JSON.stringify(this.standards));
    }

    initUI() {
        // Update employee count
        document.getElementById('totalEmployees').textContent = this.employees.length;
        
        // Update incident count
        const ltiCount = this.incidents.filter(i => i.severity === 'Critical').length;
        document.getElementById('lostTimeInjuries').textContent = ltiCount;
        
        // Calculate compliance rate
        const compliantStandards = this.standards.filter(s => s.status === 'Compliant').length;
        const complianceRate = this.standards.length > 0 ? 
            Math.round((compliantStandards / this.standards.length) * 100) : 100;
        document.getElementById('complianceRate').textContent = complianceRate + '%';
        
        // Update audit count
        const activeAudits = this.audits.filter(a => a.status === 'Active' || a.status === 'In Progress').length;
        document.getElementById('activeAudits').textContent = activeAudits;
    }

    initCharts() {
        const ctx = document.getElementById('safetyChart').getContext('2d');
        
        // Sample data for safety chart
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const incidentData = [3, 5, 2, 4, 1, 2];
        const trainingData = [15, 20, 18, 22, 25, 20];
        const auditData = [8, 10, 12, 9, 11, 13];
        
        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Incidents',
                        data: incidentData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Training Sessions',
                        data: trainingData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Audits Conducted',
                        data: auditData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.target.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (section) this.showSection(section);
            });
        });

        // Country tabs
        document.querySelectorAll('.country-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const country = e.target.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (country) this.showCountryTab(country);
            });
        });

        // Save data on window close
        window.addEventListener('beforeunload', () => {
            this.saveAllData();
        });

        // Online/Offline detection
        window.addEventListener('online', () => {
            this.showToast('Back online', 'success');
        });

        window.addEventListener('offline', () => {
            this.showToast('Working offline', 'warning');
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected section
        const section = document.getElementById(`${sectionId}-section`);
        if (section) {
            section.classList.add('active');
            
            // Add active class to corresponding nav item
            const navItem = document.querySelector(`.nav-item[onclick*="${sectionId}"]`);
            if (navItem) navItem.classList.add('active');
            
            this.currentSection = sectionId;
            
            // Load section data
            this.loadSectionData(sectionId);
        }
    }

    showCountryTab(country) {
        // Update active tab
        document.querySelectorAll('.country-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.country-tab[onclick*="${country}"]`).classList.add('active');
        
        this.currentCountryTab = country;
        this.loadEmployeesTable();
    }

    loadSectionData(sectionId) {
        switch(sectionId) {
            case 'employees':
                this.loadEmployeesTable();
                break;
            case 'dashboard':
                // Dashboard is already loaded
                break;
            case 'incidents':
                this.loadIncidentsTable();
                break;
        }
    }

    loadEmployeesTable() {
        const container = document.getElementById('employees-table-container');
        if (!container) return;
        
        // Filter employees by country
        let filteredEmployees = this.employees;
        if (this.currentCountryTab !== 'all') {
            filteredEmployees = this.employees.filter(emp => emp.country === this.currentCountryTab);
        }
        
        // Create table
        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Location</th>
                        <th>Country</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Safety Training</th>
                        <th>Last Medical</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        filteredEmployees.forEach(employee => {
            tableHTML += `
                <tr>
                    <td>${employee.id}</td>
                    <td class="editable" onclick="app.editEmployeeCell(this, '${employee.id}', 'name')">${employee.name}</td>
                    <td class="editable" onclick="app.editEmployeeCell(this, '${employee.id}', 'position')">${employee.position}</td>
                    <td>${employee.location}</td>
                    <td>${this.getCountryFlag(employee.country)} ${this.formatCountryName(employee.country)}</td>
                    <td class="editable" onclick="app.editEmployeeCell(this, '${employee.id}', 'department')">${employee.department}</td>
                    <td><span class="status-badge ${employee.status === 'Active' ? 'active' : 'inactive'}">${employee.status}</span></td>
                    <td>${employee.safetyTraining}</td>
                    <td>${employee.lastMedical}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="app.editEmployee('${employee.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteEmployee('${employee.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
            ${filteredEmployees.length === 0 ? '<p style="text-align: center; padding: 2rem; color: var(--text-light);">No employees found</p>' : ''}
        `;
        
        container.innerHTML = tableHTML;
    }

    getCountryFlag(countryCode) {
        const flags = {
            'south-africa': '🇿🇦',
            'zambia': '🇿🇲',
            'namibia': '🇳🇦',
            'tanzania': '🇹🇿'
        };
        return flags[countryCode] || '🏳️';
    }

    formatCountryName(countryCode) {
        const names = {
            'south-africa': 'South Africa',
            'zambia': 'Zambia',
            'namibia': 'Namibia',
            'tanzania': 'Tanzania'
        };
        return names[countryCode] || countryCode;
    }

    addEmployee() {
        const newEmployee = {
            id: `EMP${Date.now().toString().slice(-6)}`,
            name: 'New Employee',
            position: 'Inventory Control Specialist',
            country: this.currentCountryTab !== 'all' ? this.currentCountryTab : 'south-africa',
            location: 'Cape Town (HQ)',
            department: 'Inventory',
            joinDate: new Date().toISOString().split('T')[0],
            status: 'Active',
            safetyTraining: 'Pending',
            lastMedical: '',
            nextMedical: ''
        };
        
        this.employees.push(newEmployee);
        this.saveAllData();
        this.loadEmployeesTable();
        this.updateStatistics();
        this.showToast('Employee added successfully', 'success');
    }

    editEmployeeCell(cell, employeeId, field) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) return;
        
        const originalValue = cell.textContent;
        cell.innerHTML = `<input type="text" value="${originalValue}" class="edit-input">`;
        const input = cell.querySelector('input');
        
        input.focus();
        input.select();
        
        const saveEdit = () => {
            employee[field] = input.value;
            cell.textContent = input.value;
            this.saveAllData();
            this.showToast('Employee updated', 'success');
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveEdit();
        });
    }

    editEmployee(employeeId) {
        // Open edit modal or implement inline editing
        this.showToast('Edit functionality coming soon', 'info');
    }

    deleteEmployee(employeeId) {
        if (confirm('Are you sure you want to delete this employee?')) {
            this.employees = this.employees.filter(e => e.id !== employeeId);
            this.saveAllData();
            this.loadEmployeesTable();
            this.updateStatistics();
            this.showToast('Employee deleted', 'success');
        }
    }

    loadIncidentsTable() {
        // Implement incidents table loading
    }

    updateStatistics() {
        document.getElementById('totalEmployees').textContent = this.employees.length;
        
        // Update other statistics as needed
    }

    changeChartType(type) {
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        const ctx = document.getElementById('safetyChart').getContext('2d');
        this.currentChart = new Chart(ctx, {
            type: type,
            data: this.currentChart.data,
            options: this.currentChart.options
        });
        
        // Update button states
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--surface);
            color: var(--text);
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-left: 4px solid ${this.getToastColor(type)};
            animation: slideIn 0.3s ease;
        `;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getToastColor(type) {
        const colors = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    // Modal functions
    openModal(modalId) {
        // Implement modal opening
        this.showToast(`${modalId} modal coming soon`, 'info');
    }

    closeModal(modalId) {
        // Implement modal closing
    }

    reportIncident() {
        // Implement incident reporting
        this.showToast('Incident reporting coming soon', 'info');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MMSSafetyApp();
});

// Export for global access
window.MMSSafetyApp = MMSSafetyApp;
