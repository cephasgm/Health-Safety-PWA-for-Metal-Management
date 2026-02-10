// Emergency Procedures Wizard
class EmergencyWizard {
  constructor() {
    this.procedures = {
      'fire': {
        title: 'Fire Emergency',
        steps: [
          'Raise the alarm immediately',
          'Evacuate the area using nearest exit',
          'Do not use elevators',
          'Assemble at designated assembly point',
          'Report to safety officer for headcount'
        ],
        contacts: ['Fire Department: 10177', 'Safety Officer', 'First Aider'],
        equipment: ['Fire extinguishers', 'Emergency exits', 'Assembly points']
      },
      'medical': {
        title: 'Medical Emergency',
        steps: [
          'Call First Aider immediately',
          'Do not move injured person unless in danger',
          'Apply first aid if trained',
          'Clear area for emergency services',
          'Complete incident report'
        ],
        contacts: ['Ambulance: 10177', 'First Aider', 'Safety Officer'],
        equipment: ['First aid kits', 'AED if available', 'Emergency blankets']
      },
      'chemical': {
        title: 'Chemical Spill',
        steps: [
          'Evacuate immediate area',
          'Identify chemical from MSDS',
          'Use appropriate PPE',
          'Contain spill if trained',
          'Notify safety officer'
        ],
        contacts: ['Safety Officer', 'Hazmat Team', 'Emergency Services'],
        equipment: ['Spill kits', 'PPE', 'MSDS sheets', 'Decontamination area']
      }
    };
  }

  showWizard(emergencyType) {
    const procedure = this.procedures[emergencyType] || this.procedures.fire;
    
    return `
      <div class="emergency-modal">
        <div class="emergency-header" style="background: #dc2626; color: white; padding: 1.5rem;">
          <h2 style="margin: 0;">🚨 ${procedure.title}</h2>
          <div style="font-size: 0.9rem; opacity: 0.9;">Follow these steps carefully</div>
        </div>
        
        <div style="padding: 1.5rem;">
          <h3 style="color: #dc2626; margin-bottom: 1rem;">📋 Emergency Steps:</h3>
          <ol style="margin-left: 1.5rem; margin-bottom: 1.5rem;">
            ${procedure.steps.map((step, i) => 
              `<li style="margin-bottom: 0.5rem;">${step}</li>`
            ).join('')}
          </ol>
          
          <h3 style="color: #dc2626; margin-bottom: 1rem;">📞 Emergency Contacts:</h3>
          <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            ${procedure.contacts.map(contact => 
              `<div style="margin-bottom: 0.5rem;">• ${contact}</div>`
            ).join('')}
          </div>
          
          <h3 style="color: #dc2626; margin-bottom: 1rem;">🛡️ Required Equipment:</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
            ${procedure.equipment.map(item => 
              `<span style="background: #fee2e2; color: #991b1b; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">${item}</span>`
            ).join('')}
          </div>
          
          <div style="display: flex; gap: 1rem;">
            <button class="btn btn-primary" onclick="startEmergencyTimer()">
              ⏱️ Start Emergency Timer
            </button>
            <button class="btn btn-outline" onclick="closeEmergencyModal()">
              ✅ Emergency Resolved
            </button>
          </div>
        </div>
      </div>
    `;
  }

  startEmergencyTimer() {
    const startTime = new Date();
    const timerInterval = setInterval(() => {
      const elapsed = new Date() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      document.getElementById('emergencyTimer').textContent = 
        `⏱️ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
    
    window.emergencyTimer = timerInterval;
  }
}

window.emergencyWizard = new EmergencyWizard();
