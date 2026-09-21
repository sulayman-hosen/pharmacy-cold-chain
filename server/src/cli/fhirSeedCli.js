import { config } from '../config/env.js';
import { demoResources, NS } from '../fixtures.js';
import { assert, jsonFetch } from '../services/terminologyService.js';

const base = new URL(config.FHIR_BASE_URL);
assert(
  ['127.0.0.1', 'localhost', 'hapi'].includes(base.hostname) &&
    config.NODE_ENV !== 'production',
  'LOCAL_FHIR_ONLY',
  'This script only seeds a local test HAPI server.'
);
const entries = demoResources().map((resource) => ({
  resource,
  request: { method: 'PUT', url: `${resource.resourceType}/${resource.id}` }
}));

for (const [name, type] of [
  ['courier', 'Identifier'],
  ['estimated-arrival', 'dateTime'],
  ['dispatch-temperature', 'Quantity'],
  ['package-lot', 'string'],
  ['packed-temperature', 'Quantity']
]) {
  const resource = {
    resourceType: 'StructureDefinition',
    id: `coldline-${name}`,
    url: `${NS}/StructureDefinition/${name}`,
    name:
      'Coldline' +
      name
        .split('-')
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join(''),
    status: 'draft',
    fhirVersion: '4.0.1',
    kind: 'complex-type',
    abstract: false,
    context: [{ type: 'element', expression: 'MedicationDispense' }],
    type: 'Extension',
    baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Extension',
    derivation: 'constraint',
    differential: {
      element: [
        { id: 'Extension', path: 'Extension' },
        { id: 'Extension.extension', path: 'Extension.extension', max: '0' },
        {
          id: 'Extension.url',
          path: 'Extension.url',
          fixedUri: `${NS}/StructureDefinition/${name}`
        },
        {
          id: 'Extension.value[x]',
          path: 'Extension.value[x]',
          min: 1,
          type: [{ code: type }]
        }
      ]
    }
  };
  entries.push({
    resource,
    request: { method: 'PUT', url: `StructureDefinition/${resource.id}` }
  });
}

try {
  const result = await jsonFetch(config.FHIR_BASE_URL.replace(/\/$/, '') + '/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      Accept: 'application/fhir+json',
      ...(config.FHIR_BEARER_TOKEN
        ? { Authorization: `Bearer ${config.FHIR_BEARER_TOKEN}` }
        : {})
    },
    body: JSON.stringify({
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries
    })
  });
  assert(
    result.type === 'transaction-response' &&
      result.entry?.every((e) => /^2\d\d/.test(e.response?.status ?? '')),
    'FHIR_SEED_FAILED',
    'The server did not confirm every resource.'
  );
  console.log(
    'Local HAPI seeded with synthetic records and Coldline extension definitions.'
  );
} catch (e) {
  console.error(e.code ?? 'FHIR_SEED_FAILED');
  process.exitCode = 1;
}
