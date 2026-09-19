import {createHash, createHmac, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
export class AppError extends Error {
  constructor(status, code, message) {super(message); this.status=status; this.code=code;}
}
export function assert(ok, code, message, status=422) {if (!ok) throw new AppError(status,code,message);}
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value !== null && typeof value === 'object') return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const sign = (key,value) => createHmac('sha256',key).update(canonical(value)).digest('hex');
export const secret = () => randomBytes(32).toString('hex');
export function hashPassword(password) {const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function checkPassword(password, stored) {
  const [salt,hash]=stored.split(':');
  const candidate=scryptSync(password,salt,64);
  const expected=Buffer.from(hash,'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate,expected);
}
export function sameSecret(a,b) {const x=Buffer.from(String(a??''));const y=Buffer.from(String(b??''));return x.length===y.length && timingSafeEqual(x,y);}
export const fhirIdPattern = /^[A-Za-z0-9.-]{1,64}$/;
export async function jsonFetch(url, options={}) {
  let res;
  try {res=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});} catch {throw new AppError(503,'UPSTREAM_UNAVAILABLE','An integration is unavailable. No approval was granted; retry later.');}
  if (!res.ok) throw new AppError(res.status===404?404:503,res.status===404?'FHIR_NOT_FOUND':'UPSTREAM_REJECTED',res.status===404?'Prescription or referenced resource not found.':'The integration rejected the request.');
  try {return await res.json();} catch {throw new AppError(503,'UPSTREAM_FORMAT','The integration returned invalid JSON.');}
}
