/* ═══════════════════════════════════════════════════════════════
   ai-incident-analyzer.js
   Client wrapper for MMS Hazard Analyzer Cloudflare Worker.
   ═══════════════════════════════════════════════════════════════ */

const WORKER_URL = 'https://mms-hazard-analyzer.cephas-mkama.workers.dev';
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

async function analyzeImage(file, context = '') {
    if (!file) throw new Error('No image provided.');
    if (!file.type || !file.type.startsWith('image/')) {
        throw new Error('File must be an image (JPG, PNG, WebP).');
    }

    const { base64, mimeType } = await fileToResizedBase64(file);

    let response;
    try {
        response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: base64,
                mimeType: mimeType,
                context: context || ''
            })
        });
    } catch (netErr) {
        throw new Error('Network error — check your connection and try again.');
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        throw new Error('AI service returned an unexpected response.');
    }

    if (!response.ok || !data.success) {
        const msg = (data && data.error) || ('HTTP ' + response.status);
        throw new Error(msg);
    }
    if (!data.analysis) {
        throw new Error('AI returned an empty analysis.');
    }

    return data.analysis;
}

function fileToResizedBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Could not decode image.'));
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width >= height) {
                        height = Math.round((MAX_DIMENSION / width) * height);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.round((MAX_DIMENSION / height) * width);
                        height = MAX_DIMENSION;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
                const base64 = dataUrl.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg' });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

window.mmsAI = {
    analyzeImage: analyzeImage,
    isReady: () => true
};

console.log('[ai-incident-analyzer] Ready. Worker:', WORKER_URL);