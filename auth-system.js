// Production Authentication System - MMS Safety
import { auth, analytics } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

class MMSAuthSystem {
  constructor() {
    this.currentUser = null;
    this.userRole = 'guest';
    this.userLocation = 'unknown';
    this.userPermissions = {};
    this.init();
  }

  init() {
    console.log('🔐 MMS Auth System Initializing...');
    
    // Track auth state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.analyzeUserProfile(user);
        this.setupUserPermissions();
        console.log(`✅ Authenticated: ${user.email} as ${this.userRole}`);
        this.showApplication();
        this.trackLogin('success');
      } else {
        this.currentUser = null;
        this.userRole = 'guest';
        this.userPermissions = {};
        console.log('⚠️ User logged out');
        this.showLogin();
        this.trackLogin('logout');
      }
    });
  }

  analyzeUserProfile(user) {
    const email = user.email.toLowerCase();
    
    // Extract role from email
    if (email.includes('admin') || email.includes('administrator')) {
      this.userRole = 'admin';
    } else if (email.includes('safety') || email.includes('officer')) {
      this.userRole = 'safety_officer';
    } else if (email.includes('manager') || email.includes('supervisor')) {
      this.userRole = 'manager';
    } else if (email.includes('employee') || email.includes('staff')) {
      this.userRole = 'employee';
    } else {
      this.userRole = 'employee'; // Default role
    }
    
    // Extract location from email
    if (email.includes('za') || email.includes('southafrica') || email.includes('sa')) {
      this.userLocation = 'South Africa';
    } else if (email.includes('tz') || email.includes('tanzania')) {
      this.userLocation = 'Tanzania';
    } else if (email.includes('zm') || email.includes('zambia')) {
      this.userLocation = 'Zambia';
    } else if (email.includes('na') || email.includes('namibia')) {
      this.userLocation = 'Namibia';
    } else {
      this.userLocation = 'Unknown';
    }
    
    console.log(`📍 User ${email} identified as ${this.userRole} from ${this.userLocation}`);
  }

  setupUserPermissions() {
    // Define permission levels for each role
    const permissions = {
      'admin': {
        canViewDashboard: true,
        canReportIncidents: true,
        canEditIncidents: true,
        canDeleteRecords: true,
        canManageUsers: true,
        canViewHealthRecords: true,
        canExportData: true,
        canManageSettings: true,
        canMigrateData: true,
        canViewAuditLogs: true,
        modules: ['all']
      },
      'safety_officer': {
        canViewDashboard: true,
        canReportIncidents: true,
        canEditIncidents: true,
        canDeleteRecords: false,
        canManageUsers: false,
        canViewHealthRecords: true,
        canExportData: true,
        canManageSettings: false,
        canMigrateData: false,
        canViewAuditLogs: false,
        modules: ['incidents', 'training', 'ppe', 'audits', 'observations', 'equipment']
      },
      'manager': {
        canViewDashboard: true,
        canReportIncidents: true,
        canEditIncidents: false,
        canDeleteRecords: false,
        canManageUsers: false,
        canViewHealthRecords: false,
        canExportData: true,
        canManageSettings: false,
        canMigrateData: false,
        canViewAuditLogs: false,
        modules: ['incidents', 'training', 'reports']
      },
      'employee': {
        canViewDashboard: true,
        canReportIncidents: true,
        canEditIncidents: false,
        canDeleteRecords: false,
        canManageUsers: false,
        canViewHealthRecords: false,
        canExportData: false,
        canManageSettings: false,
        canMigrateData: false,
        canViewAuditLogs: false,
        modules: ['incidents', 'checklists']
      },
      'guest': {
        canViewDashboard: false,
        canReportIncidents: false,
        canEditIncidents: false,
        canDeleteRecords: false,
        canManageUsers: false,
        canViewHealthRecords: false,
        canExportData: false,
        canManageSettings: false,
        canMigrateData: false,
        canViewAuditLogs: false,
        modules: []
      }
    };

    this.userPermissions = permissions[this.userRole] || permissions['guest'];
    console.log(`🔒 Set permissions for ${this.userRole}:`, this.userPermissions);
  }

  async login(email, password) {
    try {
      console.log(`🔑 Login attempt for: ${email}`);
      
      // Validation
      if (!email || !email.includes('@')) {
        throw new Error('VALIDATION: Invalid email format');
      }
      
      if (!password || password.length < 6) {
        throw new Error('VALIDATION: Password too short');
      }
      
      // Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      console.log(`🎯 Login successful: ${userCredential.user.email}`);
      
      return {
        success: true,
        user: userCredential.user,
        role: this.userRole,
        location: this.userLocation,
        permissions: this.userPermissions,
        message: 'Welcome to MMS Safety System'
      };
      
    } catch (error) {
      console.error('❌ Login failed:', error.code, error.message);
      
      // User-friendly messages
      const errorMap = {
        'auth/invalid-email': 'Please enter a valid email address',
        'auth/user-disabled': 'This account has been disabled. Contact IT.',
        'auth/user-not-found': 'No account found. Contact IT for access.',
        'auth/wrong-password': 'Incorrect password. Try again.',
        'auth/too-many-requests': 'Too many attempts. Try again in 5 minutes.',
        'VALIDATION: Invalid email format': 'Please enter a valid company email',
        'VALIDATION: Password too short': 'Password must be at least 6 characters'
      };
      
      return {
        success: false,
        error: errorMap[error.code] || errorMap[error.message] || 'Login failed. Check credentials.',
        code: error.code
      };
    }
  }

  async logout() {
    try {
      await signOut(auth);
      console.log('🚪 User logged out successfully');
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      loginScreen.style.animation = 'fadeIn 0.5s ease';
    }
    
    if (appContent) {
      appContent.style.display = 'none';
    }
    
    // Clear any previous errors
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }
  }

  showApplication() {
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    
    if (loginScreen) {
      loginScreen.style.display = 'none';
    }
    
    if (appContent) {
      appContent.style.display = 'grid';
      appContent.style.animation = 'fadeIn 0.5s ease';
    }
    
    // Update UI with user info
    this.updateUserInterface();
    
    // Apply role permissions to UI
    this.applyRolePermissions();
  }

  updateUserInterface() {
    // Update email display
    const emailElement = document.getElementById('currentUserEmail');
    if (emailElement && this.currentUser) {
      emailElement.textContent = this.currentUser.email;
      emailElement.title = this.currentUser.email;
    }
    
    // Update role display with badge
    const roleElement = document.getElementById('currentUserRole');
    if (roleElement) {
      const roleNames = {
        'admin': '👑 Administrator',
        'safety_officer': '🛡️ Safety Officer', 
        'manager': '📊 Manager',
        'employee': '👤 Employee',
        'guest': '👤 Guest'
      };
      roleElement.textContent = `${roleNames[this.userRole] || '👤 User'} • ${this.userLocation}`;
      roleElement.style.fontWeight = '600';
      roleElement.style.color = this.getRoleColor(this.userRole);
    }
    
    // Update location-specific data
    this.updateLocationData();
  }

  getRoleColor(role) {
    const colors = {
      'admin': '#dc2626',
      'safety_officer': '#3b82f6', 
      'manager': '#10b981',
      'employee': '#6b7280',
      'guest': '#9ca3af'
    };
    return colors[role] || '#6b7280';
  }

  applyRolePermissions() {
    console.log(`🔒 Applying ${this.userRole} permissions...`);
    
    // Hide all permission-based elements first
    const allPermissionElements = document.querySelectorAll('[data-permission]');
    allPermissionElements.forEach(el => {
      el.style.display = 'none';
      el.classList.add('permission-hidden');
    });
    
    // Show elements based on role
    switch(this.userRole) {
      case 'admin':
        // Admin sees everything
        document.querySelectorAll('[data-permission="admin"], [data-permission="safety_officer"], [data-permission="manager"], [data-permission="employee"]')
          .forEach(el => {
            el.style.display = '';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'safety_officer':
        // Safety officers see their content + manager + employee
        document.querySelectorAll('[data-permission="safety_officer"], [data-permission="manager"], [data-permission="employee"]')
          .forEach(el => {
            el.style.display = '';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'manager':
        // Managers see their content + employee
        document.querySelectorAll('[data-permission="manager"], [data-permission="employee"]')
          .forEach(el => {
            el.style.display = '';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'employee':
        // Employees see only their content
        document.querySelectorAll('[data-permission="employee"]')
          .forEach(el => {
            el.style.display = '';
            el.classList.remove('permission-hidden');
          });
        break;
    }
    
    // Also update feature permissions based on capability
    this.updateFeaturePermissions();
  }

  updateFeaturePermissions() {
    // Disable buttons/inputs based on permissions
    document.querySelectorAll('[data-feature="edit"]').forEach(el => {
      el.disabled = !this.userPermissions.canEditIncidents;
      if (el.disabled) {
        el.title = 'Editing requires Safety Officer or Admin role';
      }
    });
    
    document.querySelectorAll('[data-feature="delete"]').forEach(el => {
      el.disabled = !this.userPermissions.canDeleteRecords;
      if (el.disabled) {
        el.title = 'Deleting requires Admin role';
      }
    });
    
    document.querySelectorAll('[data-feature="export"]').forEach(el => {
      el.disabled = !this.userPermissions.canExportData;
      if (el.disabled) {
        el.title = 'Exporting requires Manager or higher role';
      }
    });
    
    document.querySelectorAll('[data-feature="migrate"]').forEach(el => {
      el.disabled = !this.userPermissions.canMigrateData;
      if (el.disabled) {
        el.title = 'Data migration requires Admin role';
      }
    });
    
    document.querySelectorAll('[data-feature="audit"]').forEach(el => {
      el.disabled = !this.userPermissions.canViewAuditLogs;
      if (el.disabled) {
        el.title = 'Audit logs require Admin role';
      }
    });
    
    // Show/hide module cards based on permissions
    const modules = this.userPermissions.modules || [];
    document.querySelectorAll('.module-card').forEach(card => {
      const moduleText = card.querySelector('h3')?.textContent.toLowerCase() || '';
      let hasAccess = false;
      
      if (modules.includes('all')) {
        hasAccess = true;
      } else {
        // Check if user has access to this module type
        if (moduleText.includes('incident') && modules.includes('incidents')) hasAccess = true;
        if (moduleText.includes('training') && modules.includes('training')) hasAccess = true;
        if (moduleText.includes('ppe') && modules.includes('ppe')) hasAccess = true;
        if (moduleText.includes('audit') && modules.includes('audits')) hasAccess = true;
        if (moduleText.includes('observation') && modules.includes('observations')) hasAccess = true;
        if (moduleText.includes('equipment') && modules.includes('equipment')) hasAccess = true;
        if (moduleText.includes('checklist') && modules.includes('checklists')) hasAccess = true;
        if (moduleText.includes('report') && modules.includes('reports')) hasAccess = true;
      }
      
      if (!hasAccess) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        card.title = 'Module not available for your role';
      } else {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
        card.title = '';
      }
    });
    
    console.log('✅ Feature permissions applied');
  }

  updateLocationData() {
    // Highlight current location in dropdowns
    const locationSelects = document.querySelectorAll('select[data-location]');
    locationSelects.forEach(select => {
      // Could pre-select user's location
      console.log(`📍 User location: ${this.userLocation}`);
      
      // Highlight option matching user's location
      Array.from(select.options).forEach(option => {
        if (option.text.includes(this.userLocation)) {
          option.style.fontWeight = '600';
          option.style.color = this.getRoleColor(this.userRole);
        }
      });
    });
  }

  trackLogin(status) {
    // Send to analytics if available
    if (window.gtag && status === 'success') {
      window.gtag('event', 'login', {
        'event_category': 'authentication',
        'event_label': this.userRole,
        'user_role': this.userRole,
        'user_location': this.userLocation
      });
    }
  }

  // Permission check methods for programmatic use
  can(permission) {
    return this.userPermissions[permission] || false;
  }

  canAccessModule(moduleName) {
    const modules = this.userPermissions.modules || [];
    if (modules.includes('all')) return true;
    
    const moduleMap = {
      'incidents': 'incidents',
      'training': 'training',
      'ppe': 'ppe',
      'audits': 'audits',
      'equipment': 'equipment',
      'chemical': 'equipment', // Group with equipment
      'observations': 'observations',
      'checklists': 'checklists',
      'reports': 'reports',
      'emergency': 'checklists', // Group with checklists
      'risk': 'incidents', // Group with incidents
      'investigation': 'incidents' // Group with incidents
    };
    
    const requiredModule = moduleMap[moduleName.toLowerCase()];
    return requiredModule ? modules.includes(requiredModule) : false;
  }

  // Get user info for display
  getUserInfo() {
    return {
      email: this.currentUser?.email,
      role: this.userRole,
      location: this.userLocation,
      permissions: this.userPermissions
    };
  }
}

// Initialize and make globally available
const mmsAuth = new MMSAuthSystem();

// Global functions for HTML onclick
window.handleMMSLogin = async function() {
  const emailInput = document.getElementById('prodEmail');
  const passwordInput = document.getElementById('prodPassword');
  const errorDiv = document.getElementById('loginError');
  const loginBtn = event?.target || document.querySelector('#loginScreen button');
  
  if (!emailInput || !passwordInput) {
    alert('System error: Login form not found');
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.innerHTML = '';
  }
  
  // Basic validation
  if (!email || !password) {
    window.showError('Please enter both email and password');
    return;
  }
  
  if (!email.includes('@mms.com') && !email.includes('@metalmanagement')) {
    window.showError('Please use your company email address (@mms.com)');
    return;
  }
  
  // UI feedback
  loginBtn.disabled = true;
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span> Authenticating...';
  
  // Perform login
  const result = await mmsAuth.login(email, password);
  
  if (result.success) {
    // Success
    loginBtn.innerHTML = '<span style="margin-right: 8px;">✅</span> Success! Loading...';
    loginBtn.style.background = '#10b981';
    
    // Clear password field
    passwordInput.value = '';
    
    // Auto-hide success after 2 seconds
    setTimeout(() => {
      if (loginBtn) {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
        loginBtn.style.background = '';
      }
    }, 2000);
    
  } else {
    // Error
    loginBtn.innerHTML = originalText;
    loginBtn.disabled = false;
    
    window.showError(result.error);
    
    // Clear password on error
    passwordInput.value = '';
    passwordInput.focus();
  }
};

// Helper function for errors
window.showError = function(message) {
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) {
    errorDiv.innerHTML = `⚠️ ${message}`;
    errorDiv.style.display = 'block';
    errorDiv.style.animation = 'shake 0.5s';
    
    // Remove animation after it plays
    setTimeout(() => {
      errorDiv.style.animation = '';
    }, 500);
  } else {
    alert(`Error: ${message}`);
  }
};

// Logout handler
window.handleMMSLogout = async function() {
  if (confirm('Are you sure you want to logout?')) {
    const logoutBtn = event.target;
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = '<span style="margin-right: 8px;">⏳</span> Logging out...';
    
    await mmsAuth.logout();
    
    // Reset button after delay
    setTimeout(() => {
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = '🚪 Logout';
      }
    }, 1000);
  }
};

// Check if user can perform action
window.canUser = function(permission) {
  return window.mmsAuth?.can(permission) || false;
};

// Check module access
window.canAccess = function(moduleName) {
  return window.mmsAuth?.canAccessModule(moduleName) || false;
};

// Get current user info
window.getCurrentUser = function() {
  return window.mmsAuth?.getUserInfo() || null;
};

// Make auth instance globally available
window.mmsAuth = mmsAuth;

// Add shake animation for login errors
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

console.log('✅ Enhanced MMS Auth System Ready');
