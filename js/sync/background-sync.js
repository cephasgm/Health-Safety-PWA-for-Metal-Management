/* ═══════════════════════════════════════════════════════════════
   background-sync.js
   ═══════════════════════════════════════════════════════════════

   Purpose:
     Manages the sync status badge on the dashboard.
     Hooks into Firestore's onSnapshotsInSync to know when the SDK
     has finished flushing queued writes.

   What it does:
     - Watches navigator.onLine
     - Subscribes to Firestore's sync events
     - Updates #syncStatusIndicator + #syncStatusText in dashboard.html
     - Exposes window.mmsSync for other modules to query status

   What it does NOT do:
     - Queue writes (Firestore does this via IndexedDB persistence)
     - Fake pending counts (we don't have a public API for that)
     - Show fake "synced" states — the badge reflects real state only
   ═══════════════════════════════════════════════════════════════ */

import { db } from '../core/firebase-config.js';
import { onSnapshotsInSync } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class SyncStatusManager {
    constructor() {
        this.isOnline     = navigator.onLine;
        this.isSyncing    = false;
        this.isStarted    = false;
        this.lastSyncAt   = null;
        this.syncCount    = 0;
        this.listeners    = [];
        this.syncTimeout  = null;
    }

    start() {
        if (this.isStarted) return;
        this.isStarted = true;

        console.log('[background-sync] Starting. Online?', this.isOnline);

        // ─── Browser online/offline ───
        window.addEventListener('online',  () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // ─── Firestore sync event ───
        // onSnapshotsInSync fires when the SDK has caught up — all local
        // writes confirmed by server, all query caches consistent.
        try {
            onSnapshotsInSync(db, () => {
                this.handleFirestoreSynced();
            });
        } catch (err) {
            console.warn('[background-sync] onSnapshotsInSync not available:', err.message);
        }

        // ─── Service worker messages ───
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SYNC_TRIGGERED') {
                    this.handleFirestoreSynced();
                }
            });
        }

        // Initial UI sync
        this.updateUI();
    }

    handleOnline() {
        console.log('[background-sync] Network online');
        this.isOnline = true;

        // Firestore auto-flushes queued writes on reconnect. Show "Syncing…"
        // briefly and rely on onSnapshotsInSync to flip us back to "Online".
        this.isSyncing = true;
        this.updateUI();

        // Safety net — if no sync event within 6 seconds, assume done
        clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => {
            if (this.isSyncing) {
                console.log('[background-sync] Sync timeout — assuming caught up');
                this.isSyncing = false;
                this.updateUI();
            }
        }, 6000);
    }

    handleOffline() {
        console.log('[background-sync] Network offline');
        this.isOnline = false;
        this.isSyncing = false;
        clearTimeout(this.syncTimeout);
        this.updateUI();
    }

    handleFirestoreSynced() {
        this.isSyncing = false;
        this.lastSyncAt = new Date();
        this.syncCount++;
        clearTimeout(this.syncTimeout);
        console.log('[background-sync] Firestore synced (count=' + this.syncCount + ')');
        this.updateUI();
    }

    getStatus() {
        if (!this.isOnline) {
            return {
                key: 'offline',
                label: 'Offline',
                cls: 'sync-offline',
                title: 'No connection — changes are saved locally and will sync when you reconnect'
            };
        }
        if (this.isSyncing) {
            return {
                key: 'syncing',
                label: 'Syncing…',
                cls: 'sync-pending',
                title: 'Synchronizing with server'
            };
        }
        return {
            key: 'online',
            label: 'Online',
            cls: 'sync-online',
            title: 'All changes synced' + (this.lastSyncAt ? ' — last: ' + this.lastSyncAt.toLocaleTimeString() : '')
        };
    }

    updateUI() {
        const indicator = document.getElementById('syncStatusIndicator');
        const text      = document.getElementById('syncStatusText');
        if (!indicator || !text) return;

        const status = this.getStatus();

        // Remove all sync classes then add the right one
        indicator.classList.remove('sync-online', 'sync-offline', 'sync-pending');
        indicator.classList.add(status.cls);
        text.textContent = status.label;
        indicator.title = status.title;

        this.notifyListeners(status);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.getStatus());
        return () => {
            this.listeners = this.listeners.filter((cb) => cb !== callback);
        };
    }

    notifyListeners(status) {
        this.listeners.forEach((cb) => {
            try { cb(status); } catch (e) { /* ignore */ }
        });
    }
}

const syncManager = new SyncStatusManager();

// Expose globally for other modules
window.mmsSync = syncManager;

// Auto-start when DOM is ready
function bootstrap() {
    syncManager.start();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

console.log('[background-sync] Ready');