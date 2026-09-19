import {test,afterEach,mock} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.INTEGRATION_MODE='live';process.env.FHIR_BASE_URL='https://ehr.example.test/fhir';process.env.AUDIT_HMAC_KEY='live-adapter-test-key-never-use-in-production-12345';
const {config}=await import('../src/config.js');
const {validateFormulation}=await import('../src/rxnorm.js');
const {readOrder,writeResource,checkFhirVersion}=await import('../src/fhir.js');
const {demoResources,catalog,RXNORM}=await import('../src/fixtures.js');
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/fhir+json'}});
afterEach(()=>mock.restoreAll());
test('Live RxNorm uses exact active-name search and full formulation properties',async()=>{
  const urls=[];mock.method(globalThis,'fetch',async url=>{urls.push(String(url));return response(String(url).includes('properties')?{properties:catalog[0]}:{idGroup:{rxnormId:['274783']}});});
  assert.equal((await validateFormulation(catalog[0].name,'274783')).source,'NIH-RxNorm');
  assert.equal(new URL(urls[0]).searchParams.get('search'),'0');assert.equal(new URL(urls[0]).searchParams.get('allsrc'),'0');assert.match(urls[1],/274783\/properties.json$/);
});
test('Live API failure does not fall back to synthetic fixtures',async()=>{
  mock.method(globalThis,'fetch',async()=>{throw new Error('private patient error should not escape');});
  await assert.rejects(validateFormulation(catalog[0].name,'274783'),e=>e.code==='UPSTREAM_UNAVAILABLE'&&!e.message.includes('private patient'));
});
test('Ambiguous names and ingredient-only concepts are blocked in live mode',async()=>{
  let ambiguous=true;mock.method(globalThis,'fetch',async url=>response(String(url).includes('properties')?{properties:{...catalog[0],tty:'IN'}}:{idGroup:{rxnormId:ambiguous?['274783','1234']:['274783']}}));
  await assert.rejects(validateFormulation(catalog[0].name,'274783'),e=>e.code==='DRUG_MISMATCH');ambiguous=false;
  await assert.rejects(validateFormulation(catalog[0].name,'274783'),e=>e.code==='FORMULATION_REQUIRED');
});
test('R4 version negotiation rejects an R5 server',async()=>{
  mock.method(globalThis,'fetch',async()=>response({resourceType:'CapabilityStatement',fhirVersion:'5.0.0'}));
  await assert.rejects(checkFhirVersion(),e=>e.code==='FHIR_VERSION');
});
test('FHIR PUT retries keep the same resource ID and use the configured origin',async()=>{
  const calls=[];mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return response(JSON.parse(options.body));});
  const resource={resourceType:'AuditEvent',id:'cc-test-event',recorded:new Date().toISOString()};await writeResource(resource);await writeResource(resource);
  assert.equal(calls[0].url,calls[1].url);assert.equal(calls[0].url,config.FHIR_BASE_URL+'/AuditEvent/cc-test-event');assert.equal(calls[0].options.method,'PUT');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers['Content-Type'],'application/fhir+json');
});
test('MedicationReference is resolved and external references are rejected',async()=>{
  const resources=demoResources();const order=structuredClone(resources.find(r=>r.id==='demo-order-01'));
  const medication={resourceType:'Medication',id:'demo-med',code:order.medicationCodeableConcept};delete order.medicationCodeableConcept;order.medicationReference={reference:'Medication/demo-med'};
  mock.method(globalThis,'fetch',async url=>response(String(url).endsWith('/MedicationRequest/demo-order-01')?order:String(url).endsWith('/Medication/demo-med')?medication:resources.find(r=>String(url).endsWith('/'+r.resourceType+'/'+r.id))));
  assert.equal((await readOrder('demo-order-01',{floors:['ipd-3']})).rxcui,'274783');
  order.medicationReference.reference='https://untrusted.invalid/Medication/1';await assert.rejects(readOrder('demo-order-01',{floors:['ipd-3']}),e=>e.code==='MEDICATION_REFERENCE');
});
