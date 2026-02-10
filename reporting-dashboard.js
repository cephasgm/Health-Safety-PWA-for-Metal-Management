// MMS Safety - Management Reporting Dashboard
import { mmsDB } from './database-service.js';

class SafetyReportingDashboard {
  constructor() {
    this.reportTypes = {
      INCIDENT_SUMMARY: 'incident_summary',
      COMPLIANCE_REPORT: 'compliance_report',
      TRAINING_STATUS: 'training_status',
      PPE_INVENTORY: 'ppe_inventory',
      HEALTH_SURVEILLANCE: 'health_surveillance',
      AUDIT_FINDINGS: 'audit_findings',
      CONTRACTOR_SAFETY: 'contractor_safety',
      RISK_ASSESSMENT: 'risk_assessment'
    };
    
    this.init();
  }

  init() {
    console.log('📊 Safety Reporting Dashboard Initialized');
    
    // Make available globally
    window.safetyReports = this;
  }

  // ==================== REPORT GENERATION ====================
  
  async generateIncidentSummaryReport(options = {}) {
    try {
      console.log('📈 Generating incident summary report...');
      
      const filters = {
        location: options.location || 'All',
        startDate: options.startDate || this.getFirstDayOfMonth(),
        endDate: options.endDate || new Date().toISOString().split('T')[0],
        department: options.department || 'All',
        severity: options.severity || 'All'
      };
      
      // Get incident data
      const incidentsResult = await mmsDB.getIncidents(filters);
      
      if (!incidentsResult.success) {
        throw new Error('Failed to fetch incident data');
      }
      
      const incidents = incidentsResult.data;
      
      // Calculate statistics
      const stats = this.calculateIncidentStatistics(incidents);
      const trends = this.analyzeIncidentTrends(incidents);
      const hotspots = this.identifySafetyHotspots(incidents);
      const rootCauses = this.analyzeRootCauses(incidents);
      
      // Generate report structure
      const report = {
        type: this.reportTypes.INCIDENT_SUMMARY,
        title: 'Safety Incident Summary Report',
        period: `${filters.startDate} to ${filters.endDate}`,
        generated_at: new Date().toISOString(),
        generated_by: window.mmsAuth?.currentUser?.email || 'Unknown',
        company: 'Metal Management Solutions',
        
        // Executive Summary
        executive_summary: {
          total_incidents: stats.total,
          lost_time_injuries: stats.lostTimeInjuries,
          near_misses: stats.nearMisses,
          first_aid_cases: stats.firstAidCases,
          severity_distribution: stats.severityDistribution,
          location_summary: stats.locationSummary,
          trend: trends.overallTrend,
          recommendation: this.generateRecommendation(stats, trends)
        },
        
        // Detailed Analysis
        detailed_analysis: {
          incidents_by_type: stats.incidentsByType,
          incidents_by_location: stats.incidentsByLocation,
          incidents_by_department: stats.incidentsByDepartment,
          incidents_by_severity: stats.incidentsBySeverity,
          incidents_by_time: stats.incidentsByTimeOfDay,
          incidents_by_day: stats.incidentsByDayOfWeek,
          incidents_by_month: stats.incidentsByMonth
        },
        
        // Safety Hotspots
        safety_hotspots: hotspots.map(hotspot => ({
          location: hotspot.location,
          incident_count: hotspot.count,
          types: hotspot.types,
          severity: hotspot.severity,
          recommendation: hotspot.recommendation
        })),
        
        // Root Cause Analysis
        root_causes: rootCauses.map(cause => ({
          category: cause.category,
          frequency: cause.frequency,
          percentage: cause.percentage,
          examples: cause.examples,
          corrective_actions: cause.actions
        })),
        
        // Key Performance Indicators
        kpis: {
          incident_rate_per_100_employees: this.calculateIncidentRate(stats.total),
          days_since_last_lost_time_injury: this.calculateDaysSinceLastLTI(incidents),
          severity_index: this.calculateSeverityIndex(incidents),
          corrective_action_completion_rate: 0.85, // Would come from database
          safety_training_completion_rate: 0.92
        },
        
        // Recommendations
        recommendations: [
          {
            priority: 'HIGH',
            action: 'Immediate safety audit at ' + (hotspots[0]?.location || 'main facility'),
            responsibility: 'Safety Officer',
            deadline: this.getDateInFuture(7),
            cost_estimate: 'Low',
            impact: 'High'
          },
          {
            priority: 'MEDIUM',
            action: 'Additional safety training for ' + stats.mostAffectedDepartment,
            responsibility: 'Training Manager',
            deadline: this.getDateInFuture(30),
            cost_estimate: 'Medium',
            impact: 'Medium'
          },
          {
            priority: 'LOW',
            action: 'Update PPE inventory based on incident patterns',
            responsibility: 'PPE Manager',
            deadline: this.getDateInFuture(60),
            cost_estimate: 'Low',
            impact: 'Medium'
          }
        ],
        
        // Raw Data (for reference)
        raw_data_summary: {
          total_records: incidents.length,
          date_range: `${filters.startDate} to ${filters.endDate}`,
          filter_criteria: filters
        }
      };
      
      console.log(`✅ Generated incident report with ${incidents.length} incidents`);
      
      return {
        success: true,
        report: report,
        format: 'json',
        download_formats: ['pdf', 'excel', 'html'],
        message: 'Incident summary report generated successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to generate incident report:', error);
      return {
        success: false,
        error: 'Failed to generate report: ' + error.message
      };
    }
  }

