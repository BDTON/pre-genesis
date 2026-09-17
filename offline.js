// Offline release management. A downloaded update waits for the player to
// press Update, and only proceeds after the game confirms the save is stored.
let requestedUpdate = false;
let reloading = false;

const UPDATE_LABEL = '<svg class="icon" aria-hidden="true" focusable="false"><use href="assets/icons.svg#update"></use></svg><span>Update</span>';

function notify(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList?.add('show');
}

function offerUpdate(registration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) return;
  let button = document.getElementById('install-update');
  if (!button) {
    button = document.createElement('button');
    button.id = 'install-update';
    button.type = 'button';
    button.className = 'btn btn-secondary update-button';
    button.title = 'Install the new version';
    document.body.append(button);
  }
  button.innerHTML = UPDATE_LABEL;
  button.onclick = () => {
    if (!registration.waiting) { button.remove(); return; }
    if (!window.dispatchEvent(new Event('pre-genesis:before-update', {cancelable: true}))) return;
    requestedUpdate = true;
    button.disabled = true;
    notify('Saving and updating…');
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
  };
}

// Native builds ship their files inside the app, so no service worker is used.
if (!globalThis.PREGENESIS_NATIVE && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requestedUpdate && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then(registration => {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') offerUpdate(registration); });
    });
    navigator.serviceWorker.ready.then(() => offerUpdate(registration));
    offerUpdate(registration);
  }).catch(error => console.warn('Offline play unavailable:', error?.message || error));
}
