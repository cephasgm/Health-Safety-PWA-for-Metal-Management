# MMS Health & Safety PWA

A Progressive Web App for managing Health & Safety operations across Metal Management Solutions locations.

## Features

### 🏗️ Core Features
- **Incident Management** - Report, track, and investigate workplace incidents
- **PPE Management** - Track personal protective equipment
- **Risk Assessment** - Interactive risk matrix with color coding
- **Training Management** - Safety training records and certifications
- **Audit & Inspection** - Schedule and conduct safety audits
- **Standards Compliance** - ISO/NEBOSH/OSHA standards tracking
- **Contractor Safety** - Contractor compliance management
- **Employee Health** - Medical surveillance and records

### 📱 PWA Features
- **Installable** - Install as a native app on any device
- **Offline Support** - Work without internet connection
- **Push Notifications** - Get safety alerts and updates
- **Background Sync** - Sync data when back online
- **Fast Loading** - Instant loading with service worker caching
- **Responsive Design** - Works on mobile, tablet, and desktop

## Installation

### As a Web App
1. Visit the app URL in your browser
2. Look for the "Install" button in the header or sidebar
3. Click "Install" to add to your home screen/app drawer

### Development Setup
1. Clone the repository
2. Ensure all files are in the same directory:
index.html
manifest.json
pwa-init.js
sw.js
offline.html
icon-*.png (various sizes)

text
3. Serve via HTTPS (required for PWA features)
4. Open in a modern browser (Chrome, Edge, Safari)

## File Structure
Health-Safety-PWA-for-Metal-Management/
├── index.html # Main application
├── manifest.json # PWA manifest
├── pwa-init.js # PWA installation handler
├── sw.js # Service worker
├── offline.html # Offline fallback page
├── README.md # This file
└── icons/
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192.png
├── icon-192x192.png
├── icon-384x384.png
├── icon-512.png
└── icon-512x512.png

text

## Browser Support

- ✅ Chrome 40+
- ✅ Edge 17+
- ✅ Firefox 44+
- ✅ Safari 11.1+
- ✅ iOS Safari 11.3+
- ✅ Samsung Internet 4+

## PWA Testing

### Testing Installation
1. Open Chrome DevTools (F12)
2. Go to **Application** tab → **Manifest**
3. Click "Add to homescreen" to test installation
4. Check service worker registration in **Service Workers** section

### Lighthouse Audit
1. Open Chrome DevTools (F12)
2. Go to **Lighthouse** tab
3. Run audit for PWA, Performance, Accessibility, etc.
4. Target score: 90+ for PWA

## Deployment

### Requirements
- HTTPS connection (mandatory for PWA)
- Correct MIME types for files
- All icon sizes available
- Service worker registered correctly

### Steps
1. Upload all files to web server
2. Ensure HTTPS is enabled
3. Test installation on different devices
4. Verify offline functionality
5. Test push notifications (requires server setup)

## Troubleshooting

### Installation Not Showing
1. Ensure you're visiting via HTTPS
2. Check manifest.json is correctly linked
3. Verify service worker is registered (check DevTools)
4. Clear browser cache and reload

### Offline Not Working
1. Check service worker registration
2. Verify assets are being cached
3. Check console for service worker errors
4. Ensure fetch event is handling requests

### Push Notifications Not Working
1. Requires server-side implementation
2. Check browser permissions
3. Verify service worker is active
4. Test with a push notification service

## Security Considerations

- All data stored locally in browser
- No sensitive data should be hardcoded
- HTTPS required for PWA features
- Regular security audits recommended
- Data backup functionality included

## Updates

When updating the app:
1. Update version in service worker (CACHE_NAME)
2. Update manifest.json if needed
3. Clear old service worker caches
4. Test installation flow

## License

© 2026 Metal Management Solutions. All rights reserved.

## Contact

For support or questions, contact the Health & Safety department.
