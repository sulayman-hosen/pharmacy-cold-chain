import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.INTEGRATION_MODE='demo';process.env.AUDIT_HMAC_KEY='unit-test-signing-key-never-use-in-production-123456';
const {parseDelivery,sampleMessage}=await import('../src/hl7.js');
const {safeNotification}=await import('../src/notifications.js');
const {temperaturePolicy,validateFormulation}=await import('../src/rxnorm.js');
const {verifyRecords,GENESIS}=await import('../src/audit.js');
const {sign}=await import('../src/core.js');
const {dispenseResource}=await import('../src/fhir.js');
const {catalog}=await import('../src/fixtures.js');
const indent={_id:'bb67fc90-cba3-455c-8285-5277edbfc7ab',prescriptionId:'demo-order-01',patientRef:'Patient/demo-patient-01',encounterRef:'Encounter/demo-encounter-01',floor:'ipd-3',rxcui:'274783',validation:{name:catalog[0].name},dose:10,unit:'[iU]',route:'34206005'};
const raw=()=>sampleMessage(indent);
test('Redox parses OMP^O09, clinical coding, ZCD and CRLF',()=>{
  const e=parseDelivery(raw().replace(/\r/g,'\r\n'));
  assert.equal(e.patientRef,indent.patientRef);assert.equal(e.dose,10);assert.equal(e.unit,'[iU]');assert.equal(e.courierId,'C-07');assert.equal(e.temperature,4);
});
test('MLLP frame can be parsed over the HTTP adapter',()=>assert.equal(parseDelivery('\x0b'+raw()+'\x1c\r').rxcui,'274783'));
test('Wrong event, repeated segments, missing fields, repeated identifiers are rejected',()=>{
  for(const value of [raw().replace('OMP^O09','ADT^A01'),raw()+'\rPID|1',raw().replace('ZCD|DEPARTED','ZCD|'),raw().replace('demo-patient-01^^^','demo-patient-01~other^^^')])assert.throws(()=>parseDelivery(value));
});
test('Untrusted HL7 sender is rejected',()=>assert.throws(()=>parseDelivery(raw().replace('PHARMACY|','EVIL|')),e=>e.code==='HL7_SENDER'));
test('Same control ID with different body has a different digest',()=>{const r=raw();assert.notEqual(parseDelivery(r).digest,parseDelivery(r.replace('ZCD|DEPARTED|C-07','ZCD|DEPARTED|C-12')).digest);});
test('Notification builder cannot copy injected PHI or untrusted courier text',()=>{
  const e={...parseDelivery(raw()),patientName:'Alice Sensitive',mrn:'123456',bed:'7C',drug:'secret medication'};
  const alert=safeNotification(e),json=JSON.stringify(alert);
  assert.deepEqual(Object.keys(alert),['title','body','tag','url']);
  for(const value of ['Alice','123456','7C','secret medication','demo-patient','demo-order'])assert.ok(!json.includes(value));
  assert.match(alert.body,/Courier 07/);assert.match(alert.body,/UTC/);
  assert.throws(()=>safeNotification({...e,courierId:'Patient Alice'}));
});
test('Boundary temperatures accepted; excursions blocked',()=>{temperaturePolicy('274783',2);temperaturePolicy('274783',8);for(const t of [1.99,8.01,NaN])assert.throws(()=>temperaturePolicy('274783',t));assert.throws(()=>temperaturePolicy('123456',4));});
test('Formulation match requires complete name and exact RxNorm concept',async()=>{
  assert.equal((await validateFormulation(catalog[0].name,'274783')).matched,true);
  await assert.rejects(validateFormulation('insulin','274783'));await assert.rejects(validateFormulation(catalog[1].name,'274783'));
});
test('Audit HMAC catches mutation, deletion, reordering and tail truncation',()=>{
  const key='test';const records=[];let prev=GENESIS;
  for(let seq=1;seq<=3;seq++){const event={resourceType:'AuditEvent',id:String(seq)};const hash=sign(key,{seq,previousHash:prev,event});records.push({seq,previousHash:prev,event,hash});prev=hash;}
  const head={seq:3,hash:prev};assert.equal(verifyRecords(records,head,key).valid,true);
  const changed=structuredClone(records);changed[1].event.id='edited';assert.equal(verifyRecords(changed,head,key).valid,false);
  assert.equal(verifyRecords(records.slice(0,2),head,key).valid,false);assert.equal(verifyRecords([records[1],records[0],records[2]],head,key).valid,false);
});
test('FHIR dispense uses correct R4 choice fields and separate preparation/handover',()=>{
  const e=parseDelivery(raw());const i={...indent,packed:{at:new Date(Date.now()-10000).toISOString(),by:'demo-pharmacist',temperature:4,lot:'A1'},order:{medication:{coding:[{system:'http://www.nlm.nih.gov/research/umls/rxnorm',code:'274783'}]},quantity:{value:1,unit:'dose',system:'http://unitsofmeasure.org',code:'{dose}'},resource:{dosageInstruction:[]}}};
  const d=dispenseResource(i,e);assert.equal(d.resourceType,'MedicationDispense');assert.ok(d.medicationCodeableConcept);assert.equal(d.status,'in-progress');assert.ok(Date.parse(d.whenPrepared)<=Date.parse(d.whenHandedOver));assert.ok(d.extension.find(x=>x.url.endsWith('estimated-arrival')));assert.ok(!('medication' in d));
});
