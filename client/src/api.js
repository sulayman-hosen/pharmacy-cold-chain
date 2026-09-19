let csrf='';
export function setCsrf(value){csrf=value??'';}
export async function api(path,{method='GET',body,...rest}={}) {
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'X-CSRF-Token':csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),...rest});
  const text=await response.text();
  let data=null;
  if(text){
    try{data=JSON.parse(text);}catch{}
  }
  if(!response.ok){
    const message=data?.error?.message??(text&&text.length<200?text:null)??`Server returned status ${response.status}. Please check if the backend server is running.`;
    const error=new Error(message);
    error.code=data?.error?.code??(response.status>=500?'SERVER_ERROR':'REQUEST_FAILED');
    error.status=response.status;
    throw error;
  }
  return data;
}
export async function enablePush(publicKey) {
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support Web Push. Use the in-app inbox.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notification permission was not granted.');
  const registration=await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  return api('/push/subscriptions',{method:'POST',body:subscription.toJSON()});
}
