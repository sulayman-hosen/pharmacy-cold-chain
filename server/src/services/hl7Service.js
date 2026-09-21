import redox from '@redox-opensource/redox-hl7-v2';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { assert, AppError, sha256, fhirIdPattern } from './terminologyService.js';

const parser = new redox.Parser();
const schema = JSON.parse(JSON.stringify(parser.schema()));
schema.segments.ZCD = {
  fields: Array.from({ length: 5 }, (_, i) => ({
    field: `ZCD.${i + 1}`,
    minOccurs: '1',
    maxOccurs: '1'
  }))
};
for (let i = 1; i <= 5; i++) schema.fields[`ZCD.${i}`] = { dataType: 'ST' };
schema.messages.OMP_O09.ORDER.elements.push({
  segment: 'ZCD',
  minOccurs: '1',
  maxOccurs: '1'
});
parser.schema(schema);

function scalar(value) {
  if (Array.isArray(value)) {
    assert(value.length === 1, 'HL7_REPETITION', 'Repeated clinical fields require manual review.');
    return scalar(value[0]);
  }
  assert(
    typeof value === 'string',
    'HL7_FIELD',
    'A required HL7 field is missing or ambiguous.'
  );
  return value;
}

function field(segment, number, component) {
  let v = segment?.[number];
  if (Array.isArray(v)) {
    assert(v.length === 1, 'HL7_REPETITION', 'Only one field repetition is supported.');
    v = v[0];
  }
  return scalar(component ? v?.[component] : v);
}

const decimal = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
function numeric(v) {
  assert(decimal.test(v), 'HL7_NUMBER', 'Invalid numeric HL7 field.');
  return Number(v);
}
function iso(v) {
  assert(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) &&
      Number.isFinite(Date.parse(v)),
    'HL7_TIMESTAMP',
    'Transport timestamps must be UTC ISO 8601.'
  );
  return new Date(v).toISOString();
}

export function parseDelivery(raw) {
  assert(
    typeof raw === 'string' && raw.length <= 65536,
    'HL7_SIZE',
    'Send one HL7 message under 64 KB.'
  );
  let normalized = raw
    .replace(/^\x0b/, '')
    .replace(/\x1c\r?$/, '')
    .replace(/\r\n|\n/g, '\r')
    .replace(/\r+$/, '');
  assert(
    normalized.startsWith('MSH|^~\\&|'),
    'HL7_ENCODING',
    'This profile requires standard HL7 delimiters.'
  );
  const lines = normalized.split('\r');
  assert(
    lines.map((l) => l.slice(0, 3)).join(',') === 'MSH,PID,ORC,RXO,RXR,ZCD',
    'HL7_PROFILE',
    'Expected one MSH, PID, ORC, RXO, RXR, ZCD in that order. Additional orders or segments require another profile.'
  );
  assert(
    !lines.slice(1).some((l) => l.includes('~')),
    'HL7_REPETITION',
    'Repeated clinical fields require manual review.'
  );
  let data;
  try {
    data = parser.parse(normalized);
  } catch {
    throw new AppError(422, 'HL7_PARSE', 'The HL7 OMP message could not be parsed.');
  }
  const msh = data.MSH,
    pid = data.PATIENT?.PID,
    order = data.ORDER?.[0];
  assert(data.ORDER?.length === 1, 'HL7_ORDER_COUNT', 'Exactly one order is required.');
  assert(
    field(msh, 9, 1) === 'OMP' &&
      field(msh, 9, 2) === 'O09' &&
      field(msh, 9, 3) === 'OMP_O09',
    'HL7_TYPE',
    'Only OMP^O09^OMP_O09 is supported.'
  );
  assert(
    field(msh, 12, 1) === '2.5.1',
    'HL7_VERSION',
    'This interface profile requires HL7 2.5.1.'
  );
  assert(
    field(msh, 3, 1) === config.HL7_SENDING_APP &&
      field(msh, 4, 1) === config.HL7_SENDING_FACILITY,
    'HL7_SENDER',
    'Unrecognized sending application or facility.'
  );
  assert(
    field(msh, 5, 1) === 'COLDLINE',
    'HL7_RECEIVER',
    'The receiving application must be COLDLINE.'
  );
  assert(
    field(msh, 11, 1) === (config.INTEGRATION_MODE === 'demo' ? 'T' : 'P'),
    'HL7_PROCESSING',
    'Message processing mode does not match this environment.'
  );
  const messageId = field(msh, 10);
  assert(
    /^[A-Za-z0-9.-]{1,64}$/.test(messageId),
    'HL7_CONTROL_ID',
    'A valid message control ID is required.'
  );
  assert(
    field(order.ORC, 1) === 'SC' && field(order.ORC, 5) === 'IP',
    'HL7_ORDER_CONTROL',
    'Dispatch requires ORC-1 SC and ORC-5 IP in this local profile.'
  );
  assert(
    field(order.ORC, 2, 2) === 'EHR' && field(order.ORC, 3, 2) === 'COLDLINE',
    'HL7_ORDER_AUTHORITY',
    'Unexpected order ID authority.'
  );
  const prescriptionId = field(order.ORC, 2, 1),
    indentId = field(order.ORC, 3, 1),
    patientId = field(pid, 3, 1);
  assert(
    fhirIdPattern.test(prescriptionId) &&
      fhirIdPattern.test(patientId) &&
      /^[a-f0-9-]{36}$/.test(indentId),
    'HL7_IDENTIFIER',
    'Invalid order or patient reference.'
  );
  const pidValue = Array.isArray(pid[3]) ? pid[3][0] : pid[3];
  assert(
    scalar(pidValue?.[4]?.[1]) === config.HL7_SENDING_FACILITY &&
      field(pid, 3, 5) === 'MR',
    'HL7_PATIENT_AUTHORITY',
    'Patient assigning authority is not recognized.'
  );
  assert(
    field(order.RXO, 1, 3) === 'RXNORM' &&
      field(order.RXO, 4, 3) === 'UCUM' &&
      field(order.RXR[0], 1, 3) === 'SCT',
    'HL7_CODE_SYSTEM',
    'RxNorm, UCUM and SNOMED coding systems are required.'
  );
  assert(!order.RXO[3], 'HL7_DOSE_RANGE', 'A dose range requires manual review.');
  assert(field(order.ZCD, 1) === 'DEPARTED', 'HL7_EVENT', 'The ZCD event must be DEPARTED.');
  const rxcui = field(order.RXO, 1, 1);
  assert(/^\d{1,12}$/.test(rxcui), 'HL7_DRUG_CODE', 'A numeric RxNorm concept is required.');
  return {
    messageId,
    receiptId: sha256(
      `${config.HL7_SENDING_APP}|${config.HL7_SENDING_FACILITY}|${messageId}`
    ),
    digest: sha256(normalized),
    indentId,
    prescriptionId,
    patientRef: `Patient/${patientId}`,
    rxcui,
    drugName: field(order.RXO, 1, 2),
    dose: numeric(field(order.RXO, 2)),
    unit: field(order.RXO, 4, 1),
    route: field(order.RXR[0], 1, 1),
    courierId: field(order.ZCD, 2),
    departedAt: iso(field(order.ZCD, 3)),
    eta: iso(field(order.ZCD, 4)),
    temperature: numeric(field(order.ZCD, 5))
  };
}

