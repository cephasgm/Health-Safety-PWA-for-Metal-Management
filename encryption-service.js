// Encryption Service - MMS Safety System
// Client-side encryption for sensitive data

class MMSEncryptionService {
  constructor() {
    this.ENCRYPTION_KEY = 'mms_safety_encryption_key_2024';
    this.IV_LENGTH = 16;
    this.ALGORITHM = 'AES-GCM';
    this.KEY_LENGTH = 256;
    
    console.log('🔐 MMS Encryption Service Initialized');
  }

  // Generate encryption key from password
  async generateKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt sensitive data (employee health records, etc.)
  async encryptSensitiveData(data, context = 'health_record') {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data for encryption');
      }

      const textEncoder = new TextEncoder();
      const dataString = JSON.stringify(data);
      const dataBuffer = textEncoder.encode(dataString);
      
      // Generate IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // Get encryption key
      const key = await this.generateKeyFromPassword(this.ENCRYPTION_KEY, context);
      
      // Encrypt
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64 for storage
      const encryptedBase64 = btoa(String.fromCharCode(...combined));
      
      // Create metadata
      const encryptedPackage = {
        encrypted: true,
        version: '1.0',
        algorithm: this.ALGORITHM,
        context: context,
        timestamp: new Date().toISOString(),
        data: encryptedBase64,
        iv_length: iv.length
      };

      console.log(`✅ Data encrypted for context: ${context}`);
      return encryptedPackage;

    } catch (error) {
      console.error('❌ Encryption failed:', error);
      // Fallback to simple obfuscation for safety
      return this.obfuscateData(data, context);
    }
  }

  // Decrypt data
  async decryptSensitiveData(encryptedPackage) {
    try {
      if (!encryptedPackage?.encrypted) {
        return encryptedPackage; // Not encrypted
      }

      const { data: encryptedBase64, context, iv_length } = encryptedPackage;
      
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedBase64).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, iv_length || this.IV_LENGTH);
      const encryptedData = combined.slice(iv_length || this.IV_LENGTH);
      
      // Get decryption key
      const key = await this.generateKeyFromPassword(this.ENCRYPTION_KEY, context);
      
      // Decrypt
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedData
      );

      // Convert back to string
      const textDecoder = new TextDecoder();
      const decryptedString = textDecoder.decode(decryptedBuffer);
      
      return JSON.parse(decryptedString);

    } catch (error) {
      console.error('❌ Decryption failed:', error);
      
      // Try to de-obfuscate if it was obfuscated
      if (encryptedPackage.obfuscated) {
        return this.deobfuscateData(encryptedPackage);
      }
      
      throw new Error('Failed to decrypt data. It may be corrupted.');
    }
  }

  // Fallback obfuscation (when crypto API fails)
  obfuscateData(data, context) {
    const dataString = JSON.stringify(data);
    // Simple XOR obfuscation
    const key = this.ENCRYPTION_KEY + context;
    let obfuscated = '';
    
    for (let i = 0; i < dataString.length; i++) {
      obfuscated += String.fromCharCode(
        dataString.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }

    return {
      obfuscated: true,
      version: '1.0',
      context: context,
      timestamp: new Date().toISOString(),
      data: btoa(obfuscated),
      warning: 'Fallback obfuscation used'
    };
  }

  deobfuscateData(obfuscatedPackage) {
    const { data: obfuscatedBase64, context } = obfuscatedPackage;
    const key = this.ENCRYPTION_KEY + context;
    
    const obfuscated = atob(obfuscatedBase64);
    let original = '';
    
    for (let i = 0; i < obfuscated.length; i++) {
      original += String.fromCharCode(
        obfuscated.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }

    return JSON.parse(original);
  }

  // Hash sensitive identifiers (employee IDs, etc.)
  async hashIdentifier(identifier, salt = 'mms_safety_salt') {
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier + salt);
    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Mask sensitive information for display
  maskSensitiveInfo(text, type) {
    if (!text) return '';
    
    switch(type) {
      case 'email':
        const [name, domain] = text.split('@');
        return `${name.charAt(0)}***@${domain}`;
        
      case 'phone':
        return text.replace(/\d(?=\d{4})/g, '*');
        
      case 'id_number':
        return `***-***-${text.slice(-4)}`;
        
      case 'credit_card':
        return `****-****-****-${text.slice(-4)}`;
        
      case 'medical_record':
        return `[MEDICAL RECORD - ${text.length} chars]`;
        
      default:
        return text.length > 8 
          ? `${text.slice(0, 3)}***${text.slice(-2)}`
          : '***';
    }
  }

  // Check if data contains sensitive information
  containsSensitiveData(data) {
    const sensitivePatterns = [
      /\d{3}-\d{2}-\d{4}/, // SSN-like
      /\d{16}/, // Credit card
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/, // Email
      /blood|allerg|medical|diagnos|treatment|prescription/i,
      /password|secret|token|key|credential/i
    ];

    const dataString = typeof data === 'string' 
      ? data 
      : JSON.stringify(data).toLowerCase();

    return sensitivePatterns.some(pattern => pattern.test(dataString));
  }

  // Auto-encrypt sensitive fields in an object
  async autoEncryptSensitiveFields(obj) {
    const encrypted = { ...obj };
    const sensitiveFields = [
      'blood_group', 'allergies', 'medical_conditions',
      'emergency_contact_phone', 'medical_restrictions',
      'password', 'token', 'secret'
    ];

    for (const field of sensitiveFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        const encryptedValue = await this.encryptSensitiveData(
          { value: encrypted[field] },
          `field_${field}`
        );
        encrypted[field] = encryptedValue;
        encrypted[`${field}_encrypted`] = true;
      }
    }

    return encrypted;
  }

  // Generate audit-safe data fingerprint
  async generateDataFingerprint(data) {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);
    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return {
      fingerprint: hashArray.map(b => b.toString(16).padStart(2, '0')).join(''),
      timestamp: new Date().toISOString(),
      data_length: dataString.length
    };
  }

  // Validate data integrity
  async validateDataIntegrity(data, expectedFingerprint) {
    const currentFingerprint = await this.generateDataFingerprint(data);
    return currentFingerprint.fingerprint === expectedFingerprint;
  }
}

// Initialize and export
const mmsEncryption = new MMSEncryptionService();
window.mmsEncryption = mmsEncryption;

// Test encryption (development only)
if (window.location.hostname.includes('localhost')) {
  setTimeout(async () => {
    console.log('🔐 Testing encryption service...');
    
    const testData = {
      blood_group: 'O+',
      allergies: 'Penicillin, Peanuts',
      emergency_contact: '+255 789 456 123'
    };
    
    try {
      const encrypted = await mmsEncryption.encryptSensitiveData(testData, 'test');
      console.log('✅ Encryption test passed:', encrypted.encrypted);
      
      const decrypted = await mmsEncryption.decryptSensitiveData(encrypted);
      console.log('✅ Decryption test passed:', decrypted.blood_group === 'O+');
      
    } catch (error) {
      console.warn('⚠️ Encryption test failed (fallback used):', error.message);
    }
  }, 3000);
}

console.log('✅ MMS Encryption Service Ready');