  // ==================== STATISTICS CALCULATION ====================
  
  calculateIncidentStatistics(incidents) {
    const stats = {
      total: incidents.length,
      lostTimeInjuries: 0,
      nearMisses: 0,
      firstAidCases: 0,
      severityDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      locationSummary: {},
      incidentsByType: {},
      incidentsByLocation: {},
      incidentsByDepartment: {},
      incidentsBySeverity: {},
      incidentsByTimeOfDay: {},
      incidentsByDayOfWeek: {},
      incidentsByMonth: {},
      mostAffectedDepartment: '',
      mostCommonType: '',
      highestSeverityLocation: ''
    };
    
    incidents.forEach(incident => {
      // Count by type
      const type = incident.type || 'Unknown';
      stats.incidentsByType[type] = (stats.incidentsByType[type] || 0) + 1;
      
      // Count by location
      const location = incident.location || 'Unknown';
      stats.incidentsByLocation[location] = (stats.incidentsByLocation[location] || 0) + 1;
      
      // Count by department
      const dept = incident.department || 'Unknown';
      stats.incidentsByDepartment[dept] = (stats.incidentsByDepartment[dept] || 0) + 1;
      
      // Count by severity
      const severity = incident.severity?.toLowerCase() || 'medium';
      stats.severityDistribution[severity] = (stats.severityDistribution[severity] || 0) + 1;
      
      // Special categories
      if (type.toLowerCase().includes('lost time')) stats.lostTimeInjuries++;
      if (type.toLowerCase().includes('near miss')) stats.nearMisses++;
      if (type.toLowerCase().includes('first aid')) stats.firstAidCases++;
      
      // Time analysis
      const date = new Date(incident.date_time || incident.created_at);
      const hour = date.getHours();
      const day = date.getDay();
      const month = date.getMonth();
      
      const timeCategory = this.getTimeOfDay(hour);
      stats.incidentsByTimeOfDay[timeCategory] = (stats.incidentsByTimeOfDay[timeCategory] || 0) + 1;
      stats.incidentsByDayOfWeek[day] = (stats.incidentsByDayOfWeek[day] || 0) + 1;
      stats.incidentsByMonth[month] = (stats.incidentsByMonth[month] || 0) + 1;
    });
    
    // Find most affected
    stats.mostAffectedDepartment = this.getMaxKey(stats.incidentsByDepartment);
    stats.mostCommonType = this.getMaxKey(stats.incidentsByType);
    stats.highestSeverityLocation = this.findHighestSeverityLocation(incidents);
    
    return stats;
  }

