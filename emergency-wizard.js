// Emergency Procedures Wizard - MMS Safety
class EmergencyWizard {
  constructor() {
    this.emergencyTypes = {
      'fire': {
        title: '🔥 Fire Emergency',
        steps: [
          '1. 🔥 RAISE ALARM - Activate nearest fire alarm',
          '2. 📞 CALL EMERGENCY - Dial 112 (SA) / 999 (TZ/ZM/NA)',
          '3. 🚪 EVACUATE - Use nearest emergency exit',
          '4. 🧯 EXTINGUISH - Only if trained and safe',
          '5. 🏃 ASSEMBLE - Go to designated assembly point',
          '6. 📋 ROLL CALL - Report to safety officer'
        ],
        contacts: ['Fire Department', 'Safety Officer', 'First Aider'],
        equipment: ['Fire extinguisher', 'Fire blanket', 'First aid kit']
      },
      'medical': {
        title: '🏥 Medical Emergency',
        steps: [
          '1. 🚨 ASSESS SCENE - Ensure safety first',
          '2. 📞 CALL FOR HELP - Dial emergency number',
          '3. 👤 CHECK RESPONSE - Tap and shout "Are you OK?"',
          '4. 🩹 PROVIDE FIRST AID - Use available equipment',
          '5. 🧭 STAY CALM - Follow trained procedures',
          '6. 📞 NOTIFY MANAGEMENT - Inform safety officer'
        ],
        contacts: ['Ambulance', 'Company Nurse', 'First Aider'],
        equipment: ['First aid kit', 'AED', 'Stretcher']
      },
      'chemical': {
        title: '🧪 Chemical Spill',
        steps: [
          '1. 🚨 RAISE ALARM - Warn others immediately',
          '2. 🏃 EVACUATE AREA - Move to safe distance',
          '3. 📞 CALL EMERGENCY - Report chemical type',
          '4. 🛡️ USE PPE - Don appropriate protective gear',
          '5. 🧽 CONTAIN SPILL - Use spill kit if trained',
          '6. 📋 REPORT INCIDENT - Complete incident report'
        ],
        contacts: ['Hazmat Team', 'Safety Officer', 'Environmental'],
        equipment: ['Spill kit', 'PPE', 'Eye wash station']
      },
      'structural': {
        title: '🏗️ Structural Collapse',
        steps: [
          '1. 🚨 RAISE ALARM - Alert all personnel',
          '2. 📞 CALL RESCUE - Dial emergency services',
          '3. 🛑 SECURE AREA - Prevent access',
          '4. 👤 ACCOUNT FOR ALL - Headcount at assembly',
          '5. 🏃 DO NOT RE-ENTER - Wait for professionals',
          '6. 📋 REPORT DETAILS - Provide information'
        ],
        contacts: ['Rescue Services', 'Structural Engineer', 'Management'],
        equipment: ['Hard hats', 'Safety cones', 'Communication radio']
      },
      'electrical': {
        title: '⚡ Electrical Emergency',
        steps: [
          '1. 🔌 ISOLATE POWER - Turn off at main switch',
          '2. 🚨 DO NOT TOUCH - Keep safe distance',
          '3. 📞 CALL ELECTRICIAN - Qualified personnel only',
          '4. 🏃 EVACUATE AREA - Clear immediate vicinity',
          '5. ⚠️ POST WARNINGS - Mark dangerous area',
          '6. 📋 REPORT INCIDENT - Document details'
        ],
        contacts: ['Electrician', 'Safety Officer', 'Maintenance'],
        equipment: ['Insulated gloves', 'Warning signs', 'Voltage tester']
      }
    };
    
    this.init();
  }

  init() {
    console.log('🚨 Emergency Wizard Initialized');
  }

  getEmergencyProcedure(type) {
    const procedure = this.emergencyTypes[type] || this.emergencyTypes.fire;
    
    return {
      ...procedure,
      timestamp: new Date().toISOString(),
      generated_by: window.mmsAuth?.currentUser?.email || 'System',
      location: window.mmsAuth?.userLocation || 'Unknown'
    };
  }

