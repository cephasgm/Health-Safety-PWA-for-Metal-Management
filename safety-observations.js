// Safety Observations System - MMS Daily Safety Checks
import { mmsDB } from './database-service.js';

class SafetyObservations {
  constructor() {
    this.observationCategories = [
      {
        id: 'housekeeping',
        name: 'Housekeeping',
        items: [
          'Walkways clear and marked',
          'Emergency exits unobstructed',
          'Spills cleaned immediately',
          'Waste disposed properly',
          'Storage areas organized'
        ]
      },
      {
        id: 'ppe',
        name: 'PPE Compliance',
        items: [
          'Safety helmets worn',
          'Safety glasses used',
          'High-visibility vests',
          'Safety boots worn',
          'Hearing protection',
          'Gloves appropriate for task'
        ]
      },
      {
        id: 'equipment',
        name: 'Equipment Safety',
        items: [
          'Guards in place',
          'Emergency stops accessible',
          'Equipment properly maintained',
          'Warning signs visible',
          'Lockout/tagout procedures followed'
        ]
      },
      {
        id: 'chemical',
        name: 'Chemical Safety',
        items: [
          'MSDS available',
          'Proper labeling',
          'Storage conditions correct',
          'Spill kits accessible',
          'Ventilation adequate'
        ]
      },
      {
        id: 'electrical',
        name: 'Electrical Safety',
        items: [
          'Cables protected',
          'No exposed wiring',
          'Circuit breakers labeled',
          'Grounding in place',
          'Electrical panels accessible'
        ]
      },
      {
        id: 'fire',
        name: 'Fire Safety',
        items: [
          'Fire extinguishers charged',
          'Fire extinguishers accessible',
          'Fire alarms tested',
          'Evacuation routes marked',
          'No accumulation of combustibles'
        ]
      },
      {
        id: 'behavior',
        name: 'Safe Work Practices',
        items: [
          'Proper lifting techniques',
          'Tools used correctly',
          'No horseplay',
          'Procedures followed',
          'Adequate supervision'
        ]
      }
    ];
    
    this.observationTypes = [
      { id: 'positive', name: 'Positive Observation', color: '#10b981', icon: '✅' },
      { id: 'improvement', name: 'Area for Improvement', color: '#f59e0b', icon: '⚠️' },
      { id: 'unsafe', name: 'Unsafe Condition', color: '#ef4444', icon: '❌' },
      { id: 'violation', name: 'Policy Violation', color: '#dc2626', icon: '🚫' }
    ];
  }

