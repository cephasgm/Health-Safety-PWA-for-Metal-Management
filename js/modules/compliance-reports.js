// ============================================================
// compliance-reports.js
// Phase 6 - Audit-ready PDF exports
// ============================================================
//
// Generates:
//   - OSHA 300   - Log of Work-Related Injuries and Illnesses
//   - OSHA 301   - Incident Report (per incident)
//   - OSHA 300A  - Annual Summary
//   - ISO 45001  - Clause-by-clause evidence package
//
// Sources:
//   - Firestore incidents, audits, hazards, training,
//     corrective_actions, compliance_obligations, etc.
//   - Real data only. Empty sections state "no records".
//
// Exposes: window.mmsReports
// ============================================================

import { db } from '../core/firebase-config.js';
import {
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ============================================================
// HELPERS
// ============================================================

function getJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    throw new Error('jsPDF library not loaded.');
}

function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
    if (typeof v === 'number') return new Date(v);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function isSignedIn() { return !!window.mmsCurrentUser; }

function safeStr(s, max = 200) {
    return String(s == null ? '' : s).slice(0, max);
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// DATA LOADER
// ============================================================

async function loadCollection(name) {
    try {
        const q = query(collection(db, name), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        const out = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        return out;
    } catch (err) {
        // Fallback without orderBy - collection may not have that field
        try {
            const snap = await getDocs(collection(db, name));
            const out = [];
            snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
            return out;
        } catch (err2) {
            console.warn('[reports] Could not load', name, err2.code || err2.message);
            return [];
        }
    }
}

function filterByYear(records, year, dateField = 'date') {
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year, 11, 31, 23, 59, 59).getTime();
    return records.filter((r) => {
        const d = toDate(r[dateField] || r.created_at || r.createdAt);
        if (!d) return false;
        const t = d.getTime();
        return t >= start && t <= end;
    });
}

// ============================================================
// PDF PRIMITIVES
// ============================================================

function addHeader(doc, title, subtitle) {
    doc.setFillColor(220, 38, 38);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.text('MMS Safety', 12, 10);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Metal Management Solutions - ISO 45001 OH&S System', 12, 16);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(title, 12, 33);

    if (subtitle) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, 12, 39);
    }

    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(226, 232, 240);
    doc.line(12, 43, 198, 43);
}

function addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            'Generated ' + new Date().toLocaleString() + ' | Page ' + i + ' of ' + pageCount,
            12,
            290
        );
        doc.text('Confidential - ' + (window.mmsCurrentUser?.email || ''), 150, 290);
    }
}

function simpleTable(doc, startY, headers, rows, colWidths) {
    const pageW = 210;
    const marginL = 12;
    let y = startY;

    // Header row
    doc.setFillColor(241, 245, 249);
    doc.rect(marginL, y - 5, pageW - 2 * marginL, 8, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(71, 85, 105);
    let x = marginL + 2;
    headers.forEach((h, i) => {
        doc.text(String(h), x, y);
        x += colWidths[i];
    });
    y += 6;

    // Body rows
    doc.setFont(undefined, 'normal');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);

    rows.forEach((row, rowIdx) => {
        if (y > 275) {
            doc.addPage();
            y = 20;
        }
        if (rowIdx % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(marginL, y - 4, pageW - 2 * marginL, 7, 'F');
        }

        x = marginL + 2;
        row.forEach((cell, i) => {
            const text = safeStr(cell, Math.floor(colWidths[i] / 1.5));
            doc.text(text, x, y);
            x += colWidths[i];
        });
        y += 6;
    });

    return y;
}

// ============================================================
// OSHA 300 - Log of Work-Related Injuries and Illnesses
// ============================================================

async function exportOSHA300(year) {
    const jsPDF = getJsPDF();
    const incidents = await loadCollection('incidents');
    const yearIncidents = filterByYear(incidents, year);

    const eligible = yearIncidents.filter((i) =>
        i.type !== 'Near Miss' && i.type !== 'Property Damage'
    );

    const doc = new jsPDF({ orientation: 'landscape' });
    addHeader(doc, 'OSHA Form 300', 'Log of Work-Related Injuries and Illnesses - Calendar Year ' + year);

    doc.setFontSize(9);
    doc.text('Establishment: Metal Management Solutions', 12, 52);
    doc.text('Year: ' + year, 12, 58);

    const headers = [
        'Case No', 'Employee', 'Job Title', 'Date',
        'Where', 'Description', 'Classification', 'Days Away', 'Days Restricted'
    ];
    const colWidths = [18, 30, 28, 22, 30, 55, 32, 20, 24];

    const rows = eligible.map((inc, idx) => {
        const d = toDate(inc.date || inc.created_at);
        return [
            String(idx + 1).padStart(3, '0'),
            inc.reportedBy || inc.employee || '-',
            inc.department || '-',
            d ? d.toISOString().split('T')[0] : '-',
            inc.location || '-',
            inc.description || '-',
            inc.type || '-',
            inc.days_away != null ? String(inc.days_away) : '0',
            inc.days_restricted != null ? String(inc.days_restricted) : '0'
        ];
    });

    if (rows.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text('No OSHA-eligible incidents recorded for ' + year + '.', 12, 70);
    } else {
        simpleTable(doc, 68, headers, rows, colWidths);
    }

    addFooter(doc);
    doc.save('osha-300-' + year + '.pdf');
    return { success: true, count: rows.length };
}

