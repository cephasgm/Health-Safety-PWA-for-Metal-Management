// MMS Safety - File Upload Service
import { storage, analytics } from './firebase-config.js';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

class SafetyFileUploadService {
  constructor() {
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    this.ALLOWED_TYPES = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      documents: ['application/pdf', 'application/msword', 
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.ms-excel', 
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      signatures: ['image/svg+xml']
    };
    
    this.activeUploads = new Map();
    console.log('📎 Safety File Upload Service Initialized');
  }

  // ==================== VALIDATION ====================
  validateFile(file, options = {}) {
    const errors = [];
    
    // Size validation
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File too large (max ${this.formatBytes(this.MAX_FILE_SIZE)})`);
    }
    
    // Type validation
    const allAllowedTypes = [
      ...this.ALLOWED_TYPES.images,
      ...this.ALLOWED_TYPES.documents,
      ...this.ALLOWED_TYPES.signatures
    ];
    
    if (!allAllowedTypes.includes(file.type)) {
      errors.push(`File type "${file.type}" not allowed`);
    }
    
    // Custom validation
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File exceeds maximum size of ${this.formatBytes(options.maxSize)}`);
    }
    
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed for this upload`);
    }
    
    // Name validation (security)
    if (!this.isSafeFileName(file.name)) {
      errors.push('File name contains invalid characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      file: file
    };
  }

  isSafeFileName(fileName) {
    // Prevent path traversal and other attacks
    const unsafePatterns = [
      /\.\.\//, // Directory traversal
      /\/\//,   // Double slash
      /\\/,     // Backslash
      /^\./,    // Hidden files
      /[\x00-\x1f\x7f]/, // Control characters
      /[<>:"|?*]/ // Windows reserved characters
    ];
    
    return !unsafePatterns.some(pattern => pattern.test(fileName));
  }

  // ==================== UPLOAD MANAGEMENT ====================
  async uploadFile(file, context, referenceId, options = {}) {
    try {
      // Validate file
      const validation = this.validateFile(file, options);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }
      
      const user = window.mmsAuth?.currentUser;
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop().toLowerCase();
      
      // Generate safe filename
      const safeName = this.generateSafeFileName(file.name, timestamp);
      const filePath = `mms_safety/${context}/${referenceId}/${safeName}`;
      
      // Create storage reference
      const storageRef = ref(storage, filePath);
      
      // Prepare metadata
      const metadata = {
        customMetadata: {
          uploadedBy: user?.email || 'unknown',
          userId: user?.uid || 'unknown',
          userRole: window.mmsAuth?.userRole || 'guest',
          context: context,
          referenceId: referenceId,
          originalName: file.name,
          company: 'mms_metal_management',
          timestamp: timestamp.toString(),
          location: window.mmsAuth?.userLocation || 'unknown'
        }
      };
      
      let uploadResult;
      
      if (options.showProgress) {
        // Upload with progress tracking
        uploadResult = await this.uploadWithProgress(storageRef, file, metadata, options);
      } else {
        // Simple upload
        uploadResult = await uploadBytes(storageRef, file, metadata);
      }
      
      // Get download URL
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      // Compress image if needed
      let thumbnailURL = null;
      if (this.ALLOWED_TYPES.images.includes(file.type) && options.generateThumbnail) {
        thumbnailURL = await this.generateThumbnail(file, downloadURL);
      }
      
      // File info for database
      const fileInfo = {
        id: `FILE-${timestamp}-${Math.random().toString(36).substr(2, 6)}`,
        url: downloadURL,
        thumbnail_url: thumbnailURL,
        path: filePath,
        name: file.name,
        safe_name: safeName,
        size: file.size,
        formatted_size: this.formatBytes(file.size),
        type: file.type,
        extension: fileExt,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.email || 'unknown',
        uploaded_by_id: user?.uid || 'unknown',
        context: context,
        reference_id: referenceId,
        metadata: metadata.customMetadata
      };
      
      console.log(`✅ File uploaded: ${file.name} → ${filePath}`);
      
      // Log to analytics
      if (window.gtag) {
        window.gtag('event', 'file_upload', {
          'event_category': 'storage',
          'event_label': context,
          'file_type': file.type,
          'file_size': file.size
        });
      }
      
      return {
        success: true,
        file: fileInfo,
        message: 'File uploaded successfully'
      };
      
    } catch (error) {
      console.error('❌ File upload failed:', error);
      
      // Log error
      if (window.mmsDB) {
        await window.mmsDB.logAction('file_upload_failed', {
          file_name: file.name,
          file_size: file.size,
          context: context,
          error: error.message
        });
      }
      
      return {
        success: false,
        error: error.message || 'Failed to upload file',
        retryable: !error.message.includes('permission')
      };
    }
  }

  async uploadWithProgress(storageRef, file, metadata, options) {
    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      const uploadId = Date.now().toString();
      
      // Store upload info
      this.activeUploads.set(uploadId, {
        task: uploadTask,
        file: file,
        started: new Date(),
        progress: 0
      });
      
      // Progress tracking
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          // Update stored progress
          const uploadInfo = this.activeUploads.get(uploadId);
          if (uploadInfo) {
            uploadInfo.progress = progress;
          }
          
          // Call progress callback if provided
          if (options.onProgress) {
            options.onProgress({
              progress: Math.round(progress),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              state: snapshot.state,
              uploadId: uploadId
            });
          }
          
          console.log(`📤 Upload ${uploadId}: ${progress.toFixed(1)}%`);
        },
        (error) => {
          this.activeUploads.delete(uploadId);
          reject(error);
        },
        () => {
          this.activeUploads.delete(uploadId);
          resolve(uploadTask.snapshot);
        }
      );
    });
  }

  async generateThumbnail(file, originalURL) {
    try {
      // For images, create a thumbnail using canvas
      if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set thumbnail dimensions
            const maxWidth = 200;
            const maxHeight = 200;
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to data URL
            const thumbnailDataURL = canvas.toDataURL('image/jpeg', 0.7);
            resolve(thumbnailDataURL);
          };
          img.onerror = () => resolve(null);
          img.src = originalURL;
        });
      }
      return null;
    } catch (error) {
      console.warn('Thumbnail generation failed:', error);
      return null;
    }
  }

  // ==================== MULTIPLE FILE UPLOAD ====================
  async uploadMultipleFiles(files, context, referenceId, options = {}) {
    const results = {
      successful: [],
      failed: [],
      total: files.length
    };
    
    // Limit concurrent uploads
    const CONCURRENT_LIMIT = 3;
    const queues = [];
    
    for (let i = 0; i < files.length; i += CONCURRENT_LIMIT) {
      const batch = files.slice(i, i + CONCURRENT_LIMIT);
      queues.push(batch);
    }
    
    for (const batch of queues) {
      const batchPromises = batch.map(file => 
        this.uploadFile(file, context, referenceId, options)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.successful.push(result.value.file);
        } else {
          results.failed.push({
            file: batch[index].name,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }
    
    return {
      success: results.failed.length === 0,
      results: results,
      message: `Uploaded ${results.successful.length} of ${results.total} files`
    };
  }

  // ==================== FILE MANAGEMENT ====================
  async deleteFile(filePath) {
    try {
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      
      console.log(`🗑️ File deleted: ${filePath}`);
      
      if (window.mmsDB) {
        await window.mmsDB.logAction('file_deleted', {
          file_path: filePath,
          deleted_by: window.mmsAuth?.currentUser?.email
        });
      }
      
      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      console.error('❌ Failed to delete file:', error);
      return { success: false, error: error.message };
    }
  }

  async getFileInfo(filePath) {
    try {
      // Note: Firebase Storage doesn't have metadata retrieval without download
      // This would need a Cloud Function for full metadata
      return {
        success: true,
        exists: true,
        path: filePath,
        note: 'Use getDownloadURL for file access'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== INCIDENT PHOTO UPLOAD (SPECIALIZED) ====================
  async uploadIncidentPhotos(files, incidentId) {
    const options = {
      maxSize: 5 * 1024 * 1024, // 5MB for photos
      allowedTypes: this.ALLOWED_TYPES.images,
      generateThumbnail: true,
      showProgress: true,
      onProgress: (progress) => {
        // Update UI if needed
        const event = new CustomEvent('upload-progress', {
          detail: { incidentId, ...progress }
        });
        window.dispatchEvent(event);
      }
    };
    
    return this.uploadMultipleFiles(files, 'incident_photos', incidentId, options);
  }

  async uploadIncidentDocument(file, incidentId, documentType) {
    const options = {
      maxSize: this.MAX_FILE_SIZE,
      allowedTypes: [...this.ALLOWED_TYPES.documents, ...this.ALLOWED_TYPES.signatures],
      showProgress: true
    };
    
    return this.uploadFile(file, `incident_${documentType}`, incidentId, options);
  }

  // ==================== UTILITIES ====================
  generateSafeFileName(originalName, timestamp) {
    // Remove unsafe characters and add timestamp
    const safeName = originalName
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
    
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}_${random}_${safeName}`;
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getActiveUploads() {
    return Array.from(this.activeUploads.entries()).map(([id, info]) => ({
      id,
      fileName: info.file.name,
      progress: info.progress,
      started: info.started,
      duration: Date.now() - info.started.getTime()
    }));
  }

  cancelUpload(uploadId) {
    const uploadInfo = this.activeUploads.get(uploadId);
    if (uploadInfo && uploadInfo.task.cancel) {
      uploadInfo.task.cancel();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  // ==================== UI HELPERS ====================
  createFilePreview(file) {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            type: 'image',
            url: e.target.result,
            name: file.name,
            size: this.formatBytes(file.size)
          });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        resolve({
          type: 'pdf',
          url: null,
          name: file.name,
          size: this.formatBytes(file.size),
          icon: '📄'
        });
      } else if (file.type.includes('word') || file.type.includes('document')) {
        resolve({
          type: 'document',
          url: null,
          name: file.name,
          size: this.formatBytes(file.size),
          icon: '📝'
        });
      } else if (file.type.includes('excel') || file.type.includes('spreadsheet')) {
        resolve({
          type: 'spreadsheet',
          url: null,
          name: file.name,
          size: this.formatBytes(file.size),
          icon: '📊'
        });
      } else {
        resolve({
          type: 'generic',
          url: null,
          name: file.name,
          size: this.formatBytes(file.size),
          icon: '📎'
        });
      }
    });
  }
}

