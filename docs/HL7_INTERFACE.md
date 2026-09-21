# HL7 interface contract — OMP^O09 + local ZCD

Transport: authenticated HTTP `POST /api/hl7/dispatch`. Send JSON `{ "message": "MSH|..." }`, `text/plain`, or `application/hl7-v2`. A pharmacist session and `X-CSRF-Token` are required. This demonstration has no TCP/MLLP listener. An MLLP-framed message body can be decoded through the HTTP endpoint.

The case uses OMP^O09 as its legacy order event. OMP is not itself a standard “courier departed” event: **ZCD is an explicitly documented local extension** agreed by this demo interface. Do not infer departure from any arbitrary new medication order.

The supported profile is a single order with **MSH, PID, ORC, RXO, RXR, ZCD** in that order, using `|^~\&` and HL7 **2.5.1**. CR, LF and CRLF segment separators are accepted. Unexpected/additional segments or repetitions are rejected instead of silently ignored. Redox parses all supported segment fields, components, escapes and the extended OMP message structure.

| Field | Meaning and validation |
|---|---|
| MSH-3 / MSH-4 | Configured sending app/facility (`PHARMACY`, `DEMO-HOSPITAL`) |
| MSH-5 | `COLDLINE` |
| MSH-9 | `OMP^O09^OMP_O09` |
| MSH-10 | Stable message control ID; sender/facility/control ID scopes idempotency |
| MSH-11 | `T` in demo; `P` in live |
| MSH-12 | `2.5.1` |
| PID-3.1 | Patient ID; in this local profile it maps directly to a FHIR Patient logical ID |
| PID-3.4.1 / PID-3.5 | Configured assigning facility / `MR` |
| ORC-1 / ORC-5 | `SC` (status change) / `IP` (in process) |
| ORC-2.1 / ORC-2.2 | FHIR MedicationRequest ID / `EHR` |
| ORC-3.1 / ORC-3.2 | Coldline indent UUID / `COLDLINE` |
| RXO-1.1 / RXO-1.2 / RXO-1.3 | RxCUI / complete drug formulation name / `RXNORM` |
| RXO-2 | Fixed dose; equals the FHIR dose |
| RXO-3 | Must be absent: dose ranges are unsupported |
| RXO-4.1 / RXO-4.3 | UCUM unit / `UCUM` |
| RXR-1.1 / RXR-1.3 | SNOMED route / `SCT` |
| ZCD-1 | `DEPARTED` |
| ZCD-2 | Server-configured courier ID, e.g. `C-07` |
| ZCD-3 | Actual departure instant, UTC ISO 8601 |
| ZCD-4 | ETA, UTC ISO 8601 |
| ZCD-5 | Recorded departure temperature in Celsius |

Departure must follow packing, be no more than five minutes old, and not be more than one minute ahead of server time. ETA must be future, later than departure and within four hours. The batch must remain valid through ETA. Packing and departure temperatures must satisfy the configured formulation policy. These are demonstration interface constraints, not generic HL7 or clinical rules.

Hospital MRNs are not generally identical to FHIR logical IDs. Before integrating a real hospital, replace this profile’s direct mapping with its authoritative assigning-authority/MPI resolution. Never match patients by name.

## Responses and retries

- **202**: message durably accepted; response includes `ack` with `MSA|AA|<control ID>`, and `indent.status=dispatch-pending`.
- **200**, `duplicate=true`: identical normalized message already accepted; no second logical dispense or alert is created.
- **409**: message control ID reused with different content or a conflicting state change.
- **422**: malformed/unsupported message or a patient, order, drug, dose, route, temperature or time mismatch.
- **503**: integration or audit unavailable; no new approval is granted.

Error responses are JSON with fixed codes and safe messages. They do not echo the raw HL7 body. An AA acknowledges durable local acceptance, not successful external chart synchronization. Inspect the integration queue for final chart-write status. A hospital MLLP adapter would need to translate these outcomes to its negotiated positive/negative ACK policy.

Raw HL7 is not persisted or logged. A digest is retained for replay comparison. Normalizing CR/LF does not change the digest; changing semantic fields does.

See `server/samples/departure-template.hl7`. Replace the indent ID and timestamps with current values, or use the demo generator. A static sample’s old timestamp is expected to fail the departure-time check.
