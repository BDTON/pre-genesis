const KEY='crowns-online-seat-v1';
export class FriendSession {
 constructor({onSnapshot,onError,onConnection,onBusy}){this.onSnapshot=onSnapshot;this.onError=onError;this.onConnection=onConnection;this.onBusy=onBusy;this.credentials=null;this.snapshot=null;this.busy=false;this.timer=null;this.lastRevision=-1;this.connectionStatus='offline';this.generation=0;}
 get connected(){return !!this.credentials;}
 get myTurn(){return this.connectionStatus==='connected'&&this.snapshot?.room?.status==='active'&&this.snapshot.room.activePlayerId===this.snapshot.you.id;}
 async request(path,body){
  const base=globalThis.PREGENESIS_NATIVE?.apiOrigin||'';
  const response=await fetch(base+'/api/rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(this.credentials?{Authorization:'Bearer '+this.credentials.token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
  let data;try{data=await response.json();}catch{throw Error('Online rooms are unavailable. Your solo campaign is safe.');}
  if(!response.ok){if(response.status===409&&this.credentials)this.poll();throw Error(data.error||data.message||'The room could not be updated.');}
  return data;
 }
 remember(){try{sessionStorage.setItem(KEY,JSON.stringify(this.credentials));localStorage.setItem(KEY,JSON.stringify(this.credentials));}catch{}}
 setBusy(value){this.busy=value;this.onBusy?.(value);}
 accept(data){if(data.room.revision<this.lastRevision)return;this.connectionStatus='connected';this.snapshot=data;this.lastRevision=data.room.revision;this.onConnection?.('connected');this.onSnapshot(data);}
 async create(name,faction,seed){const data=await this.request('',{name,faction,seed});this.credentials={code:data.room.code,token:data.token};this.remember();this.accept(data);this.schedule();}
 async join(code,name,faction){const data=await this.request('/'+encodeURIComponent(code.toUpperCase())+'/join',{name,...(faction===undefined?{}:{faction})});this.credentials={code:data.room.code,token:data.token};this.remember();this.accept(data);this.schedule();}
 async resume(){let raw;try{raw=sessionStorage.getItem(KEY)||localStorage.getItem(KEY);}catch{}if(!raw)return false;try{const saved=JSON.parse(raw);if(!/^[A-Z0-9]{6,12}$/.test(saved.code)||typeof saved.token!=='string')return false;this.credentials=saved;await this.poll(true);return true;}catch(error){this.credentials=null;this.onError(error.message);return false;}}
 async start(){if(!this.credentials||this.busy)return;const generation=this.generation;this.setBusy(true);try{const data=await this.request('/'+this.credentials.code+'/start',{revision:this.snapshot.room.revision});if(generation===this.generation)this.accept(data);}finally{if(generation===this.generation)this.setBusy(false);}}
 perform(action){
  if(this.busy){this.onError('Your previous order is still being confirmed.');return {ok:false};}
  if(!this.myTurn){this.onError(this.connectionStatus==='reconnecting'?'Reconnecting to your room. Orders resume once the connection returns.':'Wait for your turn. You can inspect your realm while your friend plays.');return {ok:false};}
  const generation=this.generation;this.setBusy(true);this.request('/'+this.credentials.code+'/action',{action,revision:this.snapshot.room.revision}).then(data=>{if(generation===this.generation)this.accept({...data,confirmedAction:action.type});}).catch(error=>{if(generation===this.generation)this.onError(error.message);}).finally(()=>{if(generation===this.generation){this.setBusy(false);this.schedule();}});
  return {ok:false,pending:true};
 }
 schedule(){clearTimeout(this.timer);if(this.connected)this.timer=setTimeout(()=>this.poll(),document.hidden?8000:2000);}
 async poll(force=false){if(!this.credentials||this.busy){this.schedule();return;}const generation=this.generation;try{const data=await this.request('/'+this.credentials.code);if(generation!==this.generation)return;if(force||data.room.revision!==this.lastRevision)this.accept(data);else {this.connectionStatus='connected';this.onConnection?.('connected');}}catch(error){if(generation!==this.generation)return;this.connectionStatus='reconnecting';this.onConnection?.('reconnecting');if(force)throw error;}finally{if(generation===this.generation)this.schedule();}}
 async leave(){if(this.credentials)await this.request('/'+this.credentials.code+'/leave',{revision:this.snapshot.room.revision});this.disconnect(true);}
 disconnect(forget=false){this.generation++;clearTimeout(this.timer);this.credentials=null;this.snapshot=null;this.lastRevision=-1;this.connectionStatus='offline';this.setBusy(false);if(forget)try{sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);}catch{}this.onConnection?.('offline');}
 inviteURL(){const url=new URL(globalThis.PREGENESIS_NATIVE?.publicOrigin||location.href);url.hash='room='+this.credentials.code;return url.href;}
}