// Initialize and export
const safetyFileUpload = new SafetyFileUploadService();

// Global functions for easy access
window.safetyFileUpload = safetyFileUpload;

// Global file upload handler for HTML forms
window.handleFileUpload = async function(event, context, referenceId) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  
  const container = document.getElementById('uploadProgress') || 
                   document.createElement('div');
  container.id = 'uploadProgress';
  container.innerHTML = '';
  
  // Add to page if not already there
  if (!document.getElementById('uploadProgress')) {
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      max-width: 300px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
    document.body.appendChild(container);
  }
  
  const results = await safetyFileUpload.uploadMultipleFiles(
    files, 
    context, 
    referenceId, 
    { 
      showProgress: true,
      onProgress: (progress) => {
        const progressBar = document.getElementById(`progress-${progress.uploadId}`);
        if (progressBar) {
          progressBar.style.width = `${progress.progress}%`;
          progressBar.textContent = `${progress.progress}%`;
        }
      }
    }
  );
  
  // Show results
  if (results.success) {
    container.innerHTML = `
      <div style="color: #10b981; font-weight: bold; margin-bottom: 10px;">
        ✅ ${results.message}
      </div>
      <div style="font-size: 0.9rem; color: #64748b;">
        ${results.results.successful.length} files uploaded successfully
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="color: #ef4444; font-weight: bold; margin-bottom: 10px;">
        ⚠️ Upload completed with errors
      </div>
      <div style="font-size: 0.9rem; color: #64748b;">
        ${results.results.successful.length} successful, 
        ${results.results.failed.length} failed
      </div>
    `;
  }
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (container.parentNode) {
      container.style.opacity = '0';
      container.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (container.parentNode) container.remove();
      }, 500);
    }
  }, 5000);
  
  return results;
};

console.log('✅ Safety File Upload Service Ready');
