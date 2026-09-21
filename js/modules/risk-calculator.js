// Risk Assessment Calculator
class RiskCalculator {
  constructor() {
    this.likelihoodLevels = {
      1: { label: 'Rare', description: 'May occur only in exceptional circumstances' },
      2: { label: 'Unlikely', description: 'Could occur at some time' },
      3: { label: 'Possible', description: 'Might occur at some time' },
      4: { label: 'Likely', description: 'Will probably occur in most circumstances' },
      5: { label: 'Almost Certain', description: 'Expected to occur in most circumstances' }
    };
    
    this.consequenceLevels = {
      1: { label: 'Insignificant', description: 'No injuries, low financial loss' },
      2: { label: 'Minor', description: 'First aid injury, medium financial loss' },
      3: { label: 'Moderate', description: 'Medical treatment injury, high financial loss' },
      4: { label: 'Major', description: 'Serious injury, major financial loss' },
      5: { label: 'Catastrophic', description: 'Death, huge financial loss' }
    };
    
    this.riskMatrix = {
      1: { 1: 'Low', 2: 'Low', 3: 'Medium', 4: 'Medium', 5: 'High' },
      2: { 1: 'Low', 2: 'Medium', 3: 'Medium', 4: 'High', 5: 'High' },
      3: { 1: 'Medium', 2: 'Medium', 3: 'High', 4: 'High', 5: 'Extreme' },
      4: { 1: 'Medium', 2: 'High', 3: 'High', 4: 'Extreme', 5: 'Extreme' },
      5: { 1: 'High', 2: 'High', 3: 'Extreme', 4: 'Extreme', 5: 'Extreme' }
    };
  }

  calculateRisk(likelihood, consequence) {
    const riskLevel = this.riskMatrix[likelihood]?.[consequence] || 'Unknown';
    const riskScore = likelihood * consequence;
    
    return {
      level: riskLevel,
      score: riskScore,
      likelihood: this.likelihoodLevels[likelihood],
      consequence: this.consequenceLevels[consequence],
      color: this.getRiskColor(riskLevel),
      actions: this.getRecommendedActions(riskLevel)
    };
  }

  getRiskColor(riskLevel) {
    const colors = {
      'Low': '#10b981',
      'Medium': '#f59e0b',
      'High': '#ef4444',
      'Extreme': '#991b1b'
    };
    return colors[riskLevel] || '#6b7280';
  }

  getRecommendedActions(riskLevel) {
    const actions = {
      'Low': [
        'Monitor through routine procedures',
        'Maintain existing controls',
        'Review annually'
      ],
      'Medium': [
        'Specific monitoring required',
        'Assign responsibility for control',
        'Review every 6 months',
        'Consider additional controls'
      ],
      'High': [
        'Immediate action required',
        'Senior management attention needed',
        'Detailed control implementation',
        'Review every 3 months',
        'Stop work if necessary'
      ],
      'Extreme': [
        'STOP WORK IMMEDIATELY',
        'Highest management priority',
        'Immediate risk treatment required',
        'Daily monitoring until resolved',
        'Formal investigation required'
      ]
    };
    return actions[riskLevel] || [];
  }

  generateAssessmentForm() {
    return `
      <div class="risk-assessment">
        <h3>📊 Risk Assessment Calculator</h3>
        
        <div class="form-group">
          <label>Hazard Description</label>
          <textarea id="hazardDescription" rows="3" placeholder="Describe the hazard..."></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Likelihood of Occurrence</label>
            <select id="likelihoodScore" onchange="updateRiskPreview()">
              <option value="">Select likelihood</option>
              ${Object.entries(this.likelihoodLevels).map(([score, info]) => `
                <option value="${score}">${score} - ${info.label}</option>
              `).join('')}
            </select>
            <div id="likelihoodDescription" style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;"></div>
          </div>
          
          <div class="form-group">
            <label>Consequence Severity</label>
            <select id="consequenceScore" onchange="updateRiskPreview()">
              <option value="">Select consequence</option>
              ${Object.entries(this.consequenceLevels).map(([score, info]) => `
                <option value="${score}">${score} - ${info.label}</option>
              `).join('')}
            </select>
            <div id="consequenceDescription" style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;"></div>
          </div>
        </div>
        
        <div id="riskResult" style="display: none; margin: 1.5rem 0; padding: 1.5rem; border-radius: 8px;">
          <h4>Risk Assessment Result</h4>
          <div style="display: flex; align-items: center; gap: 1rem; margin: 1rem 0;">
            <div id="riskLevel" style="font-size: 1.5rem; font-weight: bold; padding: 0.5rem 1rem; border-radius: 6px;"></div>
            <div>
              <div>Risk Score: <span id="riskScore" style="font-weight: bold;"></span></div>
              <div>Likelihood × Consequence</div>
            </div>
          </div>
          
          <h5>Recommended Actions:</h5>
          <ul id="recommendedActions" style="margin-left: 1.5rem;"></ul>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button class="btn btn-primary" onclick="saveRiskAssessment()">
            💾 Save Assessment
          </button>
          <button class="btn btn-outline" onclick="resetCalculator()">
            🔄 Reset
          </button>
        </div>
      </div>
    `;
  }
}

window.riskCalculator = new RiskCalculator();
window.updateRiskPreview = function() {
  const likelihood = parseInt(document.getElementById('likelihoodScore')?.value);
  const consequence = parseInt(document.getElementById('consequenceScore')?.value);
  
  if (likelihood && consequence) {
    const result = window.riskCalculator.calculateRisk(likelihood, consequence);
    
    document.getElementById('riskLevel').textContent = result.level;
    document.getElementById('riskLevel').style.background = result.color;
    document.getElementById('riskLevel').style.color = 'white';
    
    document.getElementById('riskScore').textContent = result.score;
    
    const actionsList = document.getElementById('recommendedActions');
    actionsList.innerHTML = result.actions.map(action => 
      `<li style="margin-bottom: 0.5rem;">${action}</li>`
    ).join('');
    
    document.getElementById('riskResult').style.display = 'block';
  }
};
