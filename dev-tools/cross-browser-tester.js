// Cross-Browser Compatibility Tester - MMS Safety
class CrossBrowserTester {
    constructor() {
        this.browsers = {
            chrome: { name: 'Chrome', supported: true },
            firefox: { name: 'Firefox', supported: true },
            safari: { name: 'Safari', supported: true },
            edge: { name: 'Edge', supported: true },
            opera: { name: 'Opera', supported: true },
            samsung: { name: 'Samsung Internet', supported: true },
            ie: { name: 'Internet Explorer', supported: false }
        };
        
        this.features = [
            { name: 'Service Worker', test: () => 'serviceWorker' in navigator },
            { name: 'Push Notifications', test: () => 'Notification' in window },
            { name: 'IndexedDB', test: () => 'indexedDB' in window },
            { name: 'Web Storage', test: () => 'localStorage' in window },
            { name: 'Fetch API', test: () => 'fetch' in window },
            { name: 'CSS Grid', test: () => CSS.supports('display', 'grid') },
            { name: 'Flexbox', test: () => CSS.supports('display', 'flex') },
            { name: 'ES6 Modules', test: () => 'noModule' in HTMLScriptElement.prototype },
            { name: 'Web Components', test: () => 'customElements' in window },
            { name: 'Web Share API', test: () => 'share' in navigator }
        ];
    }

    detectBrowser() {
        const userAgent = navigator.userAgent;
        let browser = 'unknown';
        
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'chrome';
        else if (userAgent.includes('Firefox')) browser = 'firefox';
        else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'safari';
        else if (userAgent.includes('Edg')) browser = 'edge';
        else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'opera';
        else if (userAgent.includes('SamsungBrowser')) browser = 'samsung';
        else if (userAgent.includes('Trident') || userAgent.includes('MSIE')) browser = 'ie';
        
        return {
            name: this.browsers[browser]?.name || 'Unknown',
            version: this.getBrowserVersion(userAgent, browser),
            supported: this.browsers[browser]?.supported || false,
            code: browser
        };
    }

    getBrowserVersion(ua, browser) {
        const regexMap = {
            chrome: /Chrome\/(\d+)/,
            firefox: /Firefox\/(\d+)/,
            safari: /Version\/(\d+)/,
            edge: /Edg\/(\d+)/,
            opera: /(?:Opera|OPR)\/(\d+)/
        };
        
        const match = ua.match(regexMap[browser]);
        return match ? match[1] : 'unknown';
    }

    testFeatures() {
        return this.features.map(feature => ({
            name: feature.name,
            supported: feature.test(),
            critical: ['Service Worker', 'Web Storage', 'Fetch API'].includes(feature.name)
        }));
    }

    testPWAFeatures() {
        const tests = [
            { name: 'Installable', test: () => 'beforeinstallprompt' in window },
            { name: 'Standalone Mode', test: () => window.matchMedia('(display-mode: standalone)').matches },
            { name: 'Add to Home Screen', test: () => window.navigator.standalone !== undefined },
            { name: 'Offline Support', test: async () => {
                try {
                    const caches = await window.caches?.keys();
                    return Array.isArray(caches) && caches.length > 0;
                } catch {
                    return false;
                }
            }},
            { name: 'Background Sync', test: () => 'serviceWorker' in navigator && 'SyncManager' in window }
        ];

        return Promise.all(tests.map(async test => ({
            name: test.name,
            supported: await test.test()
        })));
    }

    async runCompatibilityTest() {
        console.log('🔍 Running cross-browser compatibility test...');
        
        const browser = this.detectBrowser();
        const features = this.testFeatures();
        const pwaFeatures = await this.testPWAFeatures();
        
        const results = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            browser: browser,
            features: {
                all: features,
                supported: features.filter(f => f.supported).length,
                total: features.length,
                score: Math.round((features.filter(f => f.supported).length / features.length) * 100)
            },
            pwaFeatures: {
                all: pwaFeatures,
                supported: pwaFeatures.filter(f => f.supported).length,
                total: pwaFeatures.length,
                score: Math.round((pwaFeatures.filter(f => f.supported).length / pwaFeatures.length) * 100)
            },
            recommendations: []
        };

        // Generate recommendations
        if (!browser.supported) {
            results.recommendations.push(`Upgrade from ${browser.name} to a supported browser`);
        }

        const criticalFailures = features.filter(f => f.critical && !f.supported);
        if (criticalFailures.length > 0) {
            results.recommendations.push(`Fix critical features: ${criticalFailures.map(f => f.name).join(', ')}`);
        }

        if (results.pwaFeatures.score < 80) {
            results.recommendations.push('Improve PWA feature support for better mobile experience');
        }

        // Calculate overall compatibility
        results.overallScore = Math.round(
            (results.features.score * 0.6) + (results.pwaFeatures.score * 0.4)
        );
        results.compatible = results.overallScore >= 80 && browser.supported;

        this.displayResults(results);
        this.saveResults(results);

        return results;
    }

    displayResults(results) {
        const modal = document.createElement('div');
        modal.id = 'browserTestModal';
        modal.style.cssText = `
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

        const scoreColor = results.overallScore >= 90 ? '#10b981' :
                          results.overallScore >= 70 ? '#f59e0b' : '#ef4444';

        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 2rem;
                max-width: 800px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                border: 4px solid ${scoreColor};
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 style="color: #1e293b; margin: 0;">🌐 Browser Compatibility</h2>
                    <button onclick="document.getElementById('browserTestModal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #64748b;
                    ">×</button>
                </div>

                <!-- Browser Info -->
                <div style="
                    background: ${results.browser.supported ? '#f0fdf4' : '#fef2f2'};
                    border-radius: 16px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    border: 2px solid ${results.browser.supported ? '#86efac' : '#fca5a5'};
                ">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="
                            width: 60px;
                            height: 60px;
                            background: ${results.browser.supported ? '#10b981' : '#ef4444'};
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 1.5rem;
                            font-weight: bold;
                        ">
                            ${this.getBrowserIcon(results.browser.code)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 1.25rem; font-weight: 600; color: #1e293b;">
                                ${results.browser.name} ${results.browser.version}
                            </div>
                            <div style="color: #64748b;">
                                ${results.browser.supported ? '✅ Supported Browser' : '❌ Unsupported Browser'}
                            </div>
                        </div>
                        <div style="
                            font-size: 2rem;
                            font-weight: 700;
                            color: ${scoreColor};
                        ">
                            ${results.overallScore}%
                        </div>
                    </div>
                </div>

                <!-- Feature Support -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="color: #1e293b; margin-bottom: 1rem;">📋 Feature Support (${results.features.supported}/${results.features.total})</h3>
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 0.75rem;
                    ">
                        ${results.features.all.map(feature => `
                            <div style="
                                background: ${feature.supported ? '#f0fdf4' : '#fef2f2'};
                                border: 1px solid ${feature.supported ? '#86efac' : '#fca5a5'};
                                border-radius: 10px;
                                padding: 1rem;
                                display: flex;
                                align-items: center;
                                gap: 0.75rem;
                            ">
                                <div style="
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 8px;
                                    background: ${feature.supported ? '#10b981' : '#ef4444'};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 1rem;
                                ">
                                    ${feature.supported ? '✓' : '✗'}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #1e293b;">${feature.name}</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">
                                        ${feature.supported ? 'Supported' : 'Not supported'}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- PWA Features -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="color: #1e293b; margin-bottom: 1rem;">📱 PWA Features (${results.pwaFeatures.supported}/${results.pwaFeatures.total})</h3>
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 0.75rem;
                    ">
                        ${results.pwaFeatures.all.map(feature => `
                            <div style="
                                background: ${feature.supported ? '#f0fdf4' : '#fef2f2'};
                                border: 1px solid ${feature.supported ? '#86efac' : '#fca5a5'};
                                border-radius: 10px;
                                padding: 1rem;
                                display: flex;
                                align-items: center;
                                gap: 0.75rem;
                            ">
                                <div style="
                                    width: 32px;
                                    height: 32px;
                                    border-radius: 8px;
                                    background: ${feature.supported ? '#10b981' : '#ef4444'};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 1rem;
                                ">
                                    ${feature.supported ? '✓' : '✗'}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #1e293b;">${feature.name}</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">
                                        ${feature.supported ? 'Available' : 'Not available'}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Recommendations -->
                ${results.recommendations.length > 0 ? `
                    <div style="
                        background: #fffbeb;
                        border-radius: 12px;
                        padding: 1.5rem;
                        margin-bottom: 2rem;
                        border: 2px solid #fcd34d;
                    ">
                        <h3 style="color: #92400e; margin-bottom: 1rem;">💡 Recommendations</h3>
                        <ul style="margin: 0; padding-left: 1.5rem; color: #92400e;">
                            ${results.recommendations.map(rec => `<li style="margin-bottom: 0.5rem;">${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div style="display: flex; gap: 1rem;">
                    <button onclick="window.browserTester.runCompatibilityTest()" style="
                        flex: 1;
                        padding: 1rem;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        🔄 Test Again
                    </button>
                    <button onclick="window.browserTester.exportResults()" style="
                        flex: 1;
                        padding: 1rem;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        📥 Export Results
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    getBrowserIcon(browserCode) {
        const icons = {
            chrome: 'C',
            firefox: 'F',
            safari: 'S',
            edge: 'E',
            opera: 'O',
            samsung: 'SI',
            ie: 'IE'
        };
        return icons[browserCode] || '?';
    }

    saveResults(results) {
        const tests = JSON.parse(localStorage.getItem('mms_browser_tests') || '[]');
        tests.push(results);
        localStorage.setItem('mms_browser_tests', JSON.stringify(tests.slice(-5))); // Keep last 5
    }

    exportResults() {
        const tests = JSON.parse(localStorage.getItem('mms_browser_tests') || '[]');
        if (tests.length === 0) {
            alert('No test results available');
            return;
        }

        const report = {
            generated: new Date().toISOString(),
            system: 'MMS Safety System',
            url: window.location.href,
            tests: tests
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mms-browser-tests-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize
window.browserTester = new CrossBrowserTester();

// Auto-run in development
if (window.location.hostname.includes('localhost') || window.location.hostname.includes('github.io')) {
    setTimeout(() => {
        if (confirm('Test browser compatibility for MMS Safety System?')) {
            window.browserTester.runCompatibilityTest();
        }
    }, 4000);
}

console.log('✅ Cross-Browser Tester Ready - Run: browserTester.runCompatibilityTest()');
