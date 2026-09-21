import { config } from '../config/env.js';
import { DemoResource } from '../database/models.js';
import {
  AppError,
  assert,
  jsonFetch,
  fhirIdPattern,
  sha256,
  canonical
} from './terminologyService.js';
import { RXNORM, UCUM, NS, catalog } from '../fixtures.js';

const headers = () => ({
  Accept: 'application/fhir+json',
  ...(config.FHIR_BEARER_TOKEN
    ? { Authorization: `Bearer ${config.FHIR_BEARER_TOKEN}` }
    : {})
});

export async function checkFhirVersion() {
  if (config.INTEGRATION_MODE === 'demo') return;
  const c = await jsonFetch(
    `${config.FHIR_BASE_URL.replace(/\/$/, '')}/metadata`,
    { headers: headers() }
  );
  assert(
    c.fhirVersion === '4.0.1',
    'FHIR_VERSION',
    'This adapter requires FHIR R4 (4.0.1), not R4B or R5.',
    503
  );
}

export async function readResource(type, id) {
  assert(
    ['MedicationRequest', 'Medication', 'Encounter'].includes(type) &&
      fhirIdPattern.test(id),
    'FHIR_REFERENCE',
    'Unsupported FHIR reference.'
  );
  if (config.INTEGRATION_MODE === 'demo') {
    const d = await DemoResource.findById(`${type}/${id}`).lean();
    if (d) return d.resource;

    if (type === 'MedicationRequest') {
      const patientId = `patient-${id.toLowerCase()}`;
      const encounterId = `encounter-${id.toLowerCase()}`;
      const synthRequest = {
        resourceType: 'MedicationRequest',
        id: id,
        meta: { versionId: '1' },
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            { system: RXNORM, code: catalog[0].rxcui, display: catalog[0].name }
          ],
          text: catalog[0].name
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        requester: {
          identifier: {
            system: `${NS}/prescribers`,
            value: 'demo-prescriber'
          }
        },
        dosageInstruction: [
          {
            sequence: 1,
            text: 'Synthetic demonstration order',
            timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
            route: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '34206005',
                  display: 'Subcutaneous route'
                }
              ]
            },
            doseAndRate: [
              {
                doseQuantity: {
                  value: 10,
                  unit: 'units',
                  system: UCUM,
                  code: '[iU]'
                }
              }
            ]
          }
        ],
        dispenseRequest: {
          quantity: { value: 1, unit: 'dose', system: UCUM, code: '{dose}' }
        },
        substitution: { allowedBoolean: false }
      };
      const synthEncounter = {
        resourceType: 'Encounter',
        id: encounterId,
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'IMP'
        },
        subject: { reference: `Patient/${patientId}` },
        location: [
          { location: { reference: 'Location/ipd-3' }, status: 'active' }
        ]
      };
      const synthPatient = {
        resourceType: 'Patient',
        id: patientId,
        active: true,
        name: [{ family: 'Synthetic', given: [`Patient ${id}`] }]
      };

      await DemoResource.updateOne(
        { _id: `MedicationRequest/${id}` },
        { $set: { resource: synthRequest } },
        { upsert: true }
      );
      await DemoResource.updateOne(
        { _id: `Encounter/${encounterId}` },
        { $set: { resource: synthEncounter } },
        { upsert: true }
      );
      await DemoResource.updateOne(
        { _id: `Patient/${patientId}` },
        { $set: { resource: synthPatient } },
        { upsert: true }
      );

      return synthRequest;
    }

    if (type === 'Encounter') {
      const patientId = `patient-${id.toLowerCase()}`;
      const synthEncounter = {
        resourceType: 'Encounter',
        id: id,
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'IMP'
        },
        subject: { reference: `Patient/${patientId}` },
        location: [
          { location: { reference: 'Location/ipd-3' }, status: 'active' }
        ]
      };
      await DemoResource.updateOne(
        { _id: `Encounter/${id}` },
        { $set: { resource: synthEncounter } },
        { upsert: true }
      );
      return synthEncounter;
    }

    throw new AppError(
      404,
      'FHIR_NOT_FOUND',
      'The synthetic prescription or reference was not found.'
    );
  }
  const r = await jsonFetch(
    `${config.FHIR_BASE_URL.replace(/\/$/, '')}/${type}/${id}`,
    { headers: headers() }
  );
  assert(
    r.resourceType === type && r.id === id,
    'FHIR_RESPONSE',
    'Unexpected FHIR resource.',
    503
  );
  return r;
}

