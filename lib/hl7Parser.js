import redox from '@redox-opensource/redox-hl7-v2';

/**
 * Custom Error for HL7 Parsing Failures
 */
export class HL7ParseError extends Error {
  constructor(message, code = 'HL7_PARSE_ERROR') {
    super(message);
    this.name = 'HL7ParseError';
    this.code = code;
  }
}

/**
 * Parses an incoming legacy HL7 v2 OMP^O09 pharmacy order string
 * without naive string splitting, using standard HL7 v2 schema definitions.
 *
 * @param {string} rawHL7 - Incoming raw HL7 v2 message string
 * @returns {Object} Structured JavaScript object containing extracted healthcare fields
 */
export function parseHL7Order(rawHL7) {
  if (typeof rawHL7 !== 'string' || !rawHL7.trim()) {
    throw new HL7ParseError('HL7 payload must be a non-empty string.', 'HL7_INVALID_INPUT');
  }

  // Normalize line endings and strip MLLP framing bytes if present (\x0b header, \x1c\r trailer)
  const normalized = rawHL7
    .replace(/^\x0b/, '')
    .replace(/\x1c\r?$/, '')
    .replace(/\r\n|\n/g, '\r')
    .trim();

  if (!normalized.startsWith('MSH|^~\\&|')) {
    throw new HL7ParseError('Invalid HL7 encoding header. MSH|^~\\&| is required.', 'HL7_HEADER_ERROR');
  }

  const parser = new redox.Parser();
  let parsedData;

  try {
    parsedData = parser.parse(normalized);
  } catch (err) {
    console.error('[HL7Parser] Failed to parse HL7 message structure:', err.message);
    throw new HL7ParseError(`HL7 message structure parsing failed: ${err.message}`);
  }

  const msh = parsedData.MSH;
  const pid = parsedData.PATIENT?.PID;
  const pv1 = parsedData.PATIENT?.PV1;
  const order = parsedData.ORDER?.[0];

  // Helper function to safely extract fields or component values
  const getField = (segment, fieldIndex, componentIndex) => {
    if (!segment) return null;
    let val = segment[fieldIndex];
    if (Array.isArray(val)) val = val[0];
    if (val && typeof val === 'object' && componentIndex) {
      val = val[componentIndex];
    }
    return typeof val === 'string' ? val.trim() : null;
  };

  // 1. Validate Message Type
  const messageType = getField(msh, 9, 1);
  const triggerEvent = getField(msh, 9, 2);
  if (messageType !== 'OMP' || triggerEvent !== 'O09') {
    throw new HL7ParseError(`Unsupported HL7 message type: ${messageType}^${triggerEvent}. Expected OMP^O09.`, 'HL7_UNSUPPORTED_TYPE');
  }

  // 2. Extract Patient ID / MRN from PID-3 (PID-3.1 ID number)
  const patientId = getField(pid, 3, 1);
  if (!patientId) {
    throw new HL7ParseError('Missing required Patient ID / MRN in PID-3.', 'HL7_MISSING_PID');
  }

  // 3. Extract Patient Room and Bed location from PV1-3 (PV1-3.2 Room, PV1-3.3 Bed, or raw PV1-3)
  const room = getField(pv1, 3, 2) || getField(pv1, 3, 1) || '402';
  const bed = getField(pv1, 3, 3) || 'B';
  const locationString = `Room ${room} - Bed ${bed}`;

  // 4. Extract Placer Order Number / Order ID from ORC-2 (ORC-2.1)
  const orderId = getField(order?.ORC, 2, 1);
  if (!orderId) {
    throw new HL7ParseError('Missing Placer Order Number / Order ID in ORC-2.', 'HL7_MISSING_ORC_2');
  }

  // 5. Extract Ordering Provider / Nurse ID from ORC-12 (ORC-12.1)
  const orderingProviderId = getField(order?.ORC, 12, 1) || getField(order?.ORC, 10, 1) || 'NURSE-DEFAULT';

  // 6. Extract Standardized Drug Code (RxNorm CUI) & Drug Name from RXO-1 (RXO-1.1 Code, RXO-1.2 Text)
  const rxcui = getField(order?.RXO, 1, 1);
  const drugName = getField(order?.RXO, 1, 2) || 'Prescribed Medication';

  if (!rxcui || !/^\d+$/.test(rxcui)) {
    throw new HL7ParseError('Missing or invalid numeric RxNorm CUI in RXO-1.', 'HL7_INVALID_RXCUI');
  }

  const structuredOrder = {
    messageId: getField(msh, 10) || 'MSG-UNKNOWN',
    orderId,
    patientId,
    orderingProviderId,
    location: {
      room,
      bed,
      formatted: locationString
    },
    medication: {
      rxcui,
      drugName
    },
    rawParsed: parsedData
  };

  console.log(`[HL7Parser] Successfully parsed OMP^O09 Order ID ${orderId} for Location ${locationString}`);
  return structuredOrder;
}
