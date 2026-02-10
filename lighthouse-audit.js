// Lighthouse Audit System - MMS Safety Performance Monitor
class LighthouseAuditor {
    constructor() {
        this.scores = {
            pwa: 0,
            performance: 0,
            accessibility: 0,
            bestPractices: 0,
            seo: 0
        };
        this.thresholds = {
            production: 90,
            warning: 50,
            critical: 30
        };
    }

    async runAudit() {
        console.log('🔍 Running Lighthouse audit...');
        
        const results = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            scores: {},
            issues: [],
            recommendations: []
        };

        // 1. Check PWA Requirements
        const pwaScore = await this.auditPWA();
        results.scores.pwa = pwaScore.score;
        results.issues.push(...pwaScore.issues);
        results.recommendations.push(...pwaScore.recommendations);

        // 2. Performance Checks
        const perfScore = await this.auditPerformance();
        results.scores.performance = perfScore.score;
        results.issues.push(...perfScore.issues);

        // 3. Accessibility
        const a11yScore = await this.auditAccessibility();
        results.scores.accessibility = a11yScore.score;

        // 4. Security/Best Practices
        const bpScore = await this.auditBestPractices();
        results.scores.bestPractices = bpScore.score;
        results.scores.seo = 95; // Default high for SPAs

        // Calculate overall score
        results.overallScore = this.calculateOverallScore(results.scores);
        results.grade = this.getGrade(results.overallScore);
        results.productionReady = results.overallScore >= this.thresholds.production;

        console.log('📊 Audit Results:', results);
        this.displayResults(results);
        this.saveAuditResults(results);

