import webpush from 'web-push';
import {config} from './config.js';
import {assert} from './core.js';
import {couriers} from './fixtures.js';
import {PushSubscription} from './db.js';
export function safeNotification(event) {
  // Construct a new allowlisted object. Never spread order, HL7 or patient fields.
  const courier=couriers.find(c=>c.id===event.courierId);
  assert(courier,'COURIER_UNKNOWN','Select a configured courier.');
  const date=new Date(event.eta);
  assert(Number.isFinite(date.getTime()),'ETA_INVALID','ETA must be a valid timestamp.');
  const eta=date.toISOString().slice(11,16)+' UTC';
  return {title:'Delivery update',body:`${courier.label} is on the way. ETA ${eta}. Please place in refrigerator upon receipt.`,tag:'coldline-delivery',url:'/'};
}
export const pushEnabled=Boolean(config.VAPID_PUBLIC_KEY&&config.VAPID_PRIVATE_KEY);
if(pushEnabled) webpush.setVapidDetails(config.VAPID_SUBJECT,config.VAPID_PUBLIC_KEY,config.VAPID_PRIVATE_KEY);
export function checkPushEndpoint(endpoint) {
  const u=new URL(endpoint);
  assert(u.protocol==='https:' && !u.username && !u.password && !u.port && !u.hash && config.PUSH_ALLOWED_HOSTS.split(',').includes(u.hostname),'PUSH_ENDPOINT','This push service is not allowed.');
}
export async function sendPush(userId,payload) {
  if(!pushEnabled)return;
  const subscriptions=await PushSubscription.find({userId}).lean();
  for(const row of subscriptions) {
    checkPushEndpoint(row.subscription.endpoint);
    try {await webpush.sendNotification(row.subscription,JSON.stringify(payload),{TTL:300,timeout:10000});}
    catch(error) {
      if([404,410].includes(error.statusCode)) await PushSubscription.deleteOne({_id:row._id});
      else throw error;
    }
  }
}