// ============================================================
// OSHA 300A - Annual Summary
// ============================================================

async function exportOSHA300A(year) {
    const jsPDF = getJsPDF();
    const incidents = await loadCollection('incidents');
    const yearIncidents = filterByYear(incidents, year);

    const eligible = yearIncidents.filter((i) =>
        i.type !== 'Near Miss' && i.type !== 'Property Damage'
    );

    const deaths       = eligible.filter((i) => i.severity === 'Critical').length;
    const daysAway     = eligible.filter((i) => i.type === 'Lost Time Injury').length;
    const restricted   = eligible.filter((i) => i.severity === 'Serious' && i.type !== 'Lost Time Injury').length;
    const medical      = eligible.filter((i) => i.type === 'Medical Treatment').length;
    const firstAid     = eligible.filter((i) => i.type === 'First Aid').length;
    const totalCases   = eligible.length;
    const totalDaysAway = eligible.reduce((s, i) => s + (Number(i.days_away) || 0), 0);
    const totalDaysRestricted = eligible.reduce((s, i) => s + (Number(i.days_restricted) || 0), 0);

    const doc = new jsPDF();
    addHeader(doc, 'OSHA Form 300A', 'Summary of Work-Related Injuries and Illnesses - ' + year);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Establishment Information', 12, 52);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text('Company: Metal Management Solutions', 12, 60);
    doc.text('Calendar Year: ' + year, 12, 66);
    doc.text('NAICS Code: 331 - Primary Metal Manufacturing', 12, 72);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('Number of Cases', 12, 86);

    const rows = [
        ['Total number of deaths', String(deaths)],
        ['Total number of cases with days away from work', String(daysAway)],
        ['Total number of cases with job transfer or restriction', String(restricted)],
        ['Total number of other recordable cases', String(medical + firstAid)],
        ['Total number of recordable cases', String(totalCases)],
        ['Total number of days away from work', String(totalDaysAway)],
        ['Total number of days of job transfer or restriction', String(totalDaysRestricted)]
    ];

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    let y = 94;
    rows.forEach(([label, value]) => {
        doc.setDrawColor(226, 232, 240);
        doc.line(12, y + 2, 198, y + 2);
        doc.text(label, 14, y);
        doc.setFont(undefined, 'bold');
        doc.text(value, 190, y, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += 8;
    });

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
        'This summary must be posted in a conspicuous place where notices to employees are customarily posted.',
        12, y + 12, { maxWidth: 186 }
    );

    addFooter(doc);
    doc.save('osha-300a-' + year + '.pdf');
    return { success: true };
}

// ============================================================
// OSHA 301 - Incident Report (all incidents in year, detailed)
// ============================================================

async function exportOSHA301(year) {
    const jsPDF = getJsPDF();
    const incidents = await loadCollection('incidents');
    const yearIncidents = filterByYear(incidents, year);

    const doc = new jsPDF();
    addHeader(doc, 'Incident Reports - OSHA 301', 'Detailed incidents for calendar year ' + year);

    if (yearIncidents.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text('No incidents recorded for ' + year + '.', 12, 60);
        addFooter(doc);
        doc.save('osha-301-' + year + '.pdf');
        return { success: true, count: 0 };
    }

    yearIncidents.forEach((inc, idx) => {
        if (idx > 0) doc.addPage();
        let y = 50;

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Case ' + (idx + 1) + ' - ' + safeStr(inc.id, 40), 12, y);
        y += 8;

        const d = toDate(inc.date || inc.created_at);
        const fields = [
            ['Date of incident', d ? d.toLocaleString() : '-'],
            ['Time', d ? d.toLocaleTimeString() : '-'],
            ['Type', inc.type || '-'],
            ['Severity', inc.severity || '-'],
            ['Location', inc.location || '-'],
            ['Department', inc.department || '-'],
            ['Reported by', inc.reportedBy || '-'],
            ['Status', inc.status || '-']
        ];

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        fields.forEach(([label, value]) => {
            doc.setFont(undefined, 'bold');
            doc.text(label + ':', 14, y);
            doc.setFont(undefined, 'normal');
            doc.text(safeStr(value, 120), 60, y);
            y += 6;
        });

        y += 3;
        doc.setFont(undefined, 'bold');
        doc.text('Description:', 14, y);
        y += 6;
        doc.setFont(undefined, 'normal');
        doc.text(safeStr(inc.description, 1600), 14, y, { maxWidth: 184 });
        y += doc.getTextDimensions(safeStr(inc.description, 1600), { maxWidth: 184 }).h + 4;

        if (inc.actions) {
            doc.setFont(undefined, 'bold');
            doc.text('Immediate actions taken:', 14, y);
            y += 6;
            doc.setFont(undefined, 'normal');
            doc.text(safeStr(inc.actions, 1000), 14, y, { maxWidth: 184 });
        }
    });

    addFooter(doc);
    doc.save('osha-301-' + year + '.pdf');
    return { success: true, count: yearIncidents.length };
}

