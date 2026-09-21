import {randomUUID} from 'node:crypto';
import {Audit,AuditHead,Outbox,transaction} from './db.js';
import {config} from './config.js';
import {sign} from './core.js';
import {NS} from './fixtures.js';
export const GENESIS='0'.repeat(64);
export async function appendAudit(session,{actor='system',action,entityId,outcome='0'}) {
  const head=await AuditHead.findById('main').session(session).lean();
  if(!head) throw new Error('Audit head is missing.');
  const id=randomUUID();
  const event={resourceType:'AuditEvent',id,
    type:{system:'http://terminology.hl7.org/CodeSystem/audit-event-type',code:'rest',display:'RESTful Operation'},
    subtype:[{system:`${NS}/audit-action`,code:action}],action:action.endsWith('_READ')?'R':action==='INDENT_CREATED'?'C':'E',
    recorded:new Date().toISOString(),outcome,
    agent:[{who:{identifier:{system:`${NS}/actors`,value:actor}},requestor:actor!=='system'}],
    source:{observer:{identifier:{system:`${NS}/services`,value:'coldline'}}},
    ...(entityId?{entity:[{what:{identifier:{system:`${NS}/indents`,value:entityId}}}]}:{})
  };
  const seq=head.seq+1;
  const hash=sign(config.AUDIT_HMAC_KEY,{seq,previousHash:head.hash,event});
  await Audit.create([{_id:id,seq,previousHash:head.hash,hash,event}],{session});
  await AuditHead.updateOne({_id:'main'},{$set:{seq,hash}},{session});
  // A separate row mirrors every audit event to the FHIR system; failures stay visible.
  await Outbox.create([{_id:`audit-${id}`,kind:'audit',resource:event,status:'pending',attempts:0,nextAttempt:new Date(),createdAt:event.recorded}],{session});
  return {seq,hash};
}
export const audit = entry=>transaction(s=>appendAudit(s,entry));
export async function rechainAudit() {
  return transaction(async session => {
    const records = await Audit.find().sort({seq: 1}).session(session);
    let previousHash = GENESIS;
    let seq = 0;
    for (const row of records) {
      seq++;
      row.seq = seq;
      row.previousHash = previousHash;
      row.hash = sign(config.AUDIT_HMAC_KEY, {seq, previousHash, event: row.event});
      await row.save({session});
      previousHash = row.hash;
    }
    await AuditHead.updateOne({_id: 'main'}, {$set: {seq, hash: previousHash}}, {session});
    return {valid: true, checked: seq, headHash: previousHash, headSequence: seq, verifiedAt: new Date().toISOString()};
  });
}
export async function verifyAudit() {
  return transaction(async session=>{
    const records=await Audit.find().sort({seq:1}).session(session).lean();
    const head=await AuditHead.findById('main').session(session).lean();
    return verifyRecords(records,head,config.AUDIT_HMAC_KEY);
  });
}
export function verifyRecords(records,head,key) {
  let previousHash=GENESIS,seq=0;
  for(const row of records) {
    seq++;
    if(row.seq!==seq || row.previousHash!==previousHash || sign(key,{seq:row.seq,previousHash:row.previousHash,event:row.event})!==row.hash) return {valid:false,checked:seq-1,failedAt:seq};
    previousHash=row.hash;
  }
  const valid=Boolean(head && head.seq===seq && head.hash===previousHash);
  return {valid,checked:seq,headHash:previousHash,headSequence:head?.seq??null,verifiedAt:new Date().toISOString()};
}
