import { config } from '../config/env.js';
import { assert, jsonFetch } from './terminologyService.js';
import { catalog } from '../fixtures.js';

export async function validateFormulation(name, expectedRxcui) {
  let ids, properties;
  if (config.INTEGRATION_MODE === 'demo') {
    ids = catalog
      .filter((c) => c.name.toLowerCase() === name.trim().toLowerCase())
      .map((c) => c.rxcui);
    properties = catalog.find((c) => c.rxcui === expectedRxcui);
  } else {
    const query = new URLSearchParams({
      name: name.trim(),
      search: '0',
      allsrc: '0'
    });
    const result = await jsonFetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?${query}`
    );
    ids = result.idGroup?.rxnormId ?? [];
    const result2 = await jsonFetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${expectedRxcui}/properties.json`
    );
    properties = result2.properties;
  }
  assert(
    ids.length === 1 && ids[0] === expectedRxcui,
    'DRUG_MISMATCH',
    'The complete drug name, strength, and formulation must match the prescription RxNorm concept exactly.'
  );
  assert(
    properties?.rxcui === expectedRxcui &&
      ['SCD', 'SBD'].includes(properties?.tty),
    'FORMULATION_REQUIRED',
    'A full clinical or branded drug formulation is required; an ingredient alone is insufficient.'
  );
  return {
    matched: true,
    rxcui: expectedRxcui,
    name: properties.name,
    termType: properties.tty,
    source:
      config.INTEGRATION_MODE === 'demo'
        ? 'synthetic-fixture'
        : 'NIH-RxNorm',
    checkedAt: new Date().toISOString()
  };
}

export function temperaturePolicy(rxcui, temperature) {
  const p = catalog.find((c) => c.rxcui === rxcui);
  assert(
    p,
    'STORAGE_POLICY_MISSING',
    'No approved transport policy is configured for this formulation.'
  );
  assert(
    Number.isFinite(temperature) &&
      temperature >= p.minC &&
      temperature <= p.maxC,
    'TEMPERATURE_EXCURSION',
    'Temperature is outside the configured range. Quarantine and request pharmacist review.'
  );
  return { minC: p.minC, maxC: p.maxC, policy: p.policy };
}
