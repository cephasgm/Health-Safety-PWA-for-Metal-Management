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
    } else {
      this.userRole = 'employee';
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
    
    // Update role display
    const roleElement = document.getElementById('currentUserRole');
    if (roleElement) {
      const roleDisplay = this.userRole.replace('_', ' ').toUpperCase();
      roleElement.textContent = `${roleDisplay} • ${this.userLocation}`;
      roleElement.style.color = this.getRoleColor(this.userRole);
    }
    
    // Update role-based UI
    this.applyRolePermissions();
    
    // Update location-specific data
    this.updateLocationData();
  }

  getRoleColor(role) {
    const colors = {
      'admin': '#dc2626',
      'safety_officer': '#3b82f6', 
      'manager': '#10b981',
      'employee': '#6b7280'
    };
    return colors[role] || '#6b7280';
  }

  applyRolePermissions() {
    // Admin: Full access
    // Safety Officer: Most features
    // Manager: View only
    // Employee: Limited access
    
    const adminOnly = document.querySelectorAll('[data-permission="admin"]');
    const officerOnly = document.querySelectorAll('[data-permission="safety_officer"]');
    const managerOnly = document.querySelectorAll('[data-permission="manager"]');
    
    // Hide all restricted elements first
    adminOnly.forEach(el => el.style.display = 'none');
    officerOnly.forEach(el => el.style.display = 'none');
    managerOnly.forEach(el => el.style.display = 'none');
    
    // Show based on role
    switch(this.userRole) {
      case 'admin':
        adminOnly.forEach(el => el.style.display = 'block');
        officerOnly.forEach(el => el.style.display = 'block');
        managerOnly.forEach(el => el.style.display = 'block');
        break;
      case 'safety_officer':
        officerOnly.forEach(el => el.style.display = 'block');
        managerOnly.forEach(el => el.style.display = 'block');
        break;
      case 'manager':
        managerOnly.forEach(el => el.style.display = 'block');
        break;
    }
    
    console.log(`🔒 Applied ${this.userRole} permissions`);
  }

  updateLocationData() {
    // Highlight current location in dropdowns
    const locationSelects = document.querySelectorAll('select[data-location]');
    locationSelects.forEach(select => {
      // Could pre-select user's location
      console.log(`📍 User location: ${this.userLocation}`);
    });
  }

  trackLogin(status) {
    // Could send to analytics
    if (window.gtag && status === 'success') {
      window.gtag('event', 'login', {
        'event_category': 'authentication',
        'event_label': this.userRole
      });
    }
  }

  // Permission checks for programmatic use
  canReportIncidents() {
    return ['admin', 'safety_officer'].includes(this.userRole);
  }

  canEditIncidents() {
    return ['admin', 'safety_officer'].includes(this.userRole);
  }

  canDeleteRecords() {
    return this.userRole === 'admin';
  }

  canManageUsers() {
    return this.userRole === 'admin';
  }

  canViewHealthRecords() {
    return ['admin', 'safety_officer'].includes(this.userRole);
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
    this.showError('Please enter both email and password');
    return;
  }
  
  if (!email.includes('@mms.com') && !email.includes('@metalmanagement')) {
    this.showError('Please use your company email address');
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
    
    this.showError(result.error);
    
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

console.log('✅ MMS Auth System Ready');