const escape = (s) =>
  String(s)
    .replace(/\\/g, '\\E\\')
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/~/g, '\\R\\')
    .replace(/&/g, '\\T\\')
    .replace(/[\r\n]/g, ' ');

export function sampleMessage(
  indent,
  { courierId = 'C-07', minutes = 15, temperature = 4 } = {}
) {
  const departedAt = new Date().toISOString(),
    eta = new Date(Date.now() + minutes * 60000).toISOString();
  const stamp = departedAt.replace(/[-:T]/g, '').slice(0, 14) + '+0000';
  return [
    `MSH|^~\\&|${config.HL7_SENDING_APP}|${config.HL7_SENDING_FACILITY}|COLDLINE|IPD|${stamp}||OMP^O09^OMP_O09|${randomUUID()}|${
      config.INTEGRATION_MODE === 'demo' ? 'T' : 'P'
    }|2.5.1`,
    `PID|1||${indent.patientRef.split('/')[1]}^^^${config.HL7_SENDING_FACILITY}^MR`,
    `ORC|SC|${indent.prescriptionId}^EHR|${indent._id}^COLDLINE||IP`,
    `RXO|${indent.rxcui}^${escape(indent.validation.name)}^RXNORM|${indent.dose}||${escape(
      indent.unit
    )}^units^UCUM`,
    `RXR|${indent.route}^Route^SCT`,
    `ZCD|DEPARTED|${courierId}|${departedAt}|${eta}|${temperature}`
  ].join('\r');
}

export function acknowledge(event, code = 'AA') {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '+0000';
  return `MSH|^~\\&|COLDLINE|IPD|${config.HL7_SENDING_APP}|${
    config.HL7_SENDING_FACILITY
  }|${stamp}||ACK^O09^ACK|${randomUUID()}|${
    config.INTEGRATION_MODE === 'demo' ? 'T' : 'P'
  }|2.5.1\rMSA|${code}|${event.messageId}\r`;
}