export async function writeResource(resource) {
  assert(
    ['MedicationDispense', 'AuditEvent'].includes(resource.resourceType) &&
      fhirIdPattern.test(resource.id),
    'FHIR_WRITE',
    'Unsupported FHIR write.'
  );
  if (config.INTEGRATION_MODE === 'demo') {
    await DemoResource.updateOne(
      { _id: `${resource.resourceType}/${resource.id}` },
      { $set: { resource } },
      { upsert: true }
    );
    return;
  }
  const r = await jsonFetch(
    `${config.FHIR_BASE_URL.replace(/\/$/, '')}/${resource.resourceType}/${
      resource.id
    }`,
    {
      method: 'PUT',
      headers: {
        ...headers(),
        'Content-Type': 'application/fhir+json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(resource)
    }
  );
  assert(
    r.resourceType === resource.resourceType && r.id === resource.id,
    'FHIR_WRITE_RESPONSE',
    'FHIR write returned an unexpected resource.',
    503
  );
}

function rejectModifiers(value) {
  if (!value || typeof value !== 'object') return;
  assert(
    !value.modifierExtension?.length,
    'UNSUPPORTED_ORDER',
    'An order modifier requires manual review.'
  );
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(rejectModifiers);
    else if (child && typeof child === 'object') rejectModifiers(child);
  }
}

export async function readOrder(id, user) {
  const resource = await readResource('MedicationRequest', id);
  rejectModifiers(resource);
  assert(
    resource.status === 'active' &&
      resource.intent === 'order' &&
      !resource.doNotPerform &&
      !resource.reportedBoolean &&
      !resource.reportedReference,
    'ORDER_INACTIVE',
    'Only an active, original executable order is supported.'
  );
  assert(
    /^Patient\/[A-Za-z0-9.-]{1,64}$/.test(resource.subject?.reference ?? ''),
    'PATIENT_REFERENCE',
    'An explicit Patient reference is required.'
  );
  assert(
    /^Encounter\/[A-Za-z0-9.-]{1,64}$/.test(resource.encounter?.reference ?? ''),
    'ENCOUNTER_REFERENCE',
    'An inpatient Encounter reference is required.'
  );
  const encounter = await readResource(
    'Encounter',
    resource.encounter.reference.split('/')[1]
  );
  assert(
    encounter.subject?.reference === resource.subject.reference &&
      encounter.class?.code === 'IMP' &&
      encounter.status === 'in-progress',
    'ENCOUNTER_MISMATCH',
    'The order must belong to an active inpatient encounter.'
  );
  const locations = (encounter.location ?? []).filter(
    (l) =>
      l.status === 'active' &&
      /^Location\/[A-Za-z0-9.-]{1,64}$/.test(l.location?.reference ?? '')
  );
  assert(
    locations.length === 1,
    'WARD_AMBIGUOUS',
    'One active inpatient floor location is required.'
  );
  const floor = locations[0].location.reference.split('/')[1];
  assert(
    user.floors.includes(floor),
    'ACCESS_DENIED',
    'This order is outside your assigned floor.',
    403
  );
  let medication = resource.medicationCodeableConcept;
  let medicationResource;
  if (resource.medicationReference) {
    const ref = resource.medicationReference.reference ?? '';
    if (ref.startsWith('#'))
      medicationResource = resource.contained?.find(
        (c) => c.id === ref.slice(1) && c.resourceType === 'Medication'
      );
    else {
      assert(
        /^Medication\/[A-Za-z0-9.-]{1,64}$/.test(ref),
        'MEDICATION_REFERENCE',
        'Only a local Medication reference is supported.'
      );
      medicationResource = await readResource('Medication', ref.split('/')[1]);
    }
    rejectModifiers(medicationResource);
    medication = medicationResource?.code;
  }
  const codes =
    medication?.coding?.filter(
      (c) => c.system === RXNORM && /^\d+$/.test(c.code ?? '')
    ) ?? [];
  assert(
    codes.length === 1,
    'RXNORM_REQUIRED',
    'Exactly one RxNorm formulation code is required.'
  );
  const dosage = resource.dosageInstruction;
  assert(
    dosage?.length === 1 &&
      dosage[0].doseAndRate?.length === 1 &&
      !dosage[0].asNeededBoolean &&
      !dosage[0].asNeededCodeableConcept &&
      !dosage[0].additionalInstruction?.length,
    'UNSUPPORTED_DOSE',
    'Only one fixed, unconditional dose is supported; complex dosing requires manual review.'
  );
  const rate = dosage[0].doseAndRate[0],
    dose = rate.doseQuantity;
  assert(
    !rate.rateRatio &&
      !rate.rateRange &&
      !rate.rateQuantity &&
      !rate.doseRange &&
      dose?.system === UCUM &&
      !!dose.code &&
      !dose.comparator &&
      Number.isFinite(dose.value) &&
      dose.value > 0,
    'UNSUPPORTED_DOSE',
    'A positive fixed UCUM dose is required.'
  );
  const routes =
    dosage[0].route?.coding?.filter(
      (c) => c.system === 'http://snomed.info/sct' && c.code
    ) ?? [];
  assert(routes.length === 1, 'ROUTE_REQUIRED', 'One coded SNOMED route is required.');
  const validity = resource.dispenseRequest?.validityPeriod;
  assert(
    (!validity?.start || Date.parse(validity.start) <= Date.now()) &&
      (!validity?.end || Date.parse(validity.end) > Date.now()),
    'ORDER_EXPIRED',
    'The prescription is outside its validity period.'
  );
  const quantity = resource.dispenseRequest?.quantity;
  assert(
    quantity?.system === UCUM &&
      quantity.code &&
      !quantity.comparator &&
      Number.isFinite(quantity.value) &&
      quantity.value > 0,
    'QUANTITY_REQUIRED',
    'A positive coded dispense quantity is required.'
  );
  return {
    id,
    patientRef: resource.subject.reference,
    encounterRef: resource.encounter.reference,
    floor,
    rxcui: codes[0].code,
    name: codes[0].display ?? medication.text ?? codes[0].code,
    dose: dose.value,
    unit: dose.code,
    route: routes[0].code,
    routeLabel: routes[0].display ?? routes[0].code,
    orderHash: sha256(canonical({ resource, encounter, medicationResource })),
    resource,
    medication,
    quantity
  };
}

