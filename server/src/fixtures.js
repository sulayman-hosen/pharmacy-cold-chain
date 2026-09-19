export const RXNORM='http://www.nlm.nih.gov/research/umls/rxnorm';
export const UCUM='http://unitsofmeasure.org';
export const NS='https://coldchain.example.org/fhir';
// Frozen synthetic demonstration records, not a live terminology cache.
export const catalog=[
  {rxcui:'274783',name:'insulin glargine 100 UNT/ML Injectable Solution',tty:'SCD',minC:2,maxC:8,policy:'Demo unopened-product transport policy'},
  {rxcui:'86009',name:'insulin human, regular 100 UNT/ML Injectable Solution',tty:'SCD',minC:2,maxC:8,policy:'Demo unopened-product transport policy'}
];
export const couriers=[{id:'C-07',label:'Courier 07 (Alex Rivera)',name:'Alex Rivera'},{id:'C-12',label:'Courier Unit #12 (Sam Taylor)',name:'Sam Taylor'},{id:'C-19',label:'Courier Unit #19 (Morgan Lee)',name:'Morgan Lee'}];
export function demoResources() {
  const resources=[];
  resources.push({resourceType:'Location',id:'ipd-3',name:'Inpatient floor 3',status:'active'});
  for (let i=1;i<=5;i++) {
    const cat = catalog[0];
    const patientId=`demo-patient-0${i}`, encounterId=`demo-encounter-0${i}`;
    resources.push({resourceType:'Patient',id:patientId,active:true,name:[{family:'Synthetic',given:[`Patient ${i}`]}]});
    resources.push({resourceType:'Encounter',id:encounterId,status:'in-progress',class:{system:'http://terminology.hl7.org/CodeSystem/v3-ActCode',code:'IMP'},subject:{reference:`Patient/${patientId}`},location:[{location:{reference:'Location/ipd-3'},status:'active'}]});
    resources.push({resourceType:'MedicationRequest',id:`demo-order-0${i}`,meta:{versionId:'1'},status:'active',intent:'order',
      medicationCodeableConcept:{coding:[{system:RXNORM,code:cat.rxcui,display:cat.name}],text:cat.name},
      subject:{reference:`Patient/${patientId}`},encounter:{reference:`Encounter/${encounterId}`},
      requester:{identifier:{system:`${NS}/prescribers`,value:'demo-prescriber'}},
      dosageInstruction:[{sequence:1,text:'Synthetic software test order only',timing:{repeat:{frequency:1,period:1,periodUnit:'d'}},route:{coding:[{system:'http://snomed.info/sct',code:'34206005',display:'Subcutaneous route'}]},doseAndRate:[{doseQuantity:{value:i===1?10:12,unit:'units',system:UCUM,code:'[iU]'}}]}],
      dispenseRequest:{quantity:{value:1,unit:'dose',system:UCUM,code:'{dose}'}},substitution:{allowedBoolean:false}
    });
  }
  return resources;
}
