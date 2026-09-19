import { parseHL7Order } from '../lib/hl7Parser.js';
import { POST } from '../app/api/dispatch/route.js';

async function runTest() {
  console.log('--- Testing HL7 v2 OMP^O09 Parser & Dispatch Route ---');

  const sampleHL7 = [
    'MSH|^~\\&|EHR_PHARMACY|HOSPITAL_IPD|COLDLINE|IPD|20260919111500+0000||OMP^O09^OMP_O09|MSG-99201|P|2.5.1',
    'PID|1||PAT-884021^^^HOSPITAL_IPD^MR||DOES^JANE^A||19850412|F',
    'PV1|1|I|ROOM-402^BED-B^FLOOR-4||||1234^DOCTOR^SAM',
    'ORC|SC|ORD-77102^EHR|IND-99102^COLDLINE||IP|||||||NURSE-552^SMITH^ALICE',
    'RXO|274783^insulin glargine 100 UNT/ML Injectable Solution^RXNORM|10||[iU]^units^UCUM',
    'RXR|34206005^Subcutaneous route^SCT',
    'ZCD|DEPARTED|C-07|2026-09-19T11:15:00Z|2026-09-19T11:23:00Z|4.0'
  ].join('\r');

  // Test 1: Direct HL7 Parser
  console.log('\n[Test 1] Testing parseHL7Order():');
  const parsed = parseHL7Order(sampleHL7);
  console.log('Result:', JSON.stringify(parsed, null, 2));

  // Test 2: Dispatch API Route
  console.log('\n[Test 2] Testing POST() API route:');
  const mockReq = {
    headers: new Map([['content-type', 'application/json']]),
    json: async () => ({ message: sampleHL7 })
  };

  const response = await POST(mockReq);
  const responseData = await response.json();
  console.log('API Response Status:', response.status);
  console.log('API Response Data:', JSON.stringify(responseData, null, 2));
}

runTest().catch(console.error);