  generateEmergencyCard(type) {
    const procedure = this.getEmergencyProcedure(type);
    
    return `
      <div class="emergency-card" data-type="${type}" style="
        background: linear-gradient(135deg, #fee2e2, #fecaca);
        border: 2px solid #ef4444;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        animation: fadeIn 0.5s ease;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
          <div style="
            width: 50px;
            height: 50px;
            background: #ef4444;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            margin-right: 1rem;
          ">${this.getEmergencyIcon(type)}</div>
          <div>
            <h3 style="color: #991b1b; margin: 0; font-size: 1.25rem;">${procedure.title}</h3>
            <div style="color: #dc2626; font-size: 0.875rem;">Generated: ${new Date().toLocaleTimeString()}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: #991b1b; margin-bottom: 0.75rem; font-size: 1rem;">📋 Emergency Steps:</h4>
          <ol style="margin: 0; padding-left: 1.5rem; color: #7f1d1d;">
            ${procedure.steps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
          </ol>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h4 style="color: #991b1b; margin-bottom: 0.5rem; font-size: 1rem;">📞 Emergency Contacts:</h4>
            <ul style="margin: 0; padding-left: 1rem; color: #7f1d1d;">
              ${procedure.contacts.map(contact => `<li style="margin-bottom: 0.25rem;">${contact}</li>`).join('')}
            </ul>
          </div>
          <div>
            <h4 style="color: #991b1b; margin-bottom: 0.5rem; font-size: 1rem;">🛠️ Required Equipment:</h4>
            <ul style="margin: 0; padding-left: 1rem; color: #7f1d1d;">
              ${procedure.equipment.map(equip => `<li style="margin-bottom: 0.25rem;">${equip}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button onclick="window.emergencyWizard.printProcedure('${type}')" style="
            padding: 0.5rem 1rem;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            flex: 1;
          ">🖨️ Print Procedure</button>
          <button onclick="window.emergencyWizard.startDrill('${type}')" style="
            padding: 0.5rem 1rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            flex: 1;
          ">🏃 Start Drill</button>
        </div>
      </div>
    `;
  }

  getEmergencyIcon(type) {
    const icons = {
      'fire': '🔥',
      'medical': '🏥',
      'chemical': '🧪',
      'structural': '🏗️',
      'electrical': '⚡'
    };
    return icons[type] || '🚨';
  }

  printProcedure(type) {
    const procedure = this.getEmergencyProcedure(type);
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>MMS Emergency Procedure - ${procedure.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 2rem; }
            .header { text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #dc2626; padding-bottom: 1rem; }
            .steps { margin: 2rem 0; }
            .contacts { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
            .footer { margin-top: 3rem; font-size: 0.8rem; color: #666; border-top: 1px solid #ccc; padding-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="color: #dc2626;">${procedure.title}</h1>
            <p><strong>Metal Management Solutions</strong></p>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Location: ${procedure.location}</p>
          </div>
          
          <div class="steps">
            <h2>Emergency Response Steps</h2>
            <ol>
              ${procedure.steps.map(step => `<li>${step}</li>`).join('')}
            </ol>
          </div>
          
          <div class="contacts">
            <div>
              <h3>Emergency Contacts</h3>
              <ul>
                ${procedure.contacts.map(contact => `<li>${contact}</li>`).join('')}
              </ul>
            </div>
            <div>
              <h3>Required Equipment</h3>
              <ul>
                ${procedure.equipment.map(equip => `<li>${equip}</li>`).join('')}
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Important:</strong> Follow these procedures in case of emergency.</p>
            <p>Review and update procedures annually. Last reviewed: ${new Date().toLocaleDateString()}</p>
            <p>Generated by: ${procedure.generated_by}</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  }

  startDrill(type) {
    const procedure = this.getEmergencyProcedure(type);
    
    if (confirm(`Start ${procedure.title} drill?\n\nThis will simulate an emergency scenario for training.`)) {
      // Log drill start
      if (window.mmsDB) {
        window.mmsDB.logAction('emergency_drill_started', {
          drill_type: type,
          procedure: procedure.title
        });
      }
      
      // Show drill interface
      this.showDrillInterface(type, procedure);
    }
  }

  showDrillInterface(type, procedure) {
    const modal = document.createElement('div');
    modal.id = 'emergencyDrillModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    `;
    
    let currentStep = 0;
    
    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 2rem;
        width: 90%;
        max-width: 500px;
        text-align: center;
        border-top: 8px solid #ef4444;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      ">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getEmergencyIcon(type)}</div>
        <h2 style="color: #dc2626; margin-bottom: 0.5rem;">EMERGENCY DRILL</h2>
        <h3 style="color: #1e293b; margin-bottom: 1.5rem;">${procedure.title}</h3>
        
        <div id="drillStep" style="
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 10px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          font-size: 1.1rem;
          color: #7f1d1d;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${procedure.steps[currentStep]}
        </div>
        
        <div style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.9rem;">
          Step ${currentStep + 1} of ${procedure.steps.length}
        </div>
        
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button id="prevStep" onclick="window.emergencyWizard.prevDrillStep()" style="
            padding: 0.75rem 1.5rem;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
          " disabled>⬅ Previous</button>
          
          <button id="nextStep" onclick="window.emergencyWizard.nextDrillStep()" style="
            padding: 0.75rem 1.5rem;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
          ">Next ➡</button>
          
          <button onclick="window.emergencyWizard.endDrill()" style="
            padding: 0.75rem 1.5rem;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
          ">End Drill</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store drill state
    this.drillState = { type, procedure, currentStep };
  }

  nextDrillStep() {
    if (this.drillState && this.drillState.currentStep < this.drillState.procedure.steps.length - 1) {
      this.drillState.currentStep++;
      this.updateDrillDisplay();
    }
  }

  prevDrillStep() {
    if (this.drillState && this.drillState.currentStep > 0) {
      this.drillState.currentStep--;
      this.updateDrillDisplay();
    }
  }

  updateDrillDisplay() {
    const stepElement = document.getElementById('drillStep');
    const stepCounter = document.querySelector('#emergencyDrillModal div:nth-child(4)');
    const prevButton = document.getElementById('prevStep');
    const nextButton = document.getElementById('nextStep');
    
    if (stepElement && this.drillState) {
      stepElement.textContent = this.drillState.procedure.steps[this.drillState.currentStep];
      
      if (stepCounter) {
        stepCounter.textContent = `Step ${this.drillState.currentStep + 1} of ${this.drillState.procedure.steps.length}`;
      }
      
      if (prevButton) {
        prevButton.disabled = this.drillState.currentStep === 0;
      }
      
      if (nextButton) {
        nextButton.textContent = this.drillState.currentStep === this.drillState.procedure.steps.length - 1 ? 'Complete ✓' : 'Next ➡';
        nextButton.style.background = this.drillState.currentStep === this.drillState.procedure.steps.length - 1 ? '#10b981' : '#3b82f6';
      }
    }
  }

  endDrill() {
    const modal = document.getElementById('emergencyDrillModal');
    if (modal) modal.remove();
    
    // Log drill completion
    if (window.mmsDB && this.drillState) {
      window.mmsDB.logAction('emergency_drill_completed', {
        drill_type: this.drillState.type,
        steps_completed: this.drillState.currentStep + 1,
        total_steps: this.drillState.procedure.steps.length
      });
    }
    
    alert('✅ Emergency drill completed!\n\nDrill data has been logged for training records.');
    this.drillState = null;
  }

  getEmergencyTypes() {
    return Object.keys(this.emergencyTypes).map(key => ({
      id: key,
      title: this.emergencyTypes[key].title,
      icon: this.getEmergencyIcon(key)
    }));
  }

  async logEmergencyResponse(type, responseTime, effectiveness) {
    if (window.mmsDB) {
      return await window.mmsDB.logAction('emergency_response', {
        emergency_type: type,
        response_time_seconds: responseTime,
        effectiveness_rating: effectiveness,
        responded_by: window.mmsAuth?.currentUser?.email,
        location: window.mmsAuth?.userLocation
      });
    }
    return false;
  }
}

// Initialize and export
const emergencyWizard = new EmergencyWizard();
window.emergencyWizard = emergencyWizard;
console.log('✅ Emergency Wizard Ready');
