const label=document.getElementById('offline-status');
let requestedUpdate=false,reloading=false;
function offerUpdate(registration){
 if(!registration.waiting||!navigator.serviceWorker.controller)return;
 if(label)label.textContent='An update is ready. Save and reload whenever you are ready.';
 let button=document.getElementById('install-update');
 if(!button){button=document.createElement('button');button.id='install-update';button.className='update-notice';document.body.append(button);}
 button.textContent='Update ready · Save & reload';
 button.onclick=()=>{
  if(!registration.waiting){button.remove();return;}
  if(!window.dispatchEvent(new Event('pre-genesis:before-update',{cancelable:true})))return;
  requestedUpdate=true;button.disabled=true;button.textContent='Applying update…';
  registration.waiting.postMessage({type:'SKIP_WAITING'});
 };
}
if(globalThis.PREGENESIS_NATIVE){
 if(label)label.textContent='Solo works offline · friend rooms need internet';
}else if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate&&!reloading){reloading=true;location.reload();}});
 navigator.serviceWorker.register('./sw.js').then(registration=>{
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate(registration);});});
  navigator.serviceWorker.ready.then(()=>{if(label)label.textContent='Solo works offline · friend rooms need internet';offerUpdate(registration);});
  offerUpdate(registration);
 }).catch(()=>{if(label)label.textContent='Online play · offline installation unavailable';});
}else if(label)label.textContent='Play on this device · export saves to move them elsewhere';