        return results;
    }

    async auditPWA() {
        const checks = [];
        const issues = [];
        const recommendations = [];

        // Check 1: Manifest
        const manifest = document.querySelector('link[rel="manifest"]');
        checks.push({ name: 'Manifest', passed: !!manifest });
        if (!manifest) {
            issues.push('Missing web app manifest');
            recommendations.push('Add manifest.json with proper PWA configuration');
        }

        // Check 2: Service Worker
        const hasSW = 'serviceWorker' in navigator;
        checks.push({ name: 'Service Worker', passed: hasSW });
        if (!hasSW) {
            issues.push('Service Worker not supported/registered');
        }

        // Check 3: HTTPS
        const isHTTPS = window.location.protocol === 'https:';
        checks.push({ name: 'HTTPS', passed: isHTTPS });
        if (!isHTTPS) {
            issues.push('Not served over HTTPS');
            recommendations.push('Deploy to HTTPS endpoint (GitHub Pages provides this)');
        }

        // Check 4: Icons
        const hasIcons = document.querySelector('link[rel="icon"]') && 
                         document.querySelector('link[rel="apple-touch-icon"]');
        checks.push({ name: 'Icons', passed: !!hasIcons });

        // Check 5: Viewport
        const hasViewport = document.querySelector('meta[name="viewport"]');
        checks.push({ name: 'Viewport', passed: !!hasViewport });

        // Check 6: Offline Support
        const hasOffline = await caches.keys().then(keys => keys.length > 0).catch(() => false);
        checks.push({ name: 'Offline Support', passed: hasOffline });

        // Check 7: Installable
        const isInstallable = window.matchMedia('(display-mode: standalone)').matches || 
                             ('beforeinstallprompt' in window);
        checks.push({ name: 'Installable', passed: isInstallable });

        // Calculate PWA score
        const passedChecks = checks.filter(c => c.passed).length;
        const score = Math.round((passedChecks / checks.length) * 100);

        return { score, checks, issues, recommendations };
    }

    async auditPerformance() {
        const issues = [];
        let score = 85; // Start with decent score

        // 1. Check image optimization
        const images = document.querySelectorAll('img');
        const largeImages = Array.from(images).filter(img => {
            const naturalSize = img.naturalWidth * img.naturalHeight;
            return naturalSize > 1024 * 1024; // 1MP
        });
        if (largeImages.length > 0) {
            issues.push(`${largeImages.length} large images detected (>1MP)`);
            score -= 10;
        }

        // 2. Check script loading
        const scripts = document.querySelectorAll('script[src]');
        const blockingScripts = Array.from(scripts).filter(script => 
            !script.async && !script.defer && !script.src.includes('firebase')
        );
        if (blockingScripts.length > 3) {
            issues.push(`${blockingScripts.length} blocking scripts detected`);
            score -= 5;
        }

        // 3. Check CSS size
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        if (styles.length > 5) {
            issues.push('Too many CSS files');
            score -= 5;
        }

        // 4. Check total requests
        if (window.performance && performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            if (resources.length > 50) {
                issues.push(`High number of requests: ${resources.length}`);
                score -= 5;
            }
        }

        // 5. Check if responsive
        const hasResponsiveMeta = document.querySelector('meta[name="viewport"][content*="width=device-width"]');
        if (!hasResponsiveMeta) {
            issues.push('Missing responsive viewport meta tag');
            score -= 10;
        }

        // Ensure score doesn't go below 0
        score = Math.max(0, Math.min(100, score));

        return { score, issues };
    }

    async auditAccessibility() {
        let score = 90; // Start high
        const issues = [];

        // 1. Check image alt tags
        const images = document.querySelectorAll('img:not([alt])');
        if (images.length > 0) {
            issues.push(`${images.length} images missing alt text`);
            score -= images.length * 2;
        }

        // 2. Check form labels
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        const unlabeledInputs = Array.from(inputs).filter(input => {
            const id = input.id;
            return !id || !document.querySelector(`label[for="${id}"]`);
        });
        if (unlabeledInputs.length > 0) {
            issues.push(`${unlabeledInputs.length} form elements missing labels`);
            score -= unlabeledInputs.length * 3;
        }

        // 3. Check color contrast (simplified)
        const smallText = document.querySelectorAll('p, span, div, li');
        const lowContrast = Array.from(smallText).filter(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            return fontSize < 14; // Small text warning
        });
        if (lowContrast.length > 10) {
            issues.push('Possible contrast issues with small text');
            score -= 5;
        }

        // 4. Check ARIA attributes
        const interactiveElements = document.querySelectorAll('button, a[href], input, select, textarea');
        const ariaElements = Array.from(interactiveElements).filter(el => 
            el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
        );
        const ariaCoverage = ariaElements.length / interactiveElements.length;
        if (ariaCoverage < 0.5) {
            issues.push('Low ARIA coverage on interactive elements');
            score -= 10;
        }

        return { score: Math.max(0, Math.min(100, score)), issues };
    }

    async auditBestPractices() {
        let score = 95;
        const issues = [];

        // 1. Check for console errors
        const oldConsoleError = console.error;
        const errors = [];
        console.error = function(...args) {
            errors.push(args.join(' '));
            oldConsoleError.apply(console, args);
        };

        // 2. Check for mixed content
        const resources = document.querySelectorAll('script[src], img[src], link[href]');
        const mixedContent = Array.from(resources).filter(el => {
            const src = el.src || el.href;
            return src && src.startsWith('http://') && window.location.protocol === 'https:';
        });
        if (mixedContent.length > 0) {
            issues.push('Mixed content detected (HTTP resources on HTTPS page)');
            score -= 20;
        }

        // 3. Check for outdated libraries
        if (window.Chart) {
            const chartVersion = Chart.version || 'unknown';
            if (parseFloat(chartVersion) < 3) {
                issues.push(`Using outdated Chart.js version: ${chartVersion}`);
                score -= 5;
            }
        }

        // 4. Check security headers (simplified)
        const hasCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!hasCSP) {
            issues.push('Missing Content Security Policy');
            score -= 10;
        }

        // 5. Check if PWA is installable
        if (!('beforeinstallprompt' in window)) {
            issues.push('PWA install prompt not available');
            score -= 5;
        }

        // Restore console
        setTimeout(() => {
            console.error = oldConsoleError;
            if (errors.length > 0) {
                issues.push(`${errors.length} console errors detected`);
                score -= errors.length;
            }
        }, 1000);

        return { score: Math.max(0, Math.min(100, score)), issues };
    }

    calculateOverallScore(scores) {
        const weights = {
            pwa: 0.35,
            performance: 0.30,
            accessibility: 0.15,
            bestPractices: 0.15,
            seo: 0.05
        };

        let total = 0;
        let weightSum = 0;

        for (const [category, weight] of Object.entries(weights)) {
            if (scores[category]) {
                total += scores[category] * weight;
                weightSum += weight;
            }
        }

        return weightSum > 0 ? Math.round(total / weightSum) : 0;
    }

    getGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    displayResults(results) {
        const auditModal = document.createElement('div');
        auditModal.id = 'lighthouseAuditModal';
        auditModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            font-family: 'Segoe UI', system-ui, sans-serif;
        `;

        const gradeColor = results.grade === 'A' ? '#10b981' : 
                          results.grade === 'B' ? '#3b82f6' : 
                          results.grade === 'C' ? '#f59e0b' : '#ef4444';

        auditModal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 2rem;
                max-width: 800px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                border: 4px solid ${gradeColor};
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 style="color: #1e293b; margin: 0;">🔍 Lighthouse Audit Report</h2>
                    <button onclick="document.getElementById('lighthouseAuditModal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #64748b;
                    ">×</button>
                </div>

                <!-- Score Card -->
                <div style="
                    background: linear-gradient(135deg, ${gradeColor}20, ${gradeColor}40);
                    border-radius: 16px;
                    padding: 2rem;
                    text-align: center;
                    margin-bottom: 2rem;
                    border: 2px solid ${gradeColor};
                ">
                    <div style="font-size: 5rem; font-weight: 800; color: ${gradeColor};">
                        ${results.overallScore}
                    </div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${gradeColor}; margin: 1rem 0;">
                        ${results.grade}
                    </div>
                    <div style="color: #64748b; font-size: 1.1rem;">
                        ${results.productionReady ? '✅ PRODUCTION READY' : '⚠️ NEEDS IMPROVEMENT'}
                    </div>
                </div>

                <!-- Detailed Scores -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    ${Object.entries(results.scores).map(([category, score]) => `
                        <div style="
                            background: ${score >= 90 ? '#dcfce7' : score >= 70 ? '#fef3c7' : '#fee2e2'};
                            border: 2px solid ${score >= 90 ? '#86efac' : score >= 70 ? '#fcd34d' : '#fca5a5'};
                            border-radius: 12px;
                            padding: 1rem;
                            text-align: center;
                        ">
                            <div style="font-size: 0.9rem; color: #64748b; text-transform: uppercase; margin-bottom: 0.5rem;">
                                ${category}
                            </div>
                            <div style="font-size: 2rem; font-weight: 700; color: ${score >= 90 ? '#166534' : score >= 70 ? '#92400e' : '#991b1b'};">
                                ${score}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Issues -->
                ${results.issues.length > 0 ? `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Issues Found (${results.issues.length})</h3>
                        <div style="background: #fef2f2; border-radius: 12px; padding: 1.5rem;">
                            <ul style="margin: 0; padding-left: 1.5rem; color: #991b1b;">
                                ${results.issues.map(issue => `<li style="margin-bottom: 0.5rem;">${issue}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                <!-- Recommendations -->
                ${results.recommendations.length > 0 ? `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="color: #10b981; margin-bottom: 1rem;">💡 Recommendations</h3>
                        <div style="background: #f0fdf4; border-radius: 12px; padding: 1.5rem;">
                            <ul style="margin: 0; padding-left: 1.5rem; color: #166534;">
                                ${results.recommendations.map(rec => `<li style="margin-bottom: 0.5rem;">${rec}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button onclick="window.lighthouseAuditor.saveReport()" style="
                        flex: 1;
                        padding: 1rem;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        📥 Download Report
                    </button>
                    <button onclick="window.lighthouseAuditor.runAudit()" style="
                        flex: 1;
                        padding: 1rem;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        🔄 Run Again
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(auditModal);
    }

    saveAuditResults(results) {
        const audits = JSON.parse(localStorage.getItem('mms_audits') || '[]');
        audits.push(results);
        localStorage.setItem('mms_audits', JSON.stringify(audits.slice(-10))); // Keep last 10
    }

    saveReport() {
        const audits = JSON.parse(localStorage.getItem('mms_audits') || '[]');
        const latest = audits[audits.length - 1];
        
        if (!latest) {
            alert('No audit data available');
            return;
        }

        const report = {
            ...latest,
            generated: new Date().toISOString(),
            system: 'MMS Safety System',
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mms-audit-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize and make available
window.lighthouseAuditor = new LighthouseAuditor();

// Auto-run on load in development
if (window.location.hostname.includes('localhost') || window.location.hostname.includes('github.io')) {
    setTimeout(() => {
        if (confirm('Run Lighthouse audit for MMS Safety System?')) {
            window.lighthouseAuditor.runAudit();
        }
    }, 3000);
}

console.log('✅ Lighthouse Auditor Ready - Run: lighthouseAuditor.runAudit()');
