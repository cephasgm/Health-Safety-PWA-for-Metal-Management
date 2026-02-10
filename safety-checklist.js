// Safety Checklist System
class SafetyChecklist {
  constructor() {
    this.checklists = {
      'daily_inspection': {
        title: 'Daily Safety Inspection',
        items: [
          { id: 'floor', text: 'Floor clear of obstructions and spills', required: true },
          { id: 'exits', text: 'Emergency exits clear and accessible', required: true },
          { id: 'fire', text: 'Fire extinguishers charged and accessible', required: true },
          { id: 'ppe', text: 'PPE available and in good condition', required: true },
          { id: 'machinery', text: 'Machinery guards in place', required: false },
          { id: 'lighting', text: 'Adequate lighting in all areas', required: false },
          { id: 'signage', text: 'Safety signage visible and legible', required: true }
        ]
      },
      'ppe_inspection': {
        title: 'PPE Inspection Checklist',
        items: [
          { id: 'helmet', text: 'Safety helmets: No cracks, straps intact', required: true },
          { id: 'gloves', text: 'Gloves: Appropriate type, no tears', required: true },
          { id: 'boots', text: 'Safety boots: Steel toe intact, good tread', required: true },
          { id: 'glasses', text: 'Safety glasses: No scratches, proper fit', required: true },
          { id: 'harness', text: 'Harnesses: No fraying, buckles working', required: false }
        ]
      }
    };
  }

  generateChecklist(type) {
    const checklist = this.checklists[type];
    if (!checklist) return '';
    
    return `
      <div class="checklist-container">
        <h3>${checklist.title}</h3>
        <div style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.9rem;">
          Location: <span id="checklistLocation">${window.mmsAuth?.userLocation || 'Select location'}</span>
          • Inspector: <span id="checklistInspector">${window.mmsAuth?.currentUser?.email || 'Unknown'}</span>
        </div>
        
        <form id="safetyChecklistForm">
          ${checklist.items.map((item, index) => `
            <div class="checklist-item" style="display: flex; align-items: start; margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
              <div style="margin-right: 1rem; font-weight: bold; color: #64748b;">${index + 1}.</div>
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 0.5rem;">${item.text}</div>
                <div style="display: flex; gap: 1rem;">
                  <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="radio" name="${item.id}" value="compliant" required>
                    <span style="color: #10b981;">✅ Compliant</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="radio" name="${item.id}" value="non_compliant">
                    <span style="color: #ef4444;">❌ Non-Compliant</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="radio" name="${item.id}" value="not_applicable">
                    <span style="color: #6b7280;">➖ N/A</span>
                  </label>
                </div>
                <div style="margin-top: 0.5rem;">
                  <input type="text" placeholder="Comments/actions required" 
                         style="width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.9rem;">
                </div>
              </div>
              ${item.required ? '<span style="color: #ef4444; font-size: 0.8rem; margin-left: 1rem;">*Required</span>' : ''}
            </div>
          `).join('')}
          
          <div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #e2e8f0;">
            <div class="form-group">
              <label>Overall Assessment</label>
              <select class="form-control" required>
                <option value="">Select assessment</option>
                <option value="safe">✅ Safe to Operate</option>
                <option value="minor_issues">⚠️ Minor Issues - Monitor</option>
                <option value="major_issues">🚨 Major Issues - Stop Work</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Recommendations</label>
              <textarea class="form-control" rows="3" placeholder="Enter recommendations..."></textarea>
            </div>
            
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="submit" class="btn btn-primary">
                💾 Save Checklist
              </button>
              <button type="button" class="btn btn-outline" onclick="generateChecklistPDF()">
                📄 Export PDF
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}

window.safetyChecklist = new SafetyChecklist();
