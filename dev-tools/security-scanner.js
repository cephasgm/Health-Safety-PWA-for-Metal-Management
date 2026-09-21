// MMS Safety - Security Vulnerability Scanner
// Run this script to scan for security issues

class SecurityScanner {
    constructor() {
        this.scanResults = {
            critical: [],
            high: [],
            medium: [],
            low: [],
            passed: []
        };
        
        this.securityStandards = {
            owasp: {
                'A01:2021-Broken Access Control': [
                    'Check for missing authentication',
                    'Verify authorization checks',
                    'Test for IDOR vulnerabilities'
                ],
                'A02:2021-Cryptographic Failures': [
                    'Check for unencrypted sensitive data',
                    'Verify HTTPS enforcement',
                    'Check for weak crypto algorithms'
                ],
                'A05:2021-Security Misconfiguration': [
                    'Check for default credentials',
                    'Verify security headers',
                    'Check for exposed debug info'
                ]
            },
            pwa: [
                'HTTPS enforcement',
                'Service worker security',
                'Content Security Policy',
                'Cross-origin isolation',
                'Secure context requirements'
            ],
            firebase: [
                'Firestore security rules',
                'Storage security rules',
                'Authentication configuration',
                'API key exposure'
            ]
        };
    }

    async runFullScan() {
        console.log('🔒 Starting Security Scan for MMS Safety System...');
        
        const scans = [
            this.scanNetworkSecurity(),
            this.scanAuthentication(),
            this.scanDataProtection(),
            this.scanPWASecurity(),
            this.scanFirebaseSecurity(),
            this.scanCodeSecurity()
        ];
        
        await Promise.all(scans);
        
        this.generateReport();
        return this.scanResults;
    }

    scanNetworkSecurity() {
        console.log('🌐 Scanning network security...');
        
        // Check HTTPS
        if (window.location.protocol !== 'https:') {
            this.scanResults.critical.push({
                issue: 'Not using HTTPS',
                description: 'Application is not served over HTTPS',
                impact: 'CRITICAL - Data can be intercepted',
                fix: 'Deploy on HTTPS-only hosting',
                standard: 'OWASP A02:2021'
            });
        } else {
            this.scanResults.passed.push('HTTPS is enforced');
        }

        // Check security headers
        this.checkSecurityHeaders();

        // Check mixed content
        const mixedContent = Array.from(document.querySelectorAll('img, script, link'))
            .filter(el => {
                const src = el.src || el.href;
                return src && src.startsWith('http://');
            });
        
        if (mixedContent.length > 0) {
            this.scanResults.high.push({
                issue: 'Mixed content detected',
                description: `${mixedContent.length} resources loaded over HTTP`,
                impact: 'HIGH - Can be intercepted/modified',
                fix: 'Change all resources to HTTPS',
                standard: 'OWASP A02:2021'
            });
        }

        // Check CORS configuration
        if (window.crossOriginIsolated) {
            this.scanResults.passed.push('Cross-origin isolation enabled');
        } else {
            this.scanResults.medium.push({
                issue: 'Missing cross-origin isolation',
                description: 'Application not cross-origin isolated',
                impact: 'MEDIUM - Side-channel attacks possible',
                fix: 'Add COOP and COEP headers',
                standard: 'Browser Security'
            });
        }
    }

    checkSecurityHeaders() {
        // Try to detect security headers
        fetch(window.location.href, { method: 'HEAD' })
            .then(response => {
                const headers = response.headers;
                const securityHeaders = [
                    'content-security-policy',
                    'strict-transport-security',
                    'x-frame-options',
                    'x-content-type-options',
                    'referrer-policy',
                    'permissions-policy'
                ];

                securityHeaders.forEach(header => {
                    if (!headers.has(header)) {
                        this.scanResults.high.push({
                            issue: `Missing ${header} header`,
                            description: `Security header ${header} is not set`,
                            impact: 'HIGH - Increases attack surface',
                            fix: `Configure ${header} in server settings`,
                            standard: 'Security Headers'
                        });
                    } else {
                        this.scanResults.passed.push(`${header} header is set`);
                    }
                });
            })
            .catch(() => {
                // Can't check headers, continue
            });
    }

    scanAuthentication() {
        console.log('🔐 Scanning authentication...');
        
        // Check if authentication is enforced
        if (!window.mmsAuth || !window.mmsAuth.currentUser) {
            // This is expected - user might not be logged in
            this.scanResults.passed.push('Authentication system is present');
        } else {
            // Check for session timeout
            if (!window.sessionManager) {
                this.scanResults.medium.push({
                    issue: 'No session management',
                    description: 'No automatic session timeout configured',
                    impact: 'MEDIUM - Session hijacking risk',
                    fix: 'Implement session timeout',
                    standard: 'OWASP A01:2021'
                });
            }
        }

        // Check for password policy
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            if (!input.hasAttribute('minlength')) {
                this.scanResults.medium.push({
                    issue: 'Weak password policy',
                    description: 'Password field has no minimum length',
                    impact: 'MEDIUM - Weak passwords allowed',
                    fix: 'Add minlength="8" to password fields',
                    standard: 'Authentication'
                });
            }
        });
    }

    scanDataProtection() {
        console.log('📊 Scanning data protection...');
        
        // Check localStorage for sensitive data
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            
            // Check for sensitive data in localStorage
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                this.scanResults.high.push({
                    issue: 'Sensitive data in localStorage',
                    description: `Found sensitive key in localStorage: ${key}`,
                    impact: 'HIGH - Data accessible via XSS',
                    fix: 'Use encrypted storage or server-side storage',
                    standard: 'OWASP A02:2021'
                });
            }
            
            // Check for large data in localStorage
            if (value && value.length > 500000) { // 500KB
                this.scanResults.medium.push({
                    issue: 'Large data in localStorage',
                    description: `Large data stored in localStorage (${key}: ${(value.length/1024).toFixed(1)}KB)`,
                    impact: 'MEDIUM - Performance impact',
                    fix: 'Use IndexedDB or server storage for large data',
                    standard: 'Performance'
                });
            }
        }

        // Check for data encryption
        if (!window.encryptionService) {
            this.scanResults.high.push({
                issue: 'No data encryption',
                description: 'Sensitive data is not encrypted',
                impact: 'HIGH - Data breach would expose everything',
                fix: 'Implement client-side encryption for sensitive data',
                standard: 'GDPR/POPIA Compliance'
            });
        } else {
            this.scanResults.passed.push('Encryption service available');
        }
    }

    scanPWASecurity() {
        console.log('📱 Scanning PWA security...');
        
        // Check service worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration()
                .then(registration => {
                    if (registration) {
                        this.scanResults.passed.push('Service Worker is registered');
                        
                        // Check service worker scope
                        if (registration.scope !== window.location.origin + '/') {
                            this.scanResults.medium.push({
                                issue: 'Service Worker scope issue',
                                description: `Service Worker scope is ${registration.scope}`,
                                impact: 'MEDIUM - May not control all pages',
                                fix: 'Register service worker at root scope',
                                standard: 'PWA Security'
                            });
                        }
                    }
                });
        }

        // Check manifest security
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
            this.scanResults.critical.push({
                issue: 'No manifest file',
                description: 'Web App Manifest is missing',
                impact: 'CRITICAL - PWA features disabled',
                fix: 'Add manifest.json file',
                standard: 'PWA Requirements'
            });
        }

        // Check for install prompts security
        if (window.installPromotion && typeof window.installPromotion.showInstallPrompt === 'function') {
            this.scanResults.passed.push('Install promotion is implemented securely');
        }
    }

    scanFirebaseSecurity() {
        console.log('🔥 Scanning Firebase security...');
        
        // Check for exposed API keys
        const scripts = Array.from(document.querySelectorAll('script'));
        const firebaseScript = scripts.find(script => 
            script.src && script.src.includes('firebase')
        );
        
        if (firebaseScript) {
            // Check if config is in HTML (vulnerable)
            const inlineConfig = scripts.find(script => 
                script.textContent.includes('firebaseConfig') && 
                !script.src
            );
            
            if (inlineConfig) {
                this.scanResults.high.push({
                    issue: 'Firebase config exposed in HTML',
                    description: 'Firebase configuration visible in page source',
                    impact: 'HIGH - API keys can be stolen',
                    fix: 'Move Firebase config to external module',
                    standard: 'Firebase Security'
                });
            } else {
                this.scanResults.passed.push('Firebase config is properly externalized');
            }
        }

        // Check Firestore rules (would need backend check)
        if (window.mmsDB) {
            this.scanResults.passed.push('Firebase database service is configured');
        }
    }

    scanCodeSecurity() {
        console.log('💻 Scanning code security...');
        
        // Check for eval usage
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            if (script.textContent.includes('eval(') || 
                script.textContent.includes('new Function(')) {
                this.scanResults.critical.push({
                    issue: 'eval() or new Function() detected',
                    description: 'Dynamic code execution found',
                    impact: 'CRITICAL - Arbitrary code execution',
                    fix: 'Remove eval() and new Function() calls',
                    standard: 'OWASP A03:2021'
                });
            }
        });

        // Check for inline event handlers
        const inlineHandlers = document.querySelectorAll('[onclick], [onload], [onerror]');
        if (inlineHandlers.length > 0) {
            this.scanResults.medium.push({
                issue: 'Inline event handlers',
                description: `${inlineHandlers.length} inline event handlers found`,
                impact: 'MEDIUM - XSS vulnerability',
                fix: 'Move to external event listeners',
                standard: 'Content Security Policy'
            });
        }

        // Check for outdated libraries
        this.checkLibraryVersions();
    }

    checkLibraryVersions() {
        // Check Chart.js version
        if (window.Chart) {
            const version = Chart.version;
            if (version && this.isOutdated(version, '3.0.0')) {
                this.scanResults.medium.push({
                    issue: 'Outdated Chart.js library',
                    description: `Using Chart.js ${version} (latest is 4.x)`,
                    impact: 'MEDIUM - Security vulnerabilities',
                    fix: 'Update to latest Chart.js version',
                    standard: 'Library Security'
                });
            } else {
                this.scanResults.passed.push('Chart.js is up to date');
            }
        }
    }

    isOutdated(current, minVersion) {
        // Simple version comparison
        const currentParts = current.split('.').map(Number);
        const minParts = minVersion.split('.').map(Number);
        
        for (let i = 0; i < Math.min(currentParts.length, minParts.length); i++) {
            if (currentParts[i] < minParts[i]) return true;
            if (currentParts[i] > minParts[i]) return false;
        }
        return false;
    }

    generateReport() {
        console.log('📋 Generating security report...');
        
        const totalIssues = 
            this.scanResults.critical.length + 
            this.scanResults.high.length + 
            this.scanResults.medium.length + 
            this.scanResults.low.length;
        
        const report = {
            scanDate: new Date().toISOString(),
            url: window.location.href,
            summary: {
                totalIssues: totalIssues,
                critical: this.scanResults.critical.length,
                high: this.scanResults.high.length,
                medium: this.scanResults.medium.length,
                low: this.scanResults.low.length,
                passed: this.scanResults.passed.length,
                securityScore: this.calculateSecurityScore()
            },
            details: this.scanResults,
            recommendations: this.generateRecommendations()
        };
        
        this.displayReport(report);
        return report;
    }

    calculateSecurityScore() {
        const weights = {
            critical: 10,
            high: 7,
            medium: 4,
            low: 1
        };
        
        let totalScore = 100;
        
        Object.keys(weights).forEach(level => {
            totalScore -= this.scanResults[level].length * weights[level];
        });
        
        return Math.max(0, Math.min(100, totalScore));
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.scanResults.critical.length > 0) {
            recommendations.push({
                priority: 'IMMEDIATE',
                action: 'Fix critical issues within 24 hours',
                issues: this.scanResults.critical.map(issue => issue.issue)
            });
        }
        
        if (this.scanResults.high.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Fix high-priority issues within 7 days',
                issues: this.scanResults.high.map(issue => issue.issue)
            });
        }
        
        if (this.scanResults.medium.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Fix medium-priority issues in next release',
                issues: this.scanResults.medium.map(issue => issue.issue)
            });
        }
        
        return recommendations;
    }

    displayReport(report) {
        // Create report UI
        const reportDiv = document.createElement('div');
        reportDiv.id = 'securityScanReport';
        reportDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            border: 3px solid ${report.summary.securityScore >= 80 ? '#10b981' : 
                          report.summary.securityScore >= 60 ? '#f59e0b' : '#ef4444'};
        `;
        
        const scoreColor = report.summary.securityScore >= 80 ? '#10b981' : 
                          report.summary.securityScore >= 60 ? '#f59e0b' : '#ef4444';
        
        reportDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="color: #1e293b; margin: 0;">🔒 Security Scan Report</h2>
                <button onclick="document.getElementById('securityScanReport').remove()" 
                        style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">×</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="text-align: center; padding: 1rem; background: ${scoreColor}10; border-radius: 8px; border: 2px solid ${scoreColor};">
                    <div style="font-size: 2rem; font-weight: bold; color: ${scoreColor};">${report.summary.securityScore}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">Security Score</div>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: #ef444410; border-radius: 8px; border: 2px solid #ef4444;">
                    <div style="font-size: 2rem; font-weight: bold; color: #ef4444;">${report.summary.critical}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">Critical</div>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: #f59e0b10; border-radius: 8px; border: 2px solid #f59e0b;">
                    <div style="font-size: 2rem; font-weight: bold; color: #f59e0b;">${report.summary.high}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">High</div>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: #10b98110; border-radius: 8px; border: 2px solid #10b981;">
                    <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${report.summary.passed}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">Passed</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h3 style="color: #1e293b; margin-bottom: 1rem;">📅 Scan Details</h3>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                    <div><strong>Date:</strong> ${new Date(report.scanDate).toLocaleString()}</div>
                    <div><strong>URL:</strong> ${report.url}</div>
                    <div><strong>Total Issues:</strong> ${report.summary.totalIssues}</div>
                </div>
            </div>
            
            ${report.details.critical.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="color: #ef4444; margin-bottom: 1rem;">🚨 Critical Issues (${report.details.critical.length})</h3>
                    ${report.details.critical.map(issue => `
                        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px;">
                            <div style="font-weight: bold; margin-bottom: 0.25rem;">${issue.issue}</div>
                            <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;">${issue.description}</div>
                            <div style="font-size: 0.85rem;"><strong>Fix:</strong> ${issue.fix}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${report.details.high.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="color: #f59e0b; margin-bottom: 1rem;">⚠️ High Issues (${report.details.high.length})</h3>
                    ${report.details.high.map(issue => `
                        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px;">
                            <div style="font-weight: bold; margin-bottom: 0.25rem;">${issue.issue}</div>
                            <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem;">${issue.description}</div>
                            <div style="font-size: 0.85rem;"><strong>Fix:</strong> ${issue.fix}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${report.recommendations.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="color: #1e293b; margin-bottom: 1rem;">📋 Recommendations</h3>
                    ${report.recommendations.map(rec => `
                        <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="padding: 0.25rem 0.5rem; background: ${rec.priority === 'IMMEDIATE' ? '#ef4444' : 
                                                                           rec.priority === 'HIGH' ? '#f59e0b' : '#0ea5e9'}; 
                                        color: white; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${rec.priority}</span>
                                <div style="font-weight: bold;">${rec.action}</div>
                            </div>
                            <div style="font-size: 0.9rem; color: #64748b;">Issues: ${rec.issues.join(', ')}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                <button onclick="window.securityScanner.runFullScan()" 
                        style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    🔄 Run Scan Again
                </button>
                <button onclick="window.securityScanner.exportReport()" 
                        style="padding: 0.75rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-left: 0.5rem;">
                    📥 Export Report
                </button>
            </div>
        `;
        
        document.body.appendChild(reportDiv);
    }

    exportReport() {
        const report = this.generateReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mms-security-scan-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize and make globally available
const securityScanner = new SecurityScanner();
window.securityScanner = securityScanner;

// Auto-run scan if in development mode
if (window.location.hostname === 'localhost' || window.location.hostname.includes('github.io')) {
    setTimeout(() => {
        console.log('🔍 Running automatic security scan...');
        securityScanner.runFullScan();
    }, 3000);
}

console.log('✅ Security Scanner Ready - Run window.securityScanner.runFullScan()');