  // Record new observation
  async recordObservation(observationData) {
    try {
      const observationId = `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const user = window.mmsAuth?.currentUser;
      
      const observation = {
        id: observationId,
        observation_number: `MMS-OBS-${new Date().getFullYear()}-${observationId.split('-')[2]}`,
        
        // Observation details
        category: observationData.category || 'general',
        type: observationData.type || 'improvement',
        location: observationData.location || 'Unknown',
        department: observationData.department || 'Unknown',
        area: observationData.area || 'General Area',
        
        // Description
        title: observationData.title || 'Safety Observation',
        description: observationData.description || '',
        specific_item: observationData.specific_item || '',
        condition_observed: observationData.condition_observed || '',
        
        // Risk assessment
        risk_level: observationData.risk_level || 'low',
        potential_consequence: observationData.potential_consequence || '',
        likelihood: observationData.likelihood || 'unlikely',
        
        // People
        observed_by: user?.email || 'Unknown',
        observed_by_name: observationData.observed_by_name || user?.displayName || '',
        persons_involved: observationData.persons_involved || [],
        
        // Evidence
        photos: observationData.photos || [],
        witnesses: observationData.witnesses || [],
        
        // Action
        immediate_action: observationData.immediate_action || '',
        corrective_action: observationData.corrective_action || '',
        assigned_to: observationData.assigned_to || '',
        due_date: observationData.due_date || null,
        
        // Status
        status: 'open',
        priority: observationData.priority || 'medium',
        
        // Metadata
        observed_date: observationData.observed_date || new Date().toISOString(),
        reported_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Company
        company: 'mms_metal_management',
        company_name: 'Metal Management Solutions',
        
        // Follow-up
        follow_up_required: observationData.follow_up_required || false,
        follow_up_date: observationData.follow_up_date || null,
        closure_date: null,
        closed_by: null
      };
      
      // Save to database
      await this.saveObservationToDB(observation);
      
      // Log the observation
      await mmsDB.logAction('safety_observation_recorded', {
        observation_id: observationId,
        category: observation.category,
        type: observation.type,
        risk_level: observation.risk_level
      });
      
      console.log(`✅ Safety observation recorded: ${observationId}`);
      
      // Show notification for high risk observations
      if (observation.risk_level === 'high' || observation.risk_level === 'critical') {
        this.showHighRiskAlert(observation);
      }
      
      return {
        success: true,
        observation: observation,
        message: 'Safety observation recorded successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to record observation:', error);
      return {
        success: false,
        error: 'Failed to record safety observation'
      };
    }
  }

  // Save observation to database
  async saveObservationToDB(observation) {
    // This would be integrated with your database service
    // For now, we'll use a simplified version
    const observations = JSON.parse(localStorage.getItem('mms_safety_observations') || '[]');
    observations.push(observation);
    localStorage.setItem('mms_safety_observations', JSON.stringify(observations));
    
    return { success: true };
  }

  // Get observations with filters
  async getObservations(filters = {}) {
    try {
      const observations = JSON.parse(localStorage.getItem('mms_safety_observations') || '[]');
      
      // Apply filters
      let filtered = observations;
      
      if (filters.location && filters.location !== 'All') {
        filtered = filtered.filter(o => o.location === filters.location);
      }
      
      if (filters.category && filters.category !== 'All') {
        filtered = filtered.filter(o => o.category === filters.category);
      }
      
      if (filters.type && filters.type !== 'All') {
        filtered = filtered.filter(o => o.type === filters.type);
      }
      
      if (filters.status && filters.status !== 'All') {
        filtered = filtered.filter(o => o.status === filters.status);
      }
      
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        filtered = filtered.filter(o => {
          const obsDate = new Date(o.observed_date);
          return obsDate >= start && obsDate <= end;
        });
      }
      
      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.observed_date) - new Date(a.observed_date));
      
      return {
        success: true,
        data: filtered,
        count: filtered.length,
        filters: filters
      };
      
    } catch (error) {
      console.error('❌ Failed to get observations:', error);
      return {
        success: false,
        error: 'Failed to load observations',
        data: []
      };
    }
  }

  // Update observation status
  async updateObservationStatus(observationId, status, notes = '') {
    try {
      const observations = JSON.parse(localStorage.getItem('mms_safety_observations') || '[]');
      const index = observations.findIndex(o => o.id === observationId);
      
      if (index === -1) {
        throw new Error('Observation not found');
      }
      
      observations[index].status = status;
      observations[index].updated_at = new Date().toISOString();
      
      if (status === 'closed') {
        observations[index].closure_date = new Date().toISOString();
        observations[index].closed_by = window.mmsAuth?.currentUser?.email;
      }
      
      if (notes) {
        observations[index].closure_notes = notes;
      }
      
      localStorage.setItem('mms_safety_observations', JSON.stringify(observations));
      
      await mmsDB.logAction('observation_status_updated', {
        observation_id: observationId,
        old_status: observations[index].status,
        new_status: status,
        updated_by: window.mmsAuth?.currentUser?.email
      });
      
      return {
        success: true,
        observation: observations[index],
        message: `Observation marked as ${status}`
      };
      
    } catch (error) {
      console.error('❌ Failed to update observation:', error);
      return {
        success: false,
        error: 'Failed to update observation status'
      };
    }
  }

  // Assign observation for action
  async assignObservation(observationId, assignTo, dueDate) {
    try {
      const observations = JSON.parse(localStorage.getItem('mms_safety_observations') || '[]');
      const index = observations.findIndex(o => o.id === observationId);
      
      if (index === -1) {
        throw new Error('Observation not found');
      }
      
      observations[index].assigned_to = assignTo;
      observations[index].due_date = dueDate;
      observations[index].status = 'assigned';
      observations[index].updated_at = new Date().toISOString();
      
      localStorage.setItem('mms_safety_observations', JSON.stringify(observations));
      
      return {
        success: true,
        observation: observations[index],
        message: `Observation assigned to ${assignTo}`
      };
      
    } catch (error) {
      console.error('❌ Failed to assign observation:', error);
      return {
        success: false,
        error: 'Failed to assign observation'
      };
    }
  }

  // Generate daily observation checklist
  generateDailyChecklist(location) {
    const checklist = {
      id: `CHK-${Date.now()}`,
      location: location,
      date: new Date().toISOString().split('T')[0],
      created_by: window.mmsAuth?.currentUser?.email,
      created_at: new Date().toISOString(),
      items: []
    };
    
    // Add items from all categories
    this.observationCategories.forEach(category => {
      category.items.forEach(item => {
        checklist.items.push({
          category: category.id,
          category_name: category.name,
          item: item,
          status: 'pending',
          notes: '',
          timestamp: null,
          photos: []
        });
      });
    });
    
    return checklist;
  }

  // Get observation statistics
  async getObservationStats(timeframe = 'month') {
    try {
      const observations = JSON.parse(localStorage.getItem('mms_safety_observations') || '[]');
      
      // Filter by timeframe
      const now = new Date();
      let startDate;
      
      switch(timeframe) {
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'quarter':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setMonth(now.getMonth() - 1));
      }
      
      const filtered = observations.filter(o => new Date(o.observed_date) >= startDate);
      
      // Calculate statistics
      const stats = {
        total: filtered.length,
        by_category: {},
        by_type: {},
        by_status: {},
        by_risk: {},
        by_location: {},
        trends: this.calculateTrends(filtered),
        top_issues: this.getTopIssues(filtered),
        compliance_rate: this.calculateComplianceRate(filtered)
      };
      
      // Populate counts
      filtered.forEach(obs => {
        // By category
        stats.by_category[obs.category] = (stats.by_category[obs.category] || 0) + 1;
        
        // By type
        stats.by_type[obs.type] = (stats.by_type[obs.type] || 0) + 1;
        
        // By status
        stats.by_status[obs.status] = (stats.by_status[obs.status] || 0) + 1;
        
        // By risk
        stats.by_risk[obs.risk_level] = (stats.by_risk[obs.risk_level] || 0) + 1;
        
        // By location
        stats.by_location[obs.location] = (stats.by_location[obs.location] || 0) + 1;
      });
      
      return {
        success: true,
        stats: stats,
        timeframe: timeframe,
        period: `${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
        observation_count: filtered.length
      };
      
    } catch (error) {
      console.error('❌ Failed to get observation stats:', error);
      return {
        success: false,
        stats: {},
        error: 'Failed to calculate statistics'
      };
    }
  }

  // Calculate trends
  calculateTrends(observations) {
    const trends = {
      daily_average: 0,
      weekly_average: 0,
      monthly_average: 0,
      improvement_rate: 0,
      closure_rate: 0
    };
    
    if (observations.length === 0) return trends;
    
    // Group by date
    const byDate = {};
    observations.forEach(obs => {
      const date = obs.observed_date.split('T')[0];
      byDate[date] = (byDate[date] || 0) + 1;
    });
    
    const dates = Object.keys(byDate);
    const totalDays = dates.length;
    
    if (totalDays > 0) {
      trends.daily_average = observations.length / totalDays;
      trends.weekly_average = trends.daily_average * 7;
      trends.monthly_average = trends.daily_average * 30;
    }
    
    // Calculate closure rate
    const closed = observations.filter(o => o.status === 'closed').length;
    trends.closure_rate = observations.length > 0 ? Math.round((closed / observations.length) * 100) : 0;
    
    return trends;
  }

  // Get top recurring issues
  getTopIssues(observations, limit = 5) {
    const issueCounts = {};
    
    observations.forEach(obs => {
      const key = `${obs.category}:${obs.specific_item || obs.title}`;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    });
    
    // Convert to array and sort
    const issues = Object.entries(issueCounts)
      .map(([key, count]) => {
        const [category, item] = key.split(':');
        return { category, item, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return issues;
  }

  // Calculate compliance rate
  calculateComplianceRate(observations) {
    if (observations.length === 0) return 100;
    
    const positive = observations.filter(o => o.type === 'positive').length;
    const negative = observations.filter(o => o.type !== 'positive').length;
    
    // Compliance rate = positive / (positive + negative) * 100
    const rate = Math.round((positive / (positive + negative)) * 100);
    
    return isNaN(rate) ? 100 : rate;
  }

  // Show high risk alert
  showHighRiskAlert(observation) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);
      z-index: 10001;
      animation: slideInRight 0.5s ease;
      max-width: 400px;
      border-left: 6px solid #fee2e2;
    `;
    
    alertDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="font-size: 1.5rem;">🚨</div>
        <div style="font-weight: bold; font-size: 1.1rem;">High Risk Safety Observation</div>
      </div>
      <div style="font-size: 0.95rem; margin-bottom: 8px;">
        <strong>${observation.title}</strong>
      </div>
      <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 12px;">
        Location: ${observation.location} • Risk: ${observation.risk_level.toUpperCase()}
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.3s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
        onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        Acknowledged
      </button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.style.animation = 'slideOutRight 0.5s ease forwards';
        setTimeout(() => alertDiv.remove(), 500);
      }
    }, 30000);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Quick observation (mobile-friendly)
  quickObservation(category, type, location) {
    return {
      category: category,
      type: type,
      location: location,
      title: `${type === 'positive' ? 'Good catch' : 'Safety concern'} in ${category}`,
      description: '',
      observed_date: new Date().toISOString(),
      risk_level: type === 'positive' ? 'low' : 'medium',
      status: 'open'
    };
  }
}

// Create and export instance
const safetyObservations = new SafetyObservations();
window.safetyObservations = safetyObservations;

// Global function for quick observations
window.recordQuickObservation = async function(category, type, location) {
  const observation = safetyObservations.quickObservation(category, type, location);
  const result = await safetyObservations.recordObservation(observation);
  
  if (result.success) {
    alert(`✅ ${type === 'positive' ? 'Positive observation' : 'Safety concern'} recorded!`);
  } else {
    alert(`❌ Failed to record observation: ${result.error}`);
  }
};

console.log('✅ Safety Observations System Ready');