export function dispenseResource(indent, event) {
  return {
    resourceType: 'MedicationDispense',
    id: `cc-${indent._id}`,
    identifier: [{ system: `${NS}/indents`, value: indent._id }],
    status: 'in-progress',
    medicationCodeableConcept: indent.order.medication,
    subject: { reference: indent.patientRef },
    context: { reference: indent.encounterRef },
    authorizingPrescription: [{ reference: `MedicationRequest/${indent.prescriptionId}` }],
    performer: [
      {
        function: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/medicationdispense-performer-function',
              code: 'packager'
            }
          ]
        },
        actor: { identifier: { system: `${NS}/actors`, value: indent.packed.by } }
      }
    ],
    quantity: indent.order.quantity,
    dosageInstruction: indent.order.resource.dosageInstruction,
    whenPrepared: indent.packed.at,
    whenHandedOver: event.departedAt,
    destination: { reference: `Location/${indent.floor}` },
    extension: [
      {
        url: `${NS}/StructureDefinition/courier`,
        valueIdentifier: { system: `${NS}/couriers`, value: event.courierId }
      },
      { url: `${NS}/StructureDefinition/estimated-arrival`, valueDateTime: event.eta },
      {
        url: `${NS}/StructureDefinition/dispatch-temperature`,
        valueQuantity: { value: event.temperature, system: UCUM, code: 'Cel', unit: '°C' }
      },
      { url: `${NS}/StructureDefinition/package-lot`, valueString: indent.packed.lot },
      {
        url: `${NS}/StructureDefinition/packed-temperature`,
        valueQuantity: { value: indent.packed.temperature, system: UCUM, code: 'Cel', unit: '°C' }
      }
    ]
  };
}