  analyzeIncidentTrends(incidents) {
    if (incidents.length < 2) {
      return { overallTrend: 'Insufficient data', monthlyTrends: [] };
    }
    
    // Group by month
    const monthlyData = {};
    incidents.forEach(incident => {
      const date = new Date(incident.date_time || incident.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });
    
    // Calculate trend
    const months = Object.keys(monthlyData).sort();
    let trend = 'stable';
    
    if (months.length >= 2) {
      const firstMonth = months[0];
      const lastMonth = months[months.length - 1];
      const firstCount = monthlyData[firstMonth];
      const lastCount = monthlyData[lastMonth];
      
      const change = ((lastCount - firstCount) / firstCount) * 100;
      
      if (change > 10) trend = 'increasing';
      else if (change < -10) trend = 'decreasing';
      else trend = 'stable';
    }
    
    return {
      overallTrend: trend,
      monthlyTrends: Object.entries(monthlyData).map(([month, count]) => ({
        month,
        count,
        severityBreakdown: this.getMonthlySeverity(incidents, month)
      }))
    };
  }

  identifySafetyHotspots(incidents) {
    const locationMap = {};
    
    incidents.forEach(incident => {
      const location = incident.location || 'Unknown';
      if (!locationMap[location]) {
        locationMap[location] = {
          count: 0,
          types: new Set(),
          severities: []
        };
      }
      
      locationMap[location].count++;
      locationMap[location].types.add(incident.type || 'Unknown');
      locationMap[location].severities.push(incident.severity || 'Medium');
    });
    
    // Convert to array and sort by count
    return Object.entries(locationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        types: Array.from(data.types),
        severity: this.calculateAverageSeverity(data.severities),
        recommendation: this.generateLocationRecommendation(location, data)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 hotspots
  }

  analyzeRootCauses(incidents) {
    // Analyze incident descriptions for root causes
    const causes = {
      'Human Error': { count: 0, examples: [] },
      'Equipment Failure': { count: 0, examples: [] },
      'Procedural Violation': { count: 0, examples: [] },
      'Environmental Factors': { count: 0, examples: [] },
      'Training Deficiency': { count: 0, examples: [] },
      'Supervision Issue': { count: 0, examples: [] },
      'Communication Breakdown': { count: 0, examples: [] }
    };
    
    const keywords = {
      'Human Error': ['forgot', 'mistake', 'error', 'careless', 'distracted', 'negligent'],
      'Equipment Failure': ['broken', 'malfunction', 'failure', 'defect', 'faulty'],
      'Procedural Violation': ['procedure', 'protocol', 'violation', 'not followed', 'skip'],
      'Environmental Factors': ['weather', 'slippery', 'dark', 'noisy', 'congested'],
      'Training Deficiency': ['untrained', 'no training', 'lack of knowledge', 'unfamiliar'],
      'Supervision Issue': ['unsupervised', 'no supervisor', 'leadership', 'management'],
      'Communication Breakdown': ['miscommunication', 'not informed', 'no warning', 'signal']
    };
    
    incidents.forEach(incident => {
      const desc = (incident.description || '').toLowerCase();
      let found = false;
      
      for (const [cause, words] of Object.entries(keywords)) {
        if (words.some(word => desc.includes(word))) {
          causes[cause].count++;
          causes[cause].examples.push(incident.description?.substring(0, 100) + '...');
          found = true;
          break;
        }
      }
      
      if (!found) {
        causes['Human Error'].count++; // Default
        causes['Human Error'].examples.push(incident.description?.substring(0, 100) + '...');
      }
    });
    
    const total = incidents.length;
    
    return Object.entries(causes)
      .filter(([_, data]) => data.count > 0)
      .map(([cause, data]) => ({
        category: cause,
        frequency: data.count,
        percentage: Math.round((data.count / total) * 100),
        examples: data.examples.slice(0, 3),
        actions: this.generateRootCauseActions(cause)
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  // ==================== REPORT EXPORT ====================
  
  async exportReportToPDF(reportData, format = 'pdf') {
    try {
      console.log(`📤 Exporting report as ${format.toUpperCase()}...`);
      
      // Create HTML template for the report
      const htmlContent = this.generateReportHTML(reportData);
      
      if (format === 'html') {
        return this.exportAsHTML(htmlContent, reportData.title);
      }
      
      if (format === 'excel') {
        return this.exportAsExcel(reportData);
      }
      
      // For PDF, use html2canvas and jsPDF
      if (format === 'pdf' && window.html2canvas && window.jspdf) {
        return await this.exportAsPDF(htmlContent, reportData.title);
      }
      
      // Fallback to JSON download
      return this.exportAsJSON(reportData);
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      return this.exportAsJSON(reportData);
    }
  }

  generateReportHTML(report) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${report.title} - MMS Safety</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
          .company-logo { font-size: 24px; font-weight: bold; color: #dc2626; margin-bottom: 10px; }
          .report-title { font-size: 28px; margin: 10px 0; }
          .report-meta { color: #666; font-size: 14px; }
          .section { margin: 30px 0; }
          .section-title { background: #f1f5f9; padding: 10px; border-left: 4px solid #3b82f6; font-size: 18px; margin-bottom: 15px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
          .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
          .kpi-value { font-size: 32px; font-weight: bold; color: #dc2626; margin: 10px 0; }
          .kpi-label { color: #64748b; font-size: 14px; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th { background: #f8fafc; padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
          .table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .priority-high { color: #dc2626; font-weight: bold; }
          .priority-medium { color: #f59e0b; font-weight: bold; }
          .priority-low { color: #10b981; font-weight: bold; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-logo">METAL MANAGEMENT SOLUTIONS</div>
          <div class="report-title">${report.title}</div>
          <div class="report-meta">
            Period: ${report.period} | Generated: ${new Date(report.generated_at).toLocaleDateString()} | 
            Generated by: ${report.generated_by}
          </div>
        </div>
        
        <!-- Executive Summary -->
        <div class="section">
          <div class="section-title">Executive Summary</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-value">${report.executive_summary.total_incidents}</div>
              <div class="kpi-label">Total Incidents</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${report.executive_summary.lost_time_injuries}</div>
              <div class="kpi-label">Lost Time Injuries</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${report.executive_summary.near_misses}</div>
              <div class="kpi-label">Near Misses</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${report.executive_summary.first_aid_cases}</div>
              <div class="kpi-label">First Aid Cases</div>
            </div>
          </div>
          
          <p><strong>Overall Trend:</strong> ${report.executive_summary.trend}</p>
          <p><strong>Key Recommendation:</strong> ${report.executive_summary.recommendation}</p>
        </div>
        
        <!-- Safety Hotspots -->
        ${report.safety_hotspots.length > 0 ? `
        <div class="section">
          <div class="section-title">Safety Hotspots (Top ${report.safety_hotspots.length})</div>
          <table class="table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Incident Count</th>
                <th>Primary Types</th>
                <th>Severity</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              ${report.safety_hotspots.map(hotspot => `
                <tr>
                  <td><strong>${hotspot.location}</strong></td>
                  <td>${hotspot.incident_count}</td>
                  <td>${hotspot.types.slice(0, 3).join(', ')}</td>
                  <td>${hotspot.severity}</td>
                  <td>${hotspot.recommendation}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Root Causes -->
        ${report.root_causes.length > 0 ? `
        <div class="section">
          <div class="section-title">Root Cause Analysis</div>
          <table class="table">
            <thead>
              <tr>
                <th>Root Cause Category</th>
                <th>Frequency</th>
                <th>Percentage</th>
                <th>Corrective Actions</th>
              </tr>
            </thead>
            <tbody>
              ${report.root_causes.map(cause => `
                <tr>
                  <td>${cause.category}</td>
                  <td>${cause.frequency}</td>
                  <td>${cause.percentage}%</td>
                  <td>${cause.corrective_actions}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <!-- Recommendations -->
        <div class="section">
          <div class="section-title">Actionable Recommendations</div>
          <table class="table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Action Required</th>
                <th>Responsibility</th>
                <th>Deadline</th>
                <th>Expected Impact</th>
              </tr>
            </thead>
            <tbody>
              ${report.recommendations.map(rec => `
                <tr>
                  <td><span class="priority-${rec.priority.toLowerCase()}">${rec.priority}</span></td>
                  <td>${rec.action}</td>
                  <td>${rec.responsibility}</td>
                  <td>${new Date(rec.deadline).toLocaleDateString()}</td>
                  <td>${rec.impact}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- KPIs -->
        <div class="section">
          <div class="section-title">Safety Performance Indicators</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-value">${report.kpis.incident_rate_per_100_employees.toFixed(2)}</div>
              <div class="kpi-label">Incident Rate (per 100 employees)</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${report.kpis.days_since_last_lost_time_injury}</div>
              <div class="kpi-label">Days Since Last LTI</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${report.kpis.severity_index.toFixed(2)}</div>
              <div class="kpi-label">Severity Index</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${(report.kpis.corrective_action_completion_rate * 100).toFixed(0)}%</div>
              <div class="kpi-label">Corrective Action Completion</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>Confidential - For Internal Use Only</p>
          <p>Metal Management Solutions Safety Department | ${new Date().getFullYear()}</p>
          <p>This report generated by MMS Safety Management System v2.0</p>
        </div>
      </body>
      </html>
    `;
  }

  // ==================== UTILITY METHODS ====================
  
  getFirstDayOfMonth() {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  }

  getTimeOfDay(hour) {
    if (hour >= 6 && hour < 12) return 'Morning (6am-12pm)';
    if (hour >= 12 && hour < 14) return 'Lunch (12pm-2pm)';
    if (hour >= 14 && hour < 18) return 'Afternoon (2pm-6pm)';
    if (hour >= 18 && hour < 22) return 'Evening (6pm-10pm)';
    return 'Night (10pm-6am)';
  }

  getMaxKey(obj) {
    return Object.entries(obj).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  calculateAverageSeverity(severities) {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    let total = 0;
    severities.forEach(s => {
      total += scores[s?.toLowerCase()] || 2;
    });
    const avg = total / severities.length;
    
    if (avg >= 3.5) return 'Critical';
    if (avg >= 2.5) return 'High';
    if (avg >= 1.5) return 'Medium';
    return 'Low';
  }

  findHighestSeverityLocation(incidents) {
    const locationSeverity = {};
    const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    
    incidents.forEach(incident => {
      const location = incident.location || 'Unknown';
      const severity = incident.severity?.toLowerCase() || 'medium';
      locationSeverity[location] = (locationSeverity[location] || 0) + (severityScores[severity] || 2);
    });
    
    return this.getMaxKey(locationSeverity);
  }

  generateLocationRecommendation(location, data) {
    if (data.count > 5) {
      return `Immediate safety audit required at ${location}. High incident frequency detected.`;
    } else if (data.severities.some(s => s.toLowerCase() === 'critical')) {
      return `Urgent intervention needed at ${location}. Critical severity incidents reported.`;
    } else if (data.types.size > 3) {
      return `Comprehensive safety review needed at ${location}. Multiple incident types detected.`;
    }
    return `Regular monitoring recommended for ${location}.`;
  }

  generateRootCauseActions(cause) {
    const actions = {
      'Human Error': 'Implement additional safety training and job aids',
      'Equipment Failure': 'Schedule preventive maintenance and equipment checks',
      'Procedural Violation': 'Review and simplify safety procedures',
      'Environmental Factors': 'Improve workplace design and environmental controls',
      'Training Deficiency': 'Develop targeted safety training programs',
      'Supervision Issue': 'Enhance supervisor training and oversight',
      'Communication Breakdown': 'Improve safety communication systems'
    };
    return actions[cause] || 'Review and address underlying factors';
  }

  generateRecommendation(stats, trends) {
    if (stats.lostTimeInjuries > 0) {
      return 'Urgent action required due to lost time injuries. Immediate safety review needed.';
    } else if (trends.overallTrend === 'increasing') {
      return 'Incident trend is increasing. Proactive safety measures recommended.';
    } else if (stats.mostCommonType.includes('Near Miss')) {
      return 'High number of near misses indicates potential for serious incidents. Review safety protocols.';
    }
    return 'Continue current safety programs with regular monitoring and review.';
  }

  calculateIncidentRate(totalIncidents) {
    // Assuming 100 employees for calculation
    return (totalIncidents / 100) * 100;
  }

  calculateDaysSinceLastLTI(incidents) {
    const ltis = incidents.filter(i => 
      i.type?.toLowerCase().includes('lost time')
    );
    
    if (ltis.length === 0) return 'No LTI recorded';
    
    const lastLTI = ltis.sort((a, b) => 
      new Date(b.date_time || b.created_at) - new Date(a.date_time || a.created_at)
    )[0];
    
    const lastDate = new Date(lastLTI.date_time || lastLTI.created_at);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  calculateSeverityIndex(incidents) {
    const severityWeights = { critical: 10, high: 5, medium: 2, low: 1 };
    let totalWeight = 0;
    
    incidents.forEach(incident => {
      const severity = incident.severity?.toLowerCase() || 'medium';
      totalWeight += severityWeights[severity] || 2;
    });
    
    return totalIncidents > 0 ? totalWeight / incidents.length : 0;
  }

  getDateInFuture(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  getMonthlySeverity(incidents, monthKey) {
    const monthIncidents = incidents.filter(incident => {
      const date = new Date(incident.date_time || incident.created_at);
      const incidentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return incidentMonth === monthKey;
    });
    
    const severities = { critical: 0, high: 0, medium: 0, low: 0 };
    monthIncidents.forEach(incident => {
      const severity = incident.severity?.toLowerCase() || 'medium';
      severities[severity] = (severities[severity] || 0) + 1;
    });
    
    return severities;
  }

  // ==================== EXPORT METHODS ====================
  
  exportAsHTML(htmlContent, title) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, format: 'html', message: 'HTML report downloaded' };
  }

  exportAsJSON(reportData) {
    const dataStr = JSON.stringify(reportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, format: 'json', message: 'JSON report downloaded' };
  }

  exportAsExcel(reportData) {
    // Simplified Excel export - in production, use a library like SheetJS
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add headers
    csvContent += "MMS Safety Report - " + reportData.title + "\n";
    csvContent += "Generated: " + new Date(reportData.generated_at).toLocaleDateString() + "\n\n";
    
    // Add summary data
    csvContent += "EXECUTIVE SUMMARY\n";
    csvContent += "Total Incidents," + reportData.executive_summary.total_incidents + "\n";
    csvContent += "Lost Time Injuries," + reportData.executive_summary.lost_time_injuries + "\n";
    csvContent += "Near Misses," + reportData.executive_summary.near_misses + "\n";
    csvContent += "First Aid Cases," + reportData.executive_summary.first_aid_cases + "\n\n";
    
    // Add hotspots
    csvContent += "SAFETY HOTSPOTS\n";
    csvContent += "Location,Incident Count,Primary Types,Severity,Recommendation\n";
    reportData.safety_hotspots.forEach(hotspot => {
      csvContent += `"${hotspot.location}",${hotspot.incident_count},"${hotspot.types.join(';')}",${hotspot.severity},"${hotspot.recommendation}"\n`;
    });
    
    csvContent += "\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return { success: true, format: 'csv', message: 'CSV report downloaded' };
  }

  async exportAsPDF(htmlContent, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add title
    doc.setFontSize(20);
    doc.text('MMS Safety Report', 20, 20);
    doc.setFontSize(12);
    doc.text(title, 20, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Add content (simplified - production would parse HTML better)
    doc.setFontSize(10);
    const lines = htmlContent
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Collapse whitespace
      .split(' ');
    
    let y = 50;
    let line = '';
    
    for (const word of lines) {
      if (doc.getTextWidth(line + ' ' + word) < 170) {
        line += (line ? ' ' : '') + word;
      } else {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
        line = word;
      }
    }
    
    if (line && y <= 270) {
      doc.text(line, 20, y);
    }
    
    // Save PDF
    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    return { success: true, format: 'pdf', message: 'PDF report generated' };
  }
}

// Initialize and export
const safetyReports = new SafetyReportingDashboard();
window.safetyReports = safetyReports;

console.log('✅ Safety Reporting Dashboard Ready');
