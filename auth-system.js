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
    this.permissionFlags = {};
    this.init();
  }

  init() {
    console.log('🔐 MMS Auth System Initializing...');
    
    // Track auth state changes
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.analyzeUserProfile(user);
        console.log(`✅ Authenticated: ${user.email}`);
        this.showApplication();
        this.trackLogin('success');
      } else {
        this.currentUser = null;
        this.userRole = 'guest';
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
    
    // Set permission flags
    this.setPermissionFlags();
    
    console.log(`📍 User ${email} identified as ${this.userRole} from ${this.userLocation}`);
  }

  setPermissionFlags() {
    this.permissionFlags = {
      canReportIncidents: ['admin', 'safety_officer', 'manager', 'employee'].includes(this.userRole),
      canEditIncidents: ['admin', 'safety_officer', 'manager'].includes(this.userRole),
      canDeleteRecords: ['admin', 'safety_officer'].includes(this.userRole),
      canViewHealthRecords: ['admin', 'safety_officer', 'manager'].includes(this.userRole),
      canManageUsers: this.userRole === 'admin',
      canMigrateData: this.userRole === 'admin',
      canAccessAuditLogs: this.userRole === 'admin',
      canBackupSystem: this.userRole === 'admin',
      canExportData: ['admin', 'safety_officer', 'manager'].includes(this.userRole),
      canViewReports: ['admin', 'safety_officer', 'manager'].includes(this.userRole),
      canManageStandards: ['admin', 'safety_officer'].includes(this.userRole)
    };
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
        permissions: this.permissionFlags,
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
        'guest': '👥 Guest'
      };
      
      const roleText = roleNames[this.userRole] || '👤 User';
      const locationText = this.userLocation !== 'Unknown' ? ` • ${this.userLocation}` : '';
      roleElement.textContent = `${roleText}${locationText}`;
      roleElement.style.fontWeight = '600';
      roleElement.style.color = this.getRoleColor(this.userRole);
    }
    
    // Apply role permissions to UI elements
    this.applyRolePermissions();
    
    // Update location-specific data
    this.updateLocationData();
  }

  getRoleColor(role) {
    const colors = {
      'admin': '#dc2626',
      'safety_officer': '#3b82f6', 
      'manager': '#10b981',
      'employee': '#6b7280',
      'guest': '#94a3b8'
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
            el.style.display = 'block';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'safety_officer':
        // Safety officers see their content + manager + employee
        document.querySelectorAll('[data-permission="safety_officer"], [data-permission="manager"], [data-permission="employee"]')
          .forEach(el => {
            el.style.display = 'block';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'manager':
        // Managers see their content + employee
        document.querySelectorAll('[data-permission="manager"], [data-permission="employee"]')
          .forEach(el => {
            el.style.display = 'block';
            el.classList.remove('permission-hidden');
          });
        break;
        
      case 'employee':
        // Employees see only their content
        document.querySelectorAll('[data-permission="employee"]')
          .forEach(el => {
            el.style.display = 'block';
            el.classList.remove('permission-hidden');
          });
        break;
        
      default:
        // Guest sees nothing special
        document.querySelectorAll('[data-permission="guest"]')
          .forEach(el => {
            el.style.display = 'block';
            el.classList.remove('permission-hidden');
          });
    }
    
    // Also update feature permissions (disable/enable buttons)
    this.updateFeaturePermissions();
    
    console.log(`✅ Permissions applied for ${this.userRole}`);
  }

  updateFeaturePermissions() {
    // Disable buttons/inputs based on role
    const canEdit = this.permissionFlags.canEditIncidents;
    const canDelete = this.permissionFlags.canDeleteRecords;
    const canExport = this.permissionFlags.canExportData;
    const canReport = this.permissionFlags.canReportIncidents;
    
    // Apply to UI elements
    document.querySelectorAll('[data-feature="edit"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        el.disabled = !canEdit;
      }
    });
    
    document.querySelectorAll('[data-feature="delete"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        el.disabled = !canDelete;
      }
    });
    
    document.querySelectorAll('[data-feature="export"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        el.disabled = !canExport;
      }
    });
    
    document.querySelectorAll('[data-feature="report"]').forEach(el => {
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        el.disabled = !canReport;
      }
    });
    
    // Show/hide admin controls
    const adminControls = document.querySelectorAll('[data-permission="admin"]');
    adminControls.forEach(control => {
      if (this.userRole !== 'admin') {
        control.style.display = 'none';
      }
    });
  }

  updateLocationData() {
    // Highlight current location in dropdowns
    const locationSelects = document.querySelectorAll('select[data-location]');
    locationSelects.forEach(select => {
      // Could pre-select user's location in future
      console.log(`📍 User location: ${this.userLocation}`);
    });
  }

  trackLogin(status) {
    // Send to analytics
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
  hasPermission(permissionName) {
    return this.permissionFlags[permissionName] || false;
  }

  // Get user info for other modules
  getUserInfo() {
    return {
      email: this.currentUser?.email,
      uid: this.currentUser?.uid,
      role: this.userRole,
      location: this.userLocation,
      permissions: this.permissionFlags
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
    showError('Please enter both email and password');
    return;
  }
  
  if (!email.includes('@mms.com') && !email.includes('@metalmanagement')) {
    showError('Please use your company email address (@mms.com)');
    return;
  }
  
  // UI feedback
  loginBtn.disabled = true;
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<span class="spinner"></span> Authenticating...';
  
  // Perform login
  const result = await mmsAuth.login(email, password);
  
  if (result.success) {
    // Success
    loginBtn.innerHTML = '✅ Success! Redirecting...';
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
    
    showError(result.error);
    
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
    logoutBtn.innerHTML = 'Logging out...';
    
    await mmsAuth.logout();
    
    // Reset button after delay
    setTimeout(() => {
      logoutBtn.disabled = false;
      logoutBtn.innerHTML = '🚪 Logout';
    }, 1000);
  }
};

// Make auth instance globally available
window.mmsAuth = mmsAuth;

// Add CSS for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .permission-hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);

console.log('✅ MMS Auth System Ready with Role Permissions');