// ============================================================
// ISO 45001 - Clause-by-clause Evidence Package
// ============================================================

const ISO_CLAUSES = [
    { id: '4',    title: 'Context of the Organization', collections: ['users', 'locations'] },
    { id: '5',    title: 'Leadership and Worker Participation', collections: ['users'] },
    { id: '6.1.2', title: 'Hazard Identification', collections: ['hazards'] },
    { id: '6.1.3', title: 'Legal Requirements Register', collections: ['compliance_obligations'] },
    { id: '7.2',  title: 'Competence and Training', collections: ['training'] },
    { id: '8.1',  title: 'Operational Planning - Incidents', collections: ['incidents'] },
    { id: '8.2',  title: 'Emergency Preparedness', collections: [] },
    { id: '9.1.2', title: 'Evaluation of Compliance', collections: ['standards'] },
    { id: '9.2',  title: 'Internal Audit', collections: ['audits'] },
    { id: '9.3',  title: 'Management Review', collections: ['management_reviews'] },
    { id: '10.2', title: 'Corrective Action', collections: ['corrective_actions'] }
];

async function exportISO45001Evidence() {
    const jsPDF = getJsPDF();
    const doc = new jsPDF();
    addHeader(doc, 'ISO 45001:2018 - Evidence Package', 'Clause-by-clause audit evidence - ' + new Date().toLocaleDateString());

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
        'This document is an automatically generated evidence pack. Each clause lists the underlying records available in the system at generation time.',
        12, 55, { maxWidth: 186 }
    );

    let y = 75;

    for (const clause of ISO_CLAUSES) {
        if (y > 260) {
            doc.addPage();
            y = 25;
        }

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text('Clause ' + clause.id + ' - ' + clause.title, 12, y);
        y += 7;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Evidence source collections: ' + (clause.collections.join(', ') || 'N/A'), 14, y);
        y += 6;

        if (clause.collections.length === 0) {
            doc.setTextColor(148, 163, 184);
            doc.text('No systematic collection. Refer to policy documentation.', 14, y);
            y += 8;
        } else {
            for (const coll of clause.collections) {
                const records = await loadCollection(coll);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(15, 23, 42);
                doc.text(coll + ': ' + records.length + ' record(s)', 14, y);
                y += 5;

                if (records.length > 0) {
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(71, 85, 105);
                    const sample = records.slice(0, 3).map((r) =>
                        (r.id || r.name || r.title || 'record')
                    ).join(', ');
                    doc.text('  - ' + safeStr(sample, 150), 16, y);
                    y += 5;
                }

                if (y > 275) {
                    doc.addPage();
                    y = 25;
                }
            }
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(12, y, 198, y);
        y += 8;
    }

    if (y > 250) {
        doc.addPage();
        y = 25;
    }
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Certification / Sign-off', 12, y);
    y += 10;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Prepared by: ' + (window.mmsCurrentUser?.email || '-'), 12, y);
    y += 6;
    doc.text('Role: ' + (window.mmsCurrentUser?.role || '-'), 12, y);
    y += 10;
    doc.text('Signature: __________________________   Date: __________________', 12, y);

    addFooter(doc);
    doc.save('iso-45001-evidence-' + todayISO() + '.pdf');
    return { success: true };
}

// ============================================================
// PUBLIC API
// ============================================================

window.mmsReports = {
    exportOSHA300:    (year) => exportOSHA300(year || new Date().getFullYear()),
    exportOSHA301:    (year) => exportOSHA301(year || new Date().getFullYear()),
    exportOSHA300A:   (year) => exportOSHA300A(year || new Date().getFullYear()),
    exportISO45001:   () => exportISO45001Evidence(),

    pickAndExport: async (type) => {
        const thisYear = new Date().getFullYear();
        const y = prompt(
            'Select year for ' + type.toUpperCase() + ':',
            String(thisYear)
        );
        const year = parseInt(y, 10);
        if (!year || year < 2000 || year > thisYear + 1) {
            if (y !== null) alert('Invalid year.');
            return;
        }
        try {
            const fn = window.mmsReports['export' + type];
            if (!fn) { alert('Unknown report type: ' + type); return; }
            const result = await fn(year);
            console.log('[reports] ' + type + ' generated:', result);
        } catch (err) {
            console.error('[reports] Export failed:', err);
            alert('Export failed: ' + (err.message || 'unknown error'));
        }
    },

    exportISO45001Dialog: async () => {
        try {
            await window.mmsReports.exportISO45001();
        } catch (err) {
            console.error('[reports] Export failed:', err);
            alert('Export failed: ' + (err.message || 'unknown error'));
        }
    }
};

console.log('[compliance-reports] Ready');