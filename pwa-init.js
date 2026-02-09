// PWA Installation
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
  document.getElementById('sidebarInstallBtn').style.display = 'block';
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
  }
}

window.installPWA = installPWA;
