/* ═══════════════════════════════════════════════════════════════
   MMS Safety Dashboard — Business Logic
   ═══════════════════════════════════════════════════════════════

   Loaded as a regular (non-module) script AFTER auth-bootstrap.js.
   All functions are globally accessible to inline onclick handlers.

   Prerequisites (must run before this file):
     - dashboard.html DOM must be parsed (script has `defer`)
     - auth-bootstrap.js must have run (sets window.mmsCurrentUser,
       reveals app content, defines window.handleMMSLogout)
     - firebase-config.js must have run

   Data model:
     - Current: localStorage cache (per-device).
     - Phase 2 will add real Firestore sync via database-service.js.
     - NO mock/fake/seed data anywhere. Empty tables stay empty
       until real users enter real records.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ────────────────────────────────────────────────────────────────
var incidents = [];
var ppeItems = [];
var ppeIssuance = [];
var healthRecords = [];
var contractors = [];
var contractorPermits = [];
var audits = [];
var auditSchedule = [];
var standards = [];
var trainingRecords = [];
var settings = {};
var attachments = {
    incidents: {},
    health: {},
    contractor: {},
    audit: {},
    standards: {},
    training: {},
    ppe: {}
};
var incidentTrendChart = null;
var editingCell = null;
var editingStandardIndex = -1;
var currentChartType = 'line';

// Real MMS operational footprint — used across the app
var locations = [
    { name: "Cape Town HQ",          country: "South Africa" },
    { name: "Cosco Durban",          country: "South Africa" },
    { name: "AGL Durban",            country: "South Africa" },
    { name: "Impala Dar",            country: "Tanzania" },
    { name: "Polytra Dar",           country: "Tanzania" },
    { name: "Access Dar",            country: "Tanzania" },
    { name: "WBCT Bulk Shed",        country: "Namibia" },
    { name: "WBCT Quay Side Shed",   country: "Namibia" },
    { name: "Bridge Walvis Bay",     country: "Namibia" },
    { name: "Pindulo Walvis Bay",    country: "Namibia" },
    { name: "Reload Giga Terminal",  country: "Zambia" },
    { name: "AGL Chingola Hub",      country: "Zambia" },
    { name: "Polytra Kitwe",         country: "Zambia" },
    { name: "Impala Ndola",          country: "Zambia" },
    { name: "SLS Ndola",             country: "Zambia" },
    { name: "Poseidon Zambia",       country: "Zambia" },
    { name: "Polytra Kapiri Mposhi", country: "Zambia" }
];

// ────────────────────────────────────────────────────────────────
// EMPTY STATE HELPER
// ────────────────────────────────────────────────────────────────
function emptyStateHTML(icon, title, message, actionLabel, actionOnclick) {
    return (
        '<tr><td colspan="99" style="text-align:center; padding:3rem 1rem; color:var(--text-light);">' +
            '<div style="font-size:3rem; margin-bottom:0.75rem;">' + icon + '</div>' +
            '<div style="font-weight:600; color:var(--text); margin-bottom:0.35rem;">' + title + '</div>' +
            '<div style="font-size:0.9rem; margin-bottom:1rem; max-width:400px; margin-left:auto; margin-right:auto;">' + message + '</div>' +
            (actionLabel ? '<button class="btn btn-primary" onclick="' + actionOnclick + '">' + actionLabel + '</button>' : '') +
        '</td></tr>'
    );
}

// ════════════════════════════════════════════════════════════════
// MODAL SYSTEM
// ════════════════════════════════════════════════════════════════

function setupEventListeners() {
    // Close via .close-modal button (delegated)
    document.addEventListener('click', function (event) {
        var closer = event.target.closest('.close-modal');
        if (closer) {
            var modal = closer.closest('.modal');
            if (modal) { closeModal(modal.id); event.stopPropagation(); }
            return;
        }
        // Click on backdrop closes modal
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' || event.key === 'Esc') {
            document.querySelectorAll('.modal').forEach(function (modal) {
                var isVisible = window.getComputedStyle(modal).display === 'block';
                if (isVisible) closeModal(modal.id);
            });
        }
    });
}

function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) {
        console.warn('[closeModal] not found:', modalId);
        return;
    }
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s ease';
    setTimeout(function () {
        modal.style.display = 'none';
        modal.classList.remove('show');
        modal.style.opacity = '1';
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        // Destroy charts in modal
        if (['incidentsModal', 'trainingModal', 'healthModal', 'standardsModal'].indexOf(modalId) !== -1) {
            destroyModalCharts(modalId);
        }
    }, 300);
}

function destroyModalCharts(modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) return;
    modal.querySelectorAll('canvas').forEach(function (canvas) {
        var chart = (typeof Chart !== 'undefined') && Chart.getChart(canvas);
        if (chart) chart.destroy();
    });
}

function openModal(modalId) {
    // Close other modals first
    document.querySelectorAll('.modal.show').forEach(function (m) {
        if (m.id !== modalId) closeModal(m.id);
    });

    var modal = document.getElementById(modalId);
    if (!modal) {
        console.warn('[openModal] not found:', modalId);
        return;
    }
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    setTimeout(function () { modal.classList.add('show'); }, 10);

    // Per-modal content loaders
    var loaders = {
        emergencyModal:       function () { loadEmergencyProcedures(); },
        checklistModal:       function () { loadSafetyChecklists(); },
        riskCalculatorModal:  function () { loadRiskCalculator(); },
        equipmentModal:       function () { loadEquipmentInspections(); },
        chemicalModal:        function () { loadChemicalRegister(); },
        observationModal:     function () { loadSafetyObservations(); },
        investigationModal:   function () { loadIncidentInvestigator(); },
        reportsModal:         function () { loadReportingDashboard(); },
        incidentsModal:       function () { loadIncidentsTable(); },
        trainingModal:        function () { loadTrainingTable(); },
        ppeModal:             function () { loadPPETable(); loadPPEIssuanceTable(); },
        healthModal:          function () { loadHealthTable(); },
        contractorModal:      function () { loadContractorTable(); loadContractorPermitsTable(); },
        auditModal:           function () { loadAuditTable(); loadAuditScheduleTable(); },
        standardsModal:       function () { loadStandards(); },
        riskModal:            function () { loadRiskMatrix(); },
        settingsModal:        function () { loadSettings(); }
    };
    if (loaders[modalId]) setTimeout(loaders[modalId], 100);
}

// ════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════════

function switchTab(tabName, modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) return;

    modal.querySelectorAll('.tab-button').forEach(function (btn) { btn.classList.remove('active'); });
    if (event && event.target && event.target.classList) event.target.classList.add('active');

    modal.querySelectorAll('.tab-content').forEach(function (content) {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    var activeTab = modal.querySelector('#' + tabName);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
    }

    var chartLoaders = {
        incidentsAnalysisTab: function () { initializeIncidentAnalysisChart(); },
        trainingStatsTab:     function () { initializeTrainingStatsChart(); },
        healthStatsTab:       function () { initializeHealthStatsChart(); },
        complianceTab:        function () { initializeComplianceChart(); }
    };
    if (chartLoaders[tabName]) setTimeout(chartLoaders[tabName], 100);
}

// ════════════════════════════════════════════════════════════════
// CHARTS — real data only
// ════════════════════════════════════════════════════════════════

function initializeCharts() {
    setTimeout(function () {
        var canvas = document.getElementById('incidentTrendChart');
        if (!canvas) return;
        if (typeof Chart === 'undefined') {
            setTimeout(initializeCharts, 500);
            return;
        }
        if (incidentTrendChart) incidentTrendChart.destroy();

        // Build last 6 months buckets
        var months = [];
        var buckets = {};
        var cursor = new Date();
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() - 5);
        for (var i = 0; i < 6; i++) {
            var label = cursor.toLocaleString('default', { month: 'short' });
            months.push(label);
            buckets[label] = { incidents: 0, nearMiss: 0, firstAid: 0 };
            cursor.setMonth(cursor.getMonth() + 1);
        }

        // Bucket real incidents by month
        incidents.forEach(function (inc) {
            if (!inc.date) return;
            var d = new Date(inc.date);
            if (isNaN(d.getTime())) return;
            var key = d.toLocaleString('default', { month: 'short' });
            if (!buckets[key]) return;
            if (inc.type === 'Near Miss') buckets[key].nearMiss++;
            else if (inc.type === 'First Aid') buckets[key].firstAid++;
            else buckets[key].incidents++;
        });

        var incData  = months.map(function (m) { return buckets[m].incidents; });
        var nmData   = months.map(function (m) { return buckets[m].nearMiss; });
        var faData   = months.map(function (m) { return buckets[m].firstAid; });

        incidentTrendChart = new Chart(canvas, {
            type: currentChartType,
            data: {
                labels: months,
                datasets: [
                    { label: 'Incidents',       data: incData, borderColor: '#ef4444', backgroundColor: currentChartType === 'line' ? 'rgba(239,68,68,0.1)' : '#ef4444', borderWidth: 2, tension: 0.3, fill: currentChartType === 'line' },
                    { label: 'Near Misses',     data: nmData,  borderColor: '#f59e0b', backgroundColor: currentChartType === 'line' ? 'rgba(245,158,11,0.1)' : '#f59e0b', borderWidth: 2, tension: 0.3, fill: currentChartType === 'line' },
                    { label: 'First Aid Cases', data: faData,  borderColor: '#10b981', backgroundColor: currentChartType === 'line' ? 'rgba(16,185,129,0.1)' : '#10b981', borderWidth: 2, tension: 0.3, fill: currentChartType === 'line' }
                ]
            },
            options: getChartOptions(currentChartType)
        });
    }, 300);
}

function getChartOptions(type) {
    var base = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12 } } }, tooltip: { mode: 'index', intersect: false } },
        scales: { x: { grid: { color: 'rgba(0,0,0,0.05)' } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } } },
        interaction: { intersect: false, mode: 'index' },
        animation: { duration: 800 }
    };
    if (type === 'pie') {
        return { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } };
    }
    return base;
}

function changeChartType(type) {
    currentChartType = type;
    document.querySelectorAll('.chart-type-btn').forEach(function (btn) { btn.classList.remove('active'); });
    if (event && event.target && event.target.classList) event.target.classList.add('active');
    initializeCharts();
}

function updateChartWithCustomRange() {
    // Phase 2: filter incidents by the selected range before rendering
    initializeCharts();
}

function initializeIncidentAnalysisChart() {
    var ctx = document.getElementById('incidentAnalysisChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    var byType = {};
    incidents.forEach(function (i) { byType[i.type] = (byType[i.type] || 0) + 1; });

    if (Object.keys(byType).length === 0) {
        byType = { 'No data yet': 0 };
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(byType),
            datasets: [{ label: 'Incidents by Type', data: Object.values(byType), backgroundColor: '#ef4444', borderColor: '#dc2626', borderWidth: 1 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: 'Incident Analysis by Type' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function initializeTrainingStatsChart() {
    var ctx = document.getElementById('trainingStatsChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    var counts = {
        'Completed':   trainingRecords.filter(function (t) { return t.status === 'Completed'; }).length,
        'In Progress': trainingRecords.filter(function (t) { return t.status === 'In Progress'; }).length,
        'Scheduled':   trainingRecords.filter(function (t) { return t.status === 'Scheduled'; }).length
    };

    new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Training Status Distribution' } } }
    });
}

function initializeHealthStatsChart() {
    var ctx = document.getElementById('healthStatsChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    var fit = healthRecords.filter(function (h) { return h.medicalStatus === 'Fit for Duty'; }).length;
    var pending = healthRecords.filter(function (h) { return h.medicalStatus !== 'Fit for Duty'; }).length;

    new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Fit for Duty', 'Pending / Other'], datasets: [{ data: [fit, pending], backgroundColor: ['#10b981', '#f59e0b'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Health Surveillance Status' } } }
    });
}

function initializeComplianceChart() {
    var ctx = document.getElementById('complianceChart');
    if (!ctx || typeof Chart === 'undefined') return;
    var existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    var data = {
        'Compliant':      standards.filter(function (s) { return s.status === 'Compliant'; }).length,
        'In Progress':    standards.filter(function (s) { return s.status === 'In Progress'; }).length,
        'Non-Compliant':  standards.filter(function (s) { return s.status === 'Non-Compliant'; }).length,
        'Pending Review': standards.filter(function (s) { return s.status === 'Pending Review'; }).length
    };

    new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Standards Compliance Status' } } }
    });
}

// ════════════════════════════════════════════════════════════════
// REPORTING DASHBOARD
// ════════════════════════════════════════════════════════════════

function loadReportingDashboard() {
    var container = document.getElementById('reportsContent');
    if (!container) return;

    var html =
        '<div style="margin-bottom:2rem;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">' +
                '<h3 style="color:var(--text);">Safety Management Reports</h3>' +
                '<div style="display:flex; gap:0.5rem;">' +
                    '<select id="reportPeriod" style="padding:0.5rem; border:1px solid var(--border); border-radius:6px;">' +
                        '<option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option>' +
                        '<option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>' +
                    '</select>' +
                    '<button onclick="generateReport()" style="background:var(--primary); color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer;">' +
                        '📊 Generate Report' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem; margin-bottom:2rem;">' +
                reportStatCard(incidents.length, 'Total Incidents', 'var(--primary)') +
                reportStatCard(trainingRecords.length, 'Training Records', '#10b981') +
                reportStatCard(ppeItems.length, 'PPE Items', '#3b82f6') +
                reportStatCard(audits.length, 'Completed Audits', '#8b5cf6') +
            '</div>' +
            '<div class="chart-grid">' +
                '<div class="chart-card"><canvas id="reportIncidentChart" height="250"></canvas></div>' +
                '<div class="chart-card"><canvas id="reportTrainingChart" height="250"></canvas></div>' +
                '<div class="chart-card"><canvas id="reportComplianceChart" height="250"></canvas></div>' +
                '<div class="chart-card"><canvas id="reportTrendChart" height="250"></canvas></div>' +
            '</div>' +
            '<div style="margin-top:2rem;">' +
                '<div style="font-weight:600; color:var(--text); margin-bottom:1rem;">Recent Incidents</div>' +
                '<div style="overflow-x:auto; background:white; border:1px solid var(--border); border-radius:8px; padding:1rem;">' +
                    '<table style="width:100%; border-collapse:collapse;">' +
                        '<thead><tr style="border-bottom:2px solid var(--border);">' +
                            '<th style="padding:0.75rem; text-align:left;">ID</th>' +
                            '<th style="padding:0.75rem; text-align:left;">Type</th>' +
                            '<th style="padding:0.75rem; text-align:left;">Date</th>' +
                            '<th style="padding:0.75rem; text-align:left;">Severity</th>' +
                            '<th style="padding:0.75rem; text-align:left;">Status</th>' +
                        '</tr></thead><tbody>' +
                        recentIncidentsRows() +
                        '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +
            '<div style="margin-top:2rem; display:flex; gap:1rem;">' +
                '<button onclick="exportReportPDF()" style="background:#ef4444; color:white; border:none; padding:0.75rem 1.5rem; border-radius:8px; cursor:pointer; flex:1;">📄 Export PDF Report</button>' +
                '<button onclick="exportReportExcel()" style="background:#10b981; color:white; border:none; padding:0.75rem 1.5rem; border-radius:8px; cursor:pointer; flex:1;">📊 Export Excel Report</button>' +
            '</div>' +
        '</div>';

    container.innerHTML = html;
    setTimeout(initializeReportCharts, 250);
}

function reportStatCard(num, label, color) {
    return '<div style="background:white; border:1px solid var(--border); border-radius:8px; padding:1.5rem; text-align:center;">' +
        '<div style="font-size:1.5rem; font-weight:600; color:' + color + ';">' + num + '</div>' +
        '<div style="font-size:0.85rem; color:var(--text-light);">' + label + '</div>' +
    '</div>';
}

function recentIncidentsRows() {
    if (incidents.length === 0) {
        return '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-light);">No incidents recorded yet.</td></tr>';
    }
    return incidents.slice(0, 5).map(function (inc) {
        var d = new Date(inc.date);
        var dateStr = isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:0.75rem;">' + inc.id + '</td>' +
            '<td style="padding:0.75rem;">' + inc.type + '</td>' +
            '<td style="padding:0.75rem;">' + dateStr + '</td>' +
            '<td style="padding:0.75rem;">' + inc.severity + '</td>' +
            '<td style="padding:0.75rem;">' + inc.status + '</td>' +
        '</tr>';
    }).join('');
}

function initializeReportCharts() {
    var ctx1 = document.getElementById('reportIncidentChart');
    if (ctx1 && typeof Chart !== 'undefined') {
        var types = {};
        incidents.forEach(function (i) { types[i.type] = (types[i.type] || 0) + 1; });
        if (Object.keys(types).length === 0) types = { 'No data': 0 };
        new Chart(ctx1, {
            type: 'doughnut',
            data: { labels: Object.keys(types), datasets: [{ data: Object.values(types), backgroundColor: ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'], borderWidth: 1 }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Incident Type Distribution' } } }
        });
    }

    var ctx2 = document.getElementById('reportTrainingChart');
    if (ctx2 && typeof Chart !== 'undefined') {
        var status = {
            'Completed':   trainingRecords.filter(function (t) { return t.status === 'Completed'; }).length,
            'In Progress': trainingRecords.filter(function (t) { return t.status === 'In Progress'; }).length,
            'Scheduled':   trainingRecords.filter(function (t) { return t.status === 'Scheduled'; }).length
        };
        new Chart(ctx2, {
            type: 'bar',
            data: { labels: Object.keys(status), datasets: [{ label: 'Training Records', data: Object.values(status), backgroundColor: '#3b82f6', borderColor: '#1d4ed8', borderWidth: 1 }] },
            options: { responsive: true, plugins: { title: { display: true, text: 'Training Status' } }, scales: { y: { beginAtZero: true } } }
        });
    }

    var ctx3 = document.getElementById('reportComplianceChart');
    if (ctx3 && typeof Chart !== 'undefined') {
        // Real compliance rate per standards on record
        var rate = standards.length > 0
            ? Math.round((standards.filter(function (s) { return s.status === 'Compliant'; }).length / standards.length) * 100)
            : 0;
        new Chart(ctx3, {
            type: 'line',
            data: { labels: ['Current'], datasets: [{ label: 'Compliance Rate (%)', data: [rate], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, tension: 0.3, fill: true }] },
            options: { responsive: true, plugins: { title: { display: true, text: 'Compliance Rate' } }, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }
}

function generateReport() {
    var period = (document.getElementById('reportPeriod') || {}).value || 'monthly';
    showToast('Report Generated', 'Period: ' + period, 'success');
}

function exportReportPDF() {
    if (!window.jspdf) { showToast('Export failed', 'PDF library not loaded', 'error'); return; }
    var doc = new window.jspdf.jsPDF();
    doc.setFontSize(20); doc.text('Safety Management Report', 20, 20);
    doc.setFontSize(12); doc.text('Generated: ' + new Date().toLocaleDateString(), 20, 30);
    doc.setFontSize(14); doc.text('Summary Statistics', 20, 50);
    doc.setFontSize(10);
    doc.text('Total Incidents: ' + incidents.length, 20, 60);
    doc.text('Training Records: ' + trainingRecords.length, 20, 67);
    doc.text('PPE Items: ' + ppeItems.length, 20, 74);
    doc.text('Completed Audits: ' + audits.length, 20, 81);
    doc.save('safety-report-' + new Date().toISOString().split('T')[0] + '.pdf');
    showToast('Success', 'Report exported to PDF', 'success');
}

function exportReportExcel() {
    if (!window.XLSX) { showToast('Export failed', 'Excel library not loaded', 'error'); return; }
    var wb = XLSX.utils.book_new();
    if (incidents.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incidents), 'Incidents');
    if (trainingRecords.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trainingRecords), 'Training');
    XLSX.writeFile(wb, 'safety-report-' + new Date().toISOString().split('T')[0] + '.xlsx');
    showToast('Success', 'Report exported to Excel', 'success');
}

function exportTableToPDF(tableId) {
    var table = document.getElementById(tableId);
    if (!table) { showToast('Export failed', 'Table not found', 'error'); return; }
    // Simple print-based export
    var win = window.open('', '_blank');
    win.document.write('<html><head><title>Export</title></head><body>' + table.outerHTML + '</body></html>');
    win.document.close();
    win.print();
}

function exportStandardsToPDF() { exportReportPDF(); }
function exportRiskMatrixToPDF() { exportReportPDF(); }

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupInstallButtons();
    setTimeout(initializeNewModules, 1000);
});

function setupInstallButtons() {
    var headerBtn = document.getElementById('installBtn');
    var sidebarBtn = document.getElementById('sidebarInstallBtn');
    if (headerBtn && window.pwaInstaller) headerBtn.addEventListener('click', function () { window.pwaInstaller.installPWA(); });
    if (sidebarBtn && window.pwaInstaller) sidebarBtn.addEventListener('click', function () { window.pwaInstaller.installPWA(); });
}

function initializeApp() {
    loadAllData();
    initializeCharts();
    loadAllTables();
    loadStandards();
    loadRiskMatrix();
    setupEventListeners();
    updateStatistics();
    populateEmployeeSelects();

    var endDate = new Date();
    var startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    var sd = document.getElementById('startDate');
    var ed = document.getElementById('endDate');
    if (sd) sd.valueAsDate = startDate;
    if (ed) ed.valueAsDate = endDate;

    var dtInput = document.getElementById('incidentDateTime');
    if (dtInput) {
        var now = new Date();
        var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        dtInput.value = local;
    }

    loadSettings();
}

// ════════════════════════════════════════════════════════════════
// DATA LOADING — localStorage only, no seed/mock data
// ════════════════════════════════════════════════════════════════

function loadAllData() {
    incidents        = safeParse('mmsIncidents', []);
    ppeItems         = safeParse('mmsPPEItems', []);
    ppeIssuance      = safeParse('mmsPPEIssuance', []);
    healthRecords    = safeParse('mmsHealthRecords', []);
    contractors      = safeParse('mmsContractors', []);
    contractorPermits= safeParse('mmsContractorPermits', []);
    audits           = safeParse('mmsAudits', []);
    auditSchedule    = safeParse('mmsAuditSchedule', []);
    standards        = safeParse('mmsStandards', []);
    trainingRecords  = safeParse('mmsTraining', []);

    console.log('[MMS] State loaded:', {
        incidents: incidents.length, ppe: ppeItems.length, health: healthRecords.length,
        contractors: contractors.length, audits: audits.length, standards: standards.length,
        training: trainingRecords.length
    });
}

function safeParse(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        console.warn('[safeParse] failed for', key, e);
        return fallback;
    }
}

function persist(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('[persist] failed for', key, e); }
}

// ════════════════════════════════════════════════════════════════
// TABLE RENDERERS — real data with empty states
// ════════════════════════════════════════════════════════════════

function loadAllTables() {
    loadIncidentsTable();
    loadPPETable();
    loadPPEIssuanceTable();
    loadHealthTable();
    loadContractorTable();
    loadContractorPermitsTable();
    loadAuditTable();
    loadAuditScheduleTable();
    loadTrainingTable();
}

function loadIncidentsTable() {
    var tbody = document.getElementById('modalIncidentsTableBody');
    if (!tbody) return;
    if (incidents.length === 0) {
        tbody.innerHTML = emptyStateHTML('🚨', 'No incidents recorded', 'Report your first incident to populate this table.', '+ Report Incident', "openModal('reportIncidentModal')");
        return;
    }
    tbody.innerHTML = incidents.map(function (inc) {
        var d = new Date(inc.date);
        var dateStr = isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + inc.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'type\')">' + inc.type + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'date\')">' + dateStr + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'location\')">' + inc.location + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'reportedBy\')">' + (inc.reportedBy || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'severity\')">' + inc.severity + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'status\')">' + inc.status + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'description\')">' + (inc.description || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'actions\')">' + (inc.actions || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'recommendations\')">' + (inc.recommendations || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteIncident(\'' + inc.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function loadPPETable() {
    var tbody = document.getElementById('ppeTableBody');
    if (!tbody) return;
    if (ppeItems.length === 0) {
        tbody.innerHTML = emptyStateHTML('🥽', 'No PPE items registered', 'Add your first PPE item to track issuance and inspection.', '+ Add PPE', 'addPPEItem()');
        return;
    }
    tbody.innerHTML = ppeItems.map(function (it) {
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + it.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'type\')">' + it.type + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'size\')">' + (it.size || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'brand\')">' + (it.brand || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'quantity\')">' + (it.quantity || 0) + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'location\')">' + (it.location || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'status\')">' + (it.status || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'lastInspection\')">' + (it.lastInspection || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'nextInspection\')">' + (it.nextInspection || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'condition\')">' + (it.condition || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deletePPEItem(\'' + it.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function loadPPEIssuanceTable() {
    var tbody = document.getElementById('ppeIssuanceTableBody');
    if (!tbody) return;
    if (ppeIssuance.length === 0) {
        tbody.innerHTML = emptyTableRow(9, 'No PPE issuance records yet.');
        return;
    }
    tbody.innerHTML = ppeIssuance.map(function (row) {
        return '<tr>' +
            '<td>' + row.id + '</td><td>' + row.ppeId + '</td><td>' + row.employee + '</td>' +
            '<td>' + row.issueDate + '</td><td>' + (row.expiryDate || '—') + '</td>' +
            '<td>' + (row.issuedBy || '—') + '</td><td>' + (row.returnDate || '—') + '</td>' +
            '<td>' + row.status + '</td>' +
            '<td><button class="btn btn-sm btn-success" onclick="returnPPE(\'' + row.id + '\')">Return</button></td>' +
        '</tr>';
    }).join('');
}

function loadHealthTable() {
    var tbody = document.getElementById('healthTableBody');
    if (!tbody) return;
    if (healthRecords.length === 0) {
        tbody.innerHTML = emptyStateHTML('🩺', 'No health records yet', 'Add employee health records to track medical examinations and surveillance.', '+ Add Record', 'addHealthRecord()');
        return;
    }
    tbody.innerHTML = healthRecords.map(function (r) {
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + r.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'name\')">' + r.name + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'location\')">' + (r.location || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'position\')">' + (r.position || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'lastMedical\')">' + (r.lastMedical || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'nextDue\')">' + (r.nextDue || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'bloodGroup\')">' + (r.bloodGroup || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'allergies\')">' + (r.allergies || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'medicalStatus\')">' + (r.medicalStatus || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'emergencyContact\')">' + (r.emergencyContact || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteHealthRecord(\'' + r.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function loadContractorTable() {
    var tbody = document.getElementById('contractorTableBody');
    if (!tbody) return;
    if (contractors.length === 0) {
        tbody.innerHTML = emptyStateHTML('👷', 'No contractors registered', 'Add your first contractor to track compliance and permits.', '+ Add Contractor', 'addContractor()');
        return;
    }
    tbody.innerHTML = contractors.map(function (c) {
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + c.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'company\')">' + c.company + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'contactPerson\')">' + (c.contactPerson || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'phone\')">' + (c.phone || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'email\')">' + (c.email || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'workType\')">' + (c.workType || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'location\')">' + (c.location || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'startDate\')">' + (c.startDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'endDate\')">' + (c.endDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'safetyRating\')">' + (c.safetyRating || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'status\')">' + (c.status || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteContractor(\'' + c.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function loadContractorPermitsTable() {
    var tbody = document.getElementById('contractorPermitsTableBody');
    if (!tbody) return;
    if (contractorPermits.length === 0) {
        tbody.innerHTML = emptyTableRow(9, 'No permits issued yet.');
        return;
    }
    tbody.innerHTML = contractorPermits.map(function (p) {
        return '<tr>' +
            '<td>' + p.id + '</td><td>' + p.contractorId + '</td><td>' + p.workType + '</td>' +
            '<td>' + p.location + '</td><td>' + p.issuedDate + '</td><td>' + p.expiryDate + '</td>' +
            '<td>' + (p.issuedBy || '—') + '</td><td>' + p.status + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="revokePermit(\'' + p.id + '\')">Revoke</button></td>' +
        '</tr>';
    }).join('');
}

function loadAuditTable() {
    var tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    if (audits.length === 0) {
        tbody.innerHTML = emptyStateHTML('🔍', 'No audits yet', 'Schedule or record your first internal audit to begin.', '+ Add Audit', 'addAudit()');
        return;
    }
    tbody.innerHTML = audits.map(function (a) {
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + a.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'type\')">' + a.type + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'location\')">' + (a.location || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'auditDate\')">' + (a.auditDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'auditor\')">' + (a.auditor || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'score\')">' + (a.score != null ? a.score : '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'status\')">' + a.status + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'findings\')">' + (a.findings || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'correctiveActions\')">' + (a.correctiveActions || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'nextAudit\')">' + (a.nextAudit || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteAudit(\'' + a.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function loadAuditScheduleTable() {
    var tbody = document.getElementById('auditScheduleTableBody');
    if (!tbody) return;
    if (auditSchedule.length === 0) {
        tbody.innerHTML = emptyTableRow(9, 'No audits scheduled yet.');
        return;
    }
    tbody.innerHTML = auditSchedule.map(function (s) {
        return '<tr>' +
            '<td>' + s.id + '</td><td>' + s.auditType + '</td><td>' + s.location + '</td>' +
            '<td>' + s.scheduledDate + '</td><td>' + s.frequency + '</td><td>' + (s.assignedTo || '—') + '</td>' +
            '<td>' + s.status + '</td><td>' + (s.priority || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="cancelSchedule(\'' + s.id + '\')">Cancel</button></td>' +
        '</tr>';
    }).join('');
}

function loadTrainingTable() {
    var tbody = document.getElementById('trainingTableBody');
    if (!tbody) return;
    if (trainingRecords.length === 0) {
        tbody.innerHTML = emptyStateHTML('🎓', 'No training records yet', 'Add your first training record to track competence and certifications.', '+ Add Training', 'addTrainingRecord()');
        return;
    }
    tbody.innerHTML = trainingRecords.map(function (t) {
        return '<tr>' +
            '<td class="editable" onclick="startEditing(this, \'id\')">' + t.id + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'employee\')">' + t.employee + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'type\')">' + t.type + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'provider\')">' + (t.provider || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'startDate\')">' + (t.startDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'endDate\')">' + (t.endDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'status\')">' + t.status + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'score\')">' + (t.score != null ? t.score : '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'expiryDate\')">' + (t.expiryDate || '—') + '</td>' +
            '<td class="editable" onclick="startEditing(this, \'notes\')">' + (t.notes || '—') + '</td>' +
            '<td><button class="btn btn-sm btn-danger" onclick="deleteTraining(\'' + t.id + '\')">Delete</button></td>' +
        '</tr>';
    }).join('');
}

function emptyTableRow(colspan, message) {
    return '<tr><td colspan="' + colspan + '" style="text-align:center; padding:2rem; color:var(--text-light);">' + message + '</td></tr>';
}

// ════════════════════════════════════════════════════════════════
// STANDARDS & RISK MATRIX
// ════════════════════════════════════════════════════════════════

function loadStandards() {
    var grid = document.getElementById('standardsGrid');
    if (!grid) return;
    if (standards.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-light);">' +
            '<div style="font-size:3rem; margin-bottom:0.75rem;">📋</div>' +
            '<div style="font-weight:600; color:var(--text); margin-bottom:0.35rem;">No standards tracked yet</div>' +
            '<div style="font-size:0.9rem; margin-bottom:1rem;">Add ISO 45001, OSHA, or company-specific standards to begin compliance tracking.</div>' +
            '<button class="btn btn-primary" onclick="addStandard()">+ Add Standard</button>' +
        '</div>';
        return;
    }
    grid.innerHTML = standards.map(function (s) {
        var badge = s.type === 'National' ? 'badge-national'
                  : s.type === 'Company' ? 'badge-company'
                  : s.type === 'Personal' ? 'badge-personal'
                  : 'badge-international';
        var statusClass = s.status === 'Non-Compliant' ? 'status-noncompliant'
                        : s.status === 'In Progress' ? 'status-inprogress'
                        : s.status === 'Pending Review' ? 'status-pending'
                        : 'status-compliant';
        return '<div class="standard-card">' +
            '<span class="standard-badge ' + badge + '">' + s.type + '</span>' +
            '<h3>' + s.name + '</h3>' +
            '<div class="standard-code">' + s.code + '</div>' +
            (s.country ? '<span class="standard-industry">' + s.country + '</span>' : '') +
            '<div class="standard-status ' + statusClass + '">' + s.status + '</div>' +
            '<p>' + (s.description || '') + '</p>' +
            (s.effectiveDate ? '<div style="font-size:0.85rem; color:var(--text-light); margin-top:0.5rem;">Effective: ' + s.effectiveDate + '</div>' : '') +
            (s.remarks ? '<div style="font-size:0.85rem; color:var(--text-light); margin-top:0.5rem;">' + s.remarks + '</div>' : '') +
            '<div class="standard-actions">' +
                '<button class="btn btn-sm btn-outline" onclick="editStandard(\'' + s.id + '\')">Edit</button>' +
                '<button class="btn btn-sm btn-danger" onclick="deleteStandard(\'' + s.id + '\')">Delete</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

function loadRiskMatrix() {
    var main = document.getElementById('riskMatrix');
    var modal = document.getElementById('modalRiskMatrix');
    if (!main && !modal) return;

    var levels = [
        { level: 1,  label: 'Low',           cls: 'risk-low' },
        { level: 2,  label: 'Low-Medium',    cls: 'risk-low' },
        { level: 3,  label: 'Medium',        cls: 'risk-medium' },
        { level: 4,  label: 'Medium-High',   cls: 'risk-medium' },
        { level: 5,  label: 'High',          cls: 'risk-high' },
        { level: 6,  label: 'High',          cls: 'risk-high' },
        { level: 7,  label: 'High-Very High',cls: 'risk-high' },
        { level: 8,  label: 'Very High',     cls: 'risk-very-high' },
        { level: 9,  label: 'Very High',     cls: 'risk-very-high' },
        { level: 10, label: 'Extreme',       cls: 'risk-extreme' }
    ];

    var html = levels.map(function (r) {
        return '<div class="matrix-cell ' + r.cls + '" onclick="editRiskCell(this)">' +
            '<div style="font-size:1.25rem; margin-bottom:0.5rem;">' + r.level + '</div>' +
            '<div>' + r.label + '</div>' +
            '<div style="font-size:0.75rem; margin-top:0.5rem; opacity:0.8;">Click to edit</div>' +
        '</div>';
    }).join('');

    if (main) main.innerHTML = html;
    if (modal) modal.innerHTML = html;
}

function editRiskCell(cell) {
    var text = cell.textContent.trim();
    var level = parseInt(text.split('\n')[0], 10);
    var newRisk = prompt('Enter new risk description:', text);
    if (newRisk !== null) {
        cell.innerHTML =
            '<div style="font-size:1.25rem; margin-bottom:0.5rem;">' + level + '</div>' +
            '<div>' + newRisk + '</div>' +
            '<div style="font-size:0.75rem; margin-top:0.5rem; opacity:0.8;">Click to edit</div>';
        showToast('Risk cell updated', '', 'success');
    }
}

function saveRiskMatrix() {
    showToast('Risk Matrix Saved', 'Local change recorded.', 'success');
}

// ════════════════════════════════════════════════════════════════
// STATISTICS & POPULATION
// ════════════════════════════════════════════════════════════════

function updateStatistics() {
    var ltiCount = incidents.filter(function (i) { return i.type === 'Lost Time Injury'; }).length;
    var lti = document.getElementById('lostTimeInjuries'); if (lti) lti.textContent = ltiCount;
    var ltid = document.getElementById('ltiDetails'); if (ltid) ltid.textContent = 'Last 30 days: ' + ltiCount + ' incidents';

    var st = document.getElementById('safetyTrainings'); if (st) st.textContent = trainingRecords.length;
    var completed = trainingRecords.filter(function (t) { return t.status === 'Completed'; }).length;
    var inProgress = trainingRecords.filter(function (t) { return t.status === 'In Progress'; }).length;
    var td = document.getElementById('trainingDetails'); if (td) td.textContent = completed + ' completed, ' + inProgress + ' in progress';

    var compliant = standards.filter(function (s) { return s.status === 'Compliant'; }).length;
    var rate = standards.length > 0 ? Math.round((compliant / standards.length) * 100) : 0;
    var cr = document.getElementById('complianceRate'); if (cr) cr.textContent = rate + '%';

    var activeAudits = audits.filter(function (a) { return a.status === 'In Progress' || a.status === 'Scheduled'; }).length;
    var aa = document.getElementById('activeAudits'); if (aa) aa.textContent = activeAudits;
}

function populateEmployeeSelects() {
    var select = document.getElementById('reportedBy');
    if (!select) return;
    select.innerHTML = '<option value="">Select employee</option>';
    healthRecords.forEach(function (emp) {
        var opt = document.createElement('option');
        opt.value = emp.name;
        opt.textContent = emp.name;
        select.appendChild(opt);
    });
    if (healthRecords.length === 0) {
        var opt = document.createElement('option');
        opt.value = '__none__';
        opt.textContent = 'No employees on record yet';
        opt.disabled = true;
        select.appendChild(opt);
    }
}

// ════════════════════════════════════════════════════════════════
// INCIDENT SUBMISSION & EDITING
// ════════════════════════════════════════════════════════════════

function submitIncidentReport() {
    var type = document.getElementById('incidentType').value;
    var severity = document.getElementById('incidentSeverity').value;
    var dateTime = document.getElementById('incidentDateTime').value;
    var location = document.getElementById('incidentLocation').value;
    var reportedBy = document.getElementById('reportedBy').value;
    var department = document.getElementById('incidentDepartment').value;
    var description = document.getElementById('incidentDescription').value;
    var actions = document.getElementById('immediateActions').value;
    var recommendations = document.getElementById('recommendations').value;

    if (!type || !severity || !dateTime || !location || !reportedBy || !department || !description) {
        document.getElementById('reportError').style.display = 'block';
        return;
    }

    var id = 'INC-' + Date.now().toString().slice(-6);
    var newIncident = {
        id: id, type: type, severity: severity,
        date: new Date(dateTime).toISOString(),
        location: location, reportedBy: reportedBy, department: department,
        description: description, actions: actions, recommendations: recommendations,
        status: 'Reported', createdAt: new Date().toISOString()
    };

    incidents.unshift(newIncident);
    persist('mmsIncidents', incidents);
    updateStatistics();
    initializeCharts();

    document.getElementById('reportSuccess').style.display = 'block';
    document.getElementById('reportError').style.display = 'none';

    setTimeout(function () {
        closeModal('reportIncidentModal');
        document.getElementById('reportSuccess').style.display = 'none';
        ['incidentType','incidentSeverity','incidentDateTime','incidentLocation','reportedBy','incidentDepartment','incidentDescription','immediateActions','recommendations'].forEach(function (elId) {
            var el = document.getElementById(elId); if (el) el.value = '';
        });
        if (document.getElementById('incidentsModal').style.display === 'block') loadIncidentsTable();
    }, 1500);
}

function startEditing(cell, field) {
    if (editingCell) saveEditing();
    var currentValue = cell.textContent.trim();
    var row = cell.parentElement;
    var rowIndex = Array.prototype.indexOf.call(row.parentElement.children, row);

    var input;
    var selectOptions = {
        type:      ['Near Miss', 'First Aid', 'Medical Treatment', 'Lost Time Injury', 'Property Damage', 'Environmental Incident'],
        severity:  ['Minor', 'Moderate', 'Serious', 'Critical'],
        status:    ['Reported', 'In Progress', 'Resolved', 'Closed'],
        location:  locations.map(function (l) { return l.name; })
    };
    if (selectOptions[field]) {
        input = document.createElement('select');
        input.className = 'edit-select';
        selectOptions[field].forEach(function (optText) {
            var opt = document.createElement('option');
            opt.value = optText; opt.textContent = optText;
            if (optText === currentValue) opt.selected = true;
            input.appendChild(opt);
        });
    } else {
        input = document.createElement('input');
        input.type = 'text'; input.className = 'edit-input'; input.value = currentValue;
    }

    cell.innerHTML = '';
    cell.appendChild(input);
    cell.classList.add('editing');
    input.focus();

    editingCell = { cell: cell, field: field, rowIndex: rowIndex, originalValue: currentValue };

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') saveEditing();
        else if (e.key === 'Escape') cancelEditing();
    });
    input.addEventListener('blur', function () { setTimeout(saveEditing, 100); });
}

function saveEditing() {
    if (!editingCell) return;
    var cell = editingCell.cell;
    var input = cell.querySelector('input, select');
    var newValue = input ? input.value : '';
    cell.textContent = newValue;
    cell.classList.remove('editing');

    var table = cell.closest('table');
    if (table && incidents[editingCell.rowIndex]) {
        incidents[editingCell.rowIndex][editingCell.field] = newValue;
        persist('mmsIncidents', incidents);
        updateStatistics();
    }
    editingCell = null;
}

function cancelEditing() {
    if (!editingCell) return;
    editingCell.cell.textContent = editingCell.originalValue;
    editingCell.cell.classList.remove('editing');
    editingCell = null;
}

// ════════════════════════════════════════════════════════════════
// DELETE OPERATIONS
// ════════════════════════════════════════════════════════════════

function deleteIncident(id) {
    if (!confirm('Delete this incident?')) return;
    incidents = incidents.filter(function (i) { return i.id !== id; });
    persist('mmsIncidents', incidents);
    loadIncidentsTable(); updateStatistics(); initializeCharts();
    showToast('Incident Deleted', '', 'success');
}
function deletePPEItem(id) {
    if (!confirm('Delete this PPE item?')) return;
    ppeItems = ppeItems.filter(function (p) { return p.id !== id; });
    persist('mmsPPEItems', ppeItems);
    loadPPETable();
    showToast('PPE Item Deleted', '', 'success');
}
function deleteHealthRecord(id) {
    if (!confirm('Delete this health record?')) return;
    healthRecords = healthRecords.filter(function (h) { return h.id !== id; });
    persist('mmsHealthRecords', healthRecords);
    loadHealthTable(); populateEmployeeSelects();
    showToast('Health Record Deleted', '', 'success');
}
function deleteContractor(id) {
    if (!confirm('Delete this contractor?')) return;
    contractors = contractors.filter(function (c) { return c.id !== id; });
    persist('mmsContractors', contractors);
    loadContractorTable();
    showToast('Contractor Deleted', '', 'success');
}
function deleteAudit(id) {
    if (!confirm('Delete this audit?')) return;
    audits = audits.filter(function (a) { return a.id !== id; });
    persist('mmsAudits', audits);
    loadAuditTable(); updateStatistics();
    showToast('Audit Deleted', '', 'success');
}
function deleteTraining(id) {
    if (!confirm('Delete this training record?')) return;
    trainingRecords = trainingRecords.filter(function (t) { return t.id !== id; });
    persist('mmsTraining', trainingRecords);
    loadTrainingTable(); updateStatistics();
    showToast('Training Record Deleted', '', 'success');
}
function deleteStandard(id) {
    if (!confirm('Delete this standard?')) return;
    standards = standards.filter(function (s) { return s.id !== id; });
    persist('mmsStandards', standards);
    loadStandards(); updateStatistics();
    showToast('Standard Deleted', '', 'success');
}

// ════════════════════════════════════════════════════════════════
// ADD OPERATIONS
// ════════════════════════════════════════════════════════════════

function addPPEItem() {
    var item = {
        id: 'PPE-' + Date.now().toString().slice(-6),
        type: 'New PPE Item', size: 'M', brand: '', quantity: 1,
        location: 'Cape Town HQ', status: 'Available',
        lastInspection: new Date().toISOString().split('T')[0],
        nextInspection: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        condition: 'New'
    };
    ppeItems.push(item);
    persist('mmsPPEItems', ppeItems);
    loadPPETable();
    showToast('PPE Item Added', 'Edit inline to fill in details.', 'success');
}

function addHealthRecord() {
    var rec = {
        id: 'EMP-' + Date.now().toString().slice(-6),
        name: 'New Employee', location: 'Cape Town HQ', position: '',
        lastMedical: new Date().toISOString().split('T')[0],
        nextDue: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        bloodGroup: '', allergies: '', medicalStatus: 'Pending', emergencyContact: ''
    };
    healthRecords.push(rec);
    persist('mmsHealthRecords', healthRecords);
    loadHealthTable(); populateEmployeeSelects();
    showToast('Health Record Added', 'Edit inline to fill in details.', 'success');
}

function addContractor() {
    var c = {
        id: 'CON-' + Date.now().toString().slice(-6),
        company: 'New Contractor', contactPerson: '', phone: '', email: '',
        workType: '', location: 'Cape Town HQ',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        safetyRating: '', status: 'Active'
    };
    contractors.push(c);
    persist('mmsContractors', contractors);
    loadContractorTable();
    showToast('Contractor Added', 'Edit inline to fill in details.', 'success');
}

function addAudit() {
    var a = {
        id: 'AUD-' + Date.now().toString().slice(-6),
        type: 'Internal Safety Audit', location: 'Cape Town HQ',
        auditDate: new Date().toISOString().split('T')[0],
        auditor: '', score: 0, status: 'Scheduled', findings: '', correctiveActions: '',
        nextAudit: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    };
    audits.push(a);
    persist('mmsAudits', audits);
    loadAuditTable(); updateStatistics();
    showToast('Audit Added', 'Edit inline to fill in details.', 'success');
}

function addTrainingRecord() {
    var t = {
        id: 'TRN-' + Date.now().toString().slice(-6),
        employee: '', type: '', provider: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        status: 'Scheduled', score: 0,
        expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        notes: ''
    };
    trainingRecords.push(t);
    persist('mmsTraining', trainingRecords);
    loadTrainingTable(); updateStatistics();
    showToast('Training Record Added', 'Edit inline to fill in details.', 'success');
}

function addStandard() {
    openModal('standardModal');
    document.getElementById('standardModalTitle').textContent = 'Add New Standard';
    document.getElementById('deleteStandardBtn').style.display = 'none';
    ['standardName','standardCode','standardType','standardCountry','standardDescription','standardStatus','standardEffectiveDate','standardRemarks'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
}

function editStandard(id) {
    var s = standards.find(function (x) { return x.id === id; });
    if (!s) return;
    editingStandardIndex = standards.findIndex(function (x) { return x.id === id; });
    openModal('standardModal');
    document.getElementById('standardModalTitle').textContent = 'Edit Standard';
    document.getElementById('deleteStandardBtn').style.display = 'inline-block';
    document.getElementById('standardName').value = s.name || '';
    document.getElementById('standardCode').value = s.code || '';
    document.getElementById('standardType').value = s.type || '';
    document.getElementById('standardCountry').value = s.country || '';
    document.getElementById('standardDescription').value = s.description || '';
    document.getElementById('standardStatus').value = s.status || '';
    document.getElementById('standardEffectiveDate').value = s.effectiveDate || '';
    document.getElementById('standardRemarks').value = s.remarks || '';
    toggleCountryField();
}

function saveStandard() {
    var name = document.getElementById('standardName').value.trim();
    var code = document.getElementById('standardCode').value.trim();
    var type = document.getElementById('standardType').value;
    var country = document.getElementById('standardCountry').value;
    var description = document.getElementById('standardDescription').value.trim();
    var status = document.getElementById('standardStatus').value;
    var effectiveDate = document.getElementById('standardEffectiveDate').value;
    var remarks = document.getElementById('standardRemarks').value.trim();

    if (!name || !code || !type || !description || !status) {
        document.getElementById('standardError').style.display = 'block';
        return;
    }

    var data = {
        id: editingStandardIndex >= 0 ? standards[editingStandardIndex].id : ('STD-' + Date.now().toString().slice(-6)),
        name: name, code: code, type: type, description: description,
        status: status, effectiveDate: effectiveDate, remarks: remarks
    };
    if (type === 'National' && country) data.country = country;

    if (editingStandardIndex >= 0) standards[editingStandardIndex] = data;
    else standards.push(data);

    persist('mmsStandards', standards);
    document.getElementById('standardSuccess').style.display = 'block';
    document.getElementById('standardError').style.display = 'none';

    setTimeout(function () {
        closeModal('standardModal');
        loadStandards(); updateStatistics();
        editingStandardIndex = -1;
    }, 1500);
}

function deleteCurrentStandard() {
    if (editingStandardIndex < 0) return;
    if (!confirm('Delete this standard?')) return;
    standards.splice(editingStandardIndex, 1);
    persist('mmsStandards', standards);
    closeModal('standardModal');
    loadStandards(); updateStatistics();
    editingStandardIndex = -1;
    showToast('Standard Deleted', '', 'success');
}

function toggleCountryField() {
    var type = document.getElementById('standardType').value;
    var field = document.getElementById('countryField');
    if (field) field.style.display = type === 'National' ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════════
// SETTINGS, BACKUP, EXPORT
// ════════════════════════════════════════════════════════════════

function loadSettings() {
    settings = safeParse('mmsSettings', {
        companyName: 'Metal Management Solutions',
        companyWebsite: 'https://www.metalmanagementsolutions.com/',
        companyEmail: '', companyPhone: '',
        emailNotifications: true, incidentAlerts: true,
        trainingReminders: true, auditReminders: true,
        notificationEmail: '', backupFrequency: 'weekly', autoExport: 'monthly'
    });

    var map = {
        companyName: settings.companyName, companyWebsite: settings.companyWebsite,
        companyEmail: settings.companyEmail, companyPhone: settings.companyPhone,
        notificationEmail: settings.notificationEmail,
        backupFrequency: settings.backupFrequency, autoExport: settings.autoExport
    };
    Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = map[id] || '';
    });
    ['emailNotifications','incidentAlerts','trainingReminders','auditReminders'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.checked = !!settings[id];
    });

    loadLocationsList();
}

function loadLocationsList() {
    var list = document.getElementById('locationsList');
    if (!list) return;
    if (locations.length === 0) {
        list.innerHTML = '<div style="padding:1rem; color:var(--text-light);">No locations configured.</div>';
        return;
    }
    list.innerHTML = locations.map(function (loc) {
        return '<div class="file-item">' +
            '<div><strong>' + loc.name + '</strong>' +
            '<div style="font-size:0.85rem; color:var(--text-light);">' + loc.country + '</div></div>' +
            '<button class="btn btn-sm btn-danger" onclick="removeLocation(\'' + loc.name + '\')">Remove</button>' +
        '</div>';
    }).join('');
}

function addLocation() {
    var name = document.getElementById('newLocationName').value.trim();
    var country = document.getElementById('newLocationCountry').value;
    if (!name || !country) { alert('Please enter both location name and country.'); return; }
    locations.push({ name: name, country: country });
    loadLocationsList();
    document.getElementById('newLocationName').value = '';
    document.getElementById('newLocationCountry').value = '';
    showToast('Location Added', name + ', ' + country, 'success');
}

function removeLocation(name) {
    if (!confirm('Remove ' + name + '?')) return;
    locations = locations.filter(function (l) { return l.name !== name; });
    loadLocationsList();
    showToast('Location Removed', name, 'success');
}

function saveSettings() {
    settings = {
        companyName: document.getElementById('companyName').value,
        companyWebsite: document.getElementById('companyWebsite').value,
        companyEmail: document.getElementById('companyEmail').value,
        companyPhone: document.getElementById('companyPhone').value,
        emailNotifications: document.getElementById('emailNotifications').checked,
        incidentAlerts: document.getElementById('incidentAlerts').checked,
        trainingReminders: document.getElementById('trainingReminders').checked,
        auditReminders: document.getElementById('auditReminders').checked,
        notificationEmail: document.getElementById('notificationEmail').value,
        backupFrequency: document.getElementById('backupFrequency').value,
        autoExport: document.getElementById('autoExport').value
    };
    persist('mmsSettings', settings);
    showToast('Settings Saved', '', 'success');
    setTimeout(function () { closeModal('settingsModal'); }, 1000);
}

function backupData() {
    var backup = {
        timestamp: new Date().toISOString(),
        incidents: incidents, ppeItems: ppeItems, healthRecords: healthRecords,
        contractors: contractors, audits: audits, standards: standards,
        trainingRecords: trainingRecords, locations: locations, settings: settings
    };
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'mms-safety-backup-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup Created', '', 'success');
}

function exportAllData() {
    if (!window.XLSX) { showToast('Export failed', 'Excel library not loaded', 'error'); return; }
    var wb = XLSX.utils.book_new();
    var data = { incidents: incidents, PPE: ppeItems, Health: healthRecords, Contractors: contractors, Audits: audits, Standards: standards, Training: trainingRecords };
    Object.keys(data).forEach(function (k) {
        if (data[k].length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data[k]), k);
    });
    XLSX.writeFile(wb, 'mms-safety-export-' + new Date().toISOString().split('T')[0] + '.xlsx');
    showToast('Data Exported', '', 'success');
}

function exportToPDF() {
    if (!window.jspdf) { showToast('Export failed', 'PDF library not loaded', 'error'); return; }
    var doc = new window.jspdf.jsPDF();
    doc.setFontSize(20); doc.text('MMS Safety Dashboard', 20, 20);
    doc.setFontSize(12); doc.text('Generated: ' + new Date().toLocaleDateString(), 20, 30);
    doc.setFontSize(14); doc.text('Current Statistics', 20, 50);
    doc.setFontSize(10);
    doc.text('Total Incidents: ' + incidents.length, 20, 60);
    doc.text('Training Records: ' + trainingRecords.length, 20, 67);
    doc.text('PPE Items: ' + ppeItems.length, 20, 74);
    doc.text('Compliance Rate: ' + (document.getElementById('complianceRate') || {}).textContent, 20, 81);
    doc.save('mms-safety-dashboard-' + new Date().toISOString().split('T')[0] + '.pdf');
    showToast('Dashboard Exported', '', 'success');
}

function resetData() {
    if (!confirm('⚠️ WARNING: This will reset ALL local data on this device. Cannot be undone. Continue?')) return;
    ['mmsIncidents','mmsPPEItems','mmsPPEIssuance','mmsHealthRecords','mmsContractors','mmsContractorPermits','mmsAudits','mmsAuditSchedule','mmsStandards','mmsTraining','mmsSettings','mmsRiskAssessments','mmsEquipment'].forEach(function (k) {
        localStorage.removeItem(k);
    });
    location.reload();
}

// ════════════════════════════════════════════════════════════════
// TOAST & CONFIRM DIALOG
// ════════════════════════════════════════════════════════════════

function showToast(title, message, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message || '';
    toast.className = 'toast';
    toast.classList.add('toast-' + type);
    var icon = toast.querySelector('.toast-icon');
    if (icon) icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.classList.add('show');
    setTimeout(hideToast, 4000);
}

function hideToast() {
    var toast = document.getElementById('toast');
    if (toast) toast.classList.remove('show');
}

function hideConfirmDialog() {
    var d = document.getElementById('confirmDialog');
    if (d) d.classList.remove('show');
}

function showConfirmDialog(title, message, onConfirm) {
    var d = document.getElementById('confirmDialog');
    if (!d) return;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    var btn = document.getElementById('confirmDeleteBtn');
    btn.onclick = function () { onConfirm(); hideConfirmDialog(); };
    d.classList.add('show');
}

// ════════════════════════════════════════════════════════════════
// FEATURE MODULE INTEGRATION (from external .js files)
// ════════════════════════════════════════════════════════════════

function initializeNewModules() {
    try {
        if (typeof EmergencyWizard !== 'undefined')         window.emergencyWizard = new EmergencyWizard();
        if (typeof SafetyChecklistSystem !== 'undefined')   window.safetyChecklist = new SafetyChecklistSystem();
        if (typeof RiskCalculator !== 'undefined')          window.riskCalculator = new RiskCalculator();
        if (typeof EquipmentInspections !== 'undefined')    window.equipmentInspections = new EquipmentInspections();
        if (typeof ChemicalRegister !== 'undefined')        window.chemicalRegister = new ChemicalRegister();
        if (typeof IncidentInvestigator !== 'undefined')    window.incidentInvestigator = new IncidentInvestigator();
        if (typeof SafetyObservations !== 'undefined')      window.safetyObservations = new SafetyObservations();
        if (typeof SafetyReportingDashboard !== 'undefined')window.safetyReports = new SafetyReportingDashboard();
    } catch (e) {
        console.warn('[initializeNewModules] some modules failed to init:', e.message);
    }
}

function openEmergencyWizard() { openModal('emergencyModal'); }
function openSafetyChecklist() { openModal('checklistModal'); }
function openRiskCalculator()  { openModal('riskCalculatorModal'); }

function loadEmergencyProcedures() {
    var el = document.getElementById('emergencyContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">🚨</div>' +
        '<h3>Emergency Response Procedures</h3>' +
        '<p style="color:var(--text-light);">Module loaded from emergency-wizard.js</p></div>';
}

function loadSafetyChecklists() {
    var el = document.getElementById('checklistContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">✅</div>' +
        '<h3>Safety Checklists</h3>' +
        '<p style="color:var(--text-light);">Module loaded from safety-checklist.js</p></div>';
}

function loadRiskCalculator() {
    var el = document.getElementById('riskCalculatorContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">📊</div>' +
        '<h3>Risk Assessment Calculator</h3>' +
        '<p style="color:var(--text-light);">Module loaded from risk-calculator.js</p></div>';
}

function loadEquipmentInspections() {
    var el = document.getElementById('equipmentContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">🔧</div>' +
        '<h3>Equipment Inspections</h3>' +
        '<p style="color:var(--text-light);">Module loaded from equipment-inspections.js</p></div>';
}

function loadChemicalRegister() {
    var el = document.getElementById('chemicalContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">🧪</div>' +
        '<h3>Chemical Register</h3>' +
        '<p style="color:var(--text-light);">Module loaded from chemical-register.js</p></div>';
}

function loadSafetyObservations() {
    var el = document.getElementById('observationContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">👁️</div>' +
        '<h3>Safety Observations</h3>' +
        '<p style="color:var(--text-light);">Module loaded from safety-observations.js</p></div>';
}

function loadIncidentInvestigator() {
    var el = document.getElementById('investigationContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center; padding:3rem;">' +
        '<div style="font-size:4rem;">🔍</div>' +
        '<h3>Incident Investigator</h3>' +
        '<p style="color:var(--text-light);">Module loaded from incident-investigator.js</p></div>';
}

// Stubs for handlers referenced by HTML but not yet implemented
function returnPPE(id)         { showToast('PPE Return', 'Not yet implemented.', 'warning'); }
function issuePPE()            { showToast('Issue PPE', 'Not yet implemented.', 'warning'); }
function revokePermit(id)      { showToast('Revoke Permit', 'Not yet implemented.', 'warning'); }
function cancelSchedule(id)    { showToast('Cancel Schedule', 'Not yet implemented.', 'warning'); }
function scheduleAudit()       { showToast('Schedule Audit', 'Not yet implemented.', 'warning'); }
function issuePermit()         { showToast('Issue Permit', 'Not yet implemented.', 'warning'); }
function printEmergencyProcedures() { window.print(); }
function loadIncidentAttachments()   { /* wired by future file */ }
function loadTrainingCertificates()  { /* wired by future file */ }
function loadHealthAttachments()     { /* wired by future file */ }
function loadContractorAttachments() { /* wired by future file */ }
function loadAuditAttachments()      { /* wired by future file */ }
function loadStandardAttachments()   { /* wired by future file */ }
function loadPPEDocuments()          { /* wired by future file */ }
function uploadIncidentAttachment()  { /* wired by future file */ }
function uploadTrainingCertificate() { /* wired by future file */ }
function uploadHealthAttachment()    { /* wired by future file */ }
function uploadContractorAttachment(){ /* wired by future file */ }
function uploadAuditAttachment()     { /* wired by future file */ }
function uploadStandardAttachment()  { /* wired by future file */ }
function uploadPPEDocument()         { /* wired by future file */ }

console.log('[MMS app.js] Business logic loaded — all functions globally available.');
// ==================================================================
// PHASE 6 PATCH — Wire real modules into placeholder modals
// ==================================================================
(function patchModuleLoaders() {

    // ---------- Risk Calculator ----------
    window.loadRiskCalculator = function () {
        var el = document.getElementById('riskCalculatorContent');
        if (!el) return;
        if (window.riskCalculator && typeof window.riskCalculator.generateAssessmentForm === 'function') {
            el.innerHTML = window.riskCalculator.generateAssessmentForm();
        } else {
            el.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">' +
                '<div style="font-size:3rem;">⚠️</div>' +
                '<h3>Risk Calculator not loaded</h3></div>';
        }
    };

    // ---------- Safety Checklists ----------
    window.loadSafetyChecklists = function () {
        var el = document.getElementById('checklistContent');
        if (!el) return;

        if (!window.safetyChecklist) {
            el.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">' +
                '<div style="font-size:3rem;">⚠️</div>' +
                '<h3>Checklist module not loaded</h3></div>';
            return;
        }

        var checklists = window.safetyChecklist.checklists || {};
        var keys = Object.keys(checklists);

        if (keys.length === 0) {
            el.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">' +
                '<div style="font-size:3rem;">📋</div>' +
                '<h3>No checklists available</h3></div>';
            return;
        }

        var html = '<div style="margin-bottom:1rem;">' +
            '<div style="font-weight:600; color:#0f172a; margin-bottom:0.25rem;">Available Checklists</div>' +
            '<div style="font-size:0.82rem; color:#64748b;">Pick one to begin a live inspection</div>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:0.85rem;">';

        keys.forEach(function (key) {
            var c = checklists[key];
            var isCritical = (c.items || []).some(function (i) { return i.critical; });
            html += '<button class="module-item" onclick="window.__openChecklist(\'' + key + '\')" ' +
                'style="text-align:left; padding:1rem;">' +
                '<span class="mi-icon">' + (isCritical ? '⚠️' : '✅') + '</span>' +
                '<span class="mi-label">' +
                    '<div style="font-weight:600;">' + escapeHtml(c.title) + '</div>' +
                    '<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.15rem;">' +
                        (c.frequency || '').toUpperCase() + ' · ' + (c.items || []).length + ' items' +
                    '</div>' +
                '</span>' +
            '</button>';
        });

        html += '</div>';
        el.innerHTML = html;
    };

    window.__openChecklist = function (checklistKey) {
        var el = document.getElementById('checklistContent');
        if (!el || !window.safetyChecklist) return;
        // Inject a container and let the real module render inside it
        el.innerHTML = '<div id="activeChecklistContainer"></div>' +
            '<div style="margin-top:1rem;"><button class="btn btn-outline btn-sm" onclick="window.loadSafetyChecklists()">← Back to list</button></div>';
        setTimeout(function () {
            window.safetyChecklist.renderChecklistUI(checklistKey, 'activeChecklistContainer');
        }, 50);
    };

    // ---------- Safety Observations ----------
    window.loadSafetyObservations = function () {
        var el = document.getElementById('observationContent');
        if (!el) return;

        if (!window.safetyObservations) {
            el.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">' +
                '<div style="font-size:3rem;">⚠️</div>' +
                '<h3>Observations module not loaded</h3></div>';
            return;
        }

        var categories = window.safetyObservations.observationCategories || [];
        var types = window.safetyObservations.observationTypes || [];

        var html = '' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                '<div>' +
                    '<div style="font-weight:600;">Record a Safety Observation</div>' +
                    '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">Positive catches, hazards, and unsafe conditions</div>' +
                '</div>' +
            '</div>' +

            '<div class="form-row">' +
                '<div class="form-group"><label>Category</label>' +
                    '<select id="obs-category">' +
                        categories.map(function (c) {
                            return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div class="form-group"><label>Type</label>' +
                    '<select id="obs-type">' +
                        types.map(function (t) {
                            return '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="form-row">' +
                '<div class="form-group"><label>Location</label>' +
                    '<input type="text" id="obs-location" placeholder="e.g., Cape Town HQ — Yard B">' +
                '</div>' +
                '<div class="form-group"><label>Risk Level</label>' +
                    '<select id="obs-risk">' +
                        '<option value="low">Low</option>' +
                        '<option value="medium">Medium</option>' +
                        '<option value="high">High</option>' +
                        '<option value="critical">Critical</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="form-group"><label>Title</label>' +
                '<input type="text" id="obs-title" placeholder="Short summary">' +
            '</div>' +

            '<div class="form-group"><label>Description</label>' +
                '<textarea id="obs-description" rows="3" placeholder="What did you observe?"></textarea>' +
            '</div>' +

            '<div class="form-group"><label>Immediate Action Taken</label>' +
                '<textarea id="obs-action" rows="2" placeholder="What did you do about it right away?"></textarea>' +
            '</div>' +

            '<div class="action-buttons">' +
                '<button class="btn btn-primary" onclick="window.__saveObservation()">💾 Save Observation</button>' +
                '<button class="btn btn-outline" onclick="window.loadSafetyObservations()">Reset</button>' +
            '</div>' +

            '<div id="obs-recent" style="margin-top:2rem;"></div>';

        el.innerHTML = html;
        window.__refreshRecentObservations();
    };

    window.__saveObservation = function () {
        var category = (document.getElementById('obs-category') || {}).value;
        var type = (document.getElementById('obs-type') || {}).value;
        var location = (document.getElementById('obs-location') || {}).value;
        var risk = (document.getElementById('obs-risk') || {}).value;
        var title = (document.getElementById('obs-title') || {}).value;
        var description = (document.getElementById('obs-description') || {}).value;
        var action = (document.getElementById('obs-action') || {}).value;

        if (!title || !description) {
            alert('Please enter a title and description.');
            return;
        }

        var data = {
            category: category,
            type: type,
            location: location,
            risk_level: risk,
            title: title,
            description: description,
            immediate_action: action,
            observed_date: new Date().toISOString()
        };

        window.safetyObservations.recordObservation(data).then(function (result) {
            if (result.success) {
                showToast('Observation Saved', 'Ref: ' + result.observation.id, 'success');
                window.loadSafetyObservations();
            } else {
                showToast('Save Failed', result.error || 'Unknown error', 'error');
            }
        });
    };

    window.__refreshRecentObservations = function () {
        var host = document.getElementById('obs-recent');
        if (!host || !window.safetyObservations) return;
        window.safetyObservations.getObservations({}).then(function (res) {
            var items = (res && res.data) ? res.data.slice(0, 5) : [];
            if (items.length === 0) {
                host.innerHTML = '<div style="padding:1rem; background:#f8fafc; border-radius:10px; font-size:0.85rem; color:#64748b;">No observations recorded yet.</div>';
                return;
            }
            var html = '<div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:0.5rem;">Recent Observations</div>';
            items.forEach(function (o) {
                html += '<div style="padding:0.75rem 0.9rem; background:#f8fafc; border-radius:8px; margin-bottom:0.5rem;">' +
                    '<div style="font-weight:600; font-size:0.87rem;">' + escapeHtml(o.title || '') + '</div>' +
                    '<div style="font-size:0.75rem; color:#64748b; margin-top:0.15rem;">' +
                        escapeHtml(o.location || '—') + ' · ' + escapeHtml(o.risk_level || 'low') +
                    '</div>' +
                '</div>';
            });
            host.innerHTML = html;
        });
    };

    // ---------- Incident Investigator ----------
    window.loadIncidentInvestigator = function () {
        var el = document.getElementById('investigationContent');
        if (!el) return;

        if (!window.incidentInvestigator) {
            el.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">' +
                '<div style="font-size:3rem;">⚠️</div>' +
                '<h3>Investigation module not loaded</h3></div>';
            return;
        }

        el.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">Loading investigations…</div>';

        window.incidentInvestigator.getOpenInvestigations().then(function (res) {
            var items = (res && res.data) ? res.data : [];
            var html = '' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1.25rem; flex-wrap:wrap;">' +
                    '<div>' +
                        '<div style="font-weight:600;">Open Investigations</div>' +
                        '<div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem;">' + items.length + ' active</div>' +
                    '</div>' +
                    '<button class="btn btn-primary btn-sm" onclick="window.__startInvestigationDialog()">+ Start New Investigation</button>' +
                '</div>';

            if (items.length === 0) {
                html += '<div style="text-align:center; padding:2.5rem 1rem; color:#64748b; border:1px dashed #cbd5e1; border-radius:12px;">' +
                    '<div style="font-size:3rem; margin-bottom:0.5rem;">🔍</div>' +
                    '<div style="font-weight:600; color:#0f172a; margin-bottom:0.35rem;">No open investigations</div>' +
                    '<div style="font-size:0.85rem;">Investigations appear here once started from a reported incident.</div>' +
                '</div>';
            } else {
                items.forEach(function (inv) {
                    html += '<div style="padding:0.9rem 1.1rem; background:#f8fafc; border-radius:10px; margin-bottom:0.6rem; border-left:3px solid #dc2626;">' +
                        '<div style="font-weight:600;">' + escapeHtml(inv.incident_type || 'Investigation') + ' — ' + escapeHtml(inv.incident_id || inv.id) + '</div>' +
                        '<div style="font-size:0.8rem; color:#64748b; margin-top:0.25rem;">' +
                            'Stage: ' + (inv.current_stage || 1) + ' / ' + (inv.total_stages || 0) +
                            ' · Progress: ' + (inv.progress_percentage || 0) + '%' +
                        '</div>' +
                    '</div>';
                });
            }

            el.innerHTML = html;
        });
    };

    window.__startInvestigationDialog = function () {
        var incidentId = prompt('Enter incident ID to investigate (e.g., INC-123456):', '');
        if (!incidentId) return;
        if (!window.mmsCurrentUser) { alert('Sign in required.'); return; }
        window.startInvestigation(incidentId);
    };

    console.log('[app.js] Module loaders patched — real modules now wired');
})();
