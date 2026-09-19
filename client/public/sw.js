// No clinical pages, API responses, or records are cached by this worker.
self.addEventListener('push',event=>{
  let data;try{data=event.data.json();}catch{return;}
  if(data.title!=='Delivery update'||typeof data.body!=='string')return;
  event.waitUntil(self.registration.showNotification('Delivery update',{body:data.body,tag:'coldline-delivery',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow('/')));
});
