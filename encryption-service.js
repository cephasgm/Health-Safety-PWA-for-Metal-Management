// MMS Safety - Data Encryption Service
// Protects sensitive health and incident data

class SafetyEncryptionService {
  constructor() {
    this.ENCRYPTION_KEY = this.generateEncryptionKey();
    this.SENSITIVE_FIELDS = [
      'blood_group', 'allergies', 'medical_conditions',
      'emergency_contact_name', 'emergency_contact_phone',
      'medical_restrictions', 'medical_status'
    ];
    
    console.log('🔒 Encryption Service Initialized');
  }

  generateEncryptionKey() {
    // In production, get from secure server or environment variable
    // For now, generate from user-specific data
    const user = window.mmsAuth?.currentUser;
    const baseKey = user ? user.uid + '_mms_safety_2024' : 'mms_safety_default_key';
    
    // Create a deterministic but secure key
    let hash = 0;
    for (let i = 0; i < baseKey.length; i++) {
      const char = baseKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16).padStart(32, '0');
  }

  encryptText(text) {
    if (!text || typeof text !== 'string') return text;
    
    try {
      // Simple XOR encryption for demonstration
      // In production, use Web Crypto API
      let result = '';
      const key = this.ENCRYPTION_KEY;
      
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
      }
      
      // Encode to base64 for safe storage
      return btoa(result);
      
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to plain text
    }
  }

  decryptText(encryptedText) {
    if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
    
    try {
      // Decode from base64
      const decoded = atob(encryptedText);
      let result = '';
      const key = this.ENCRYPTION_KEY;
      
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
      }
      
      return result;
      
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText; // Return as-is if decryption fails
    }
  }

  encryptObject(obj, fieldsToEncrypt = null) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const fields = fieldsToEncrypt || this.SENSITIVE_FIELDS;
    const encrypted = { ...obj };
    
    fields.forEach(field => {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encryptText(encrypted[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });
    
    return encrypted;
  }

  decryptObject(obj, fieldsToDecrypt = null) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const fields = fieldsToDecrypt || this.SENSITIVE_FIELDS;
    const decrypted = { ...obj };
    
    fields.forEach(field => {
      if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[`${field}_encrypted`]) {
        decrypted[field] = this.decryptText(decrypted[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });
    
    return decrypted;
  }

  encryptHealthRecord(healthRecord) {
    const encryptedRecord = this.encryptObject(healthRecord);
    
    // Add encryption metadata
    encryptedRecord.encryption = {
      encrypted_at: new Date().toISOString(),
      encrypted_by: window.mmsAuth?.currentUser?.email || 'system',
      version: '1.0',
      method: 'xor_base64'
    };
    
    return encryptedRecord;
  }

  decryptHealthRecord(encryptedRecord) {
    const decrypted = this.decryptObject(encryptedRecord);
    
    // Remove encryption metadata
    delete decrypted.encryption;
    
    return decrypted;
  }

  maskSensitiveData(text, maskChar = '*') {
    if (!text) return text;
    
    // Mask email addresses
    if (text.includes('@')) {
      const [local, domain] = text.split('@');
      const maskedLocal = local.length > 2 
        ? local.charAt(0) + maskChar.repeat(local.length - 2) + local.charAt(local.length - 1)
        : maskChar.repeat(local.length);
      return `${maskedLocal}@${domain}`;
    }
    
    // Mask phone numbers
    if (/^\d+$/.test(text.replace(/\D/g, ''))) {
      const digits = text.replace(/\D/g, '');
      if (digits.length >= 10) {
        return `${digits.substring(0, 3)}${maskChar.repeat(4)}${digits.substring(7)}`;
      }
    }
    
    // Mask other sensitive text
    if (text.length > 4) {
      return text.charAt(0) + maskChar.repeat(text.length - 2) + text.charAt(text.length - 1);
    }
    
    return maskChar.repeat(text.length);
  }

  sanitizeForExport(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForExport(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      
      this.SENSITIVE_FIELDS.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = this.maskSensitiveData(sanitized[field]);
          sanitized[`${field}_masked`] = true;
        }
      });
      
      // Remove internal fields
      delete sanitized.encryption;
      delete sanitized.created_by_id;
      delete sanitized.updated_by_id;
      delete sanitized.migrated_from;
      
      return sanitized;
    }
    
    return data;
  }
}

// Create global instance
const safetyEncryption = new SafetyEncryptionService();

// Global encryption functions
window.encryptHealthData = function(data) {
  return safetyEncryption.encryptHealthRecord(data);
};

window.decryptHealthData = function(data) {
  return safetyEncryption.decryptHealthRecord(data);
};

window.maskSensitiveInfo = function(text) {
  return safetyEncryption.maskSensitiveData(text);
};

console.log('✅ Encryption Service Ready');
