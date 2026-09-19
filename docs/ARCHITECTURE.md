# Implementation notes

## State and external side effects

Every domain transition commits in a MongoDB transaction with an HMAC-chained FHIR AuditEvent. Departure also commits the HL7 replay receipt and a `dispense` outbox row. No HTTP call is made inside a MongoDB transaction: transaction retries cannot directly repeat an external notification.

The worker leases eligible outbox rows for two minutes with a random fencing token. External requests have a timeout. The token is checked again when committing completion, so an expired worker cannot finalize a reclaimed job. An abandoned lease can be reclaimed after expiry. FHIR writes use stable IDs; inbox alerts use stable unique IDs. Web Push is at least once, with a collapse tag.

| Durable state | External state | Nurse alert |
|---|---|---|
| `packed` | No departure write | None |
| `dispatch-pending` | Write queued, working, retrying or failed | Held |
| `dispatched` | FHIR write confirmed | Inbox created; optional push queued |
| `received` | Prior departure remains in EHR | Nurse has confirmed the physical handoff locally |

Retry backoff starts at seconds, is capped at five minutes, and marks a job `dead` after eight failed attempts. A pharmacist can return a dead job to pending. A crash after a successful FHIR PUT but before local completion safely retries the same resource ID.

The audit head is updated in every workflow transaction. MongoDB write conflicts serialize concurrent operations and transaction retries, protecting the chain and the one-active-indent check. This single-head design prioritizes correctness for a candidate exercise; a high-throughput hospital needs a partitioning/anchoring design and capacity testing.

## FHIR R4 mapping

| Case requirement | Resource element |
|---|---|
| Official order | MedicationRequest `status`, `intent`, `subject`, `encounter`, medication choice, dosage, dispense quantity |
| Dispensed formulation | MedicationDispense `medicationCodeableConcept` |
| Patient / inpatient stay | `subject` / `context` |
| Prescription lineage | `authorizingPrescription` |
| Packaging staff | `performer.actor.identifier`, with `packager` function |
| Package prepared / courier leaves | `whenPrepared` / `whenHandedOver` |
| Destination | `destination` Location reference |
| Courier / ETA | Local `courier` Identifier extension / `estimated-arrival` dateTime extension |
| Recorded temperatures | Local Quantity extensions using UCUM `Cel` |
| Lot | Local `package-lot` string extension |
| Audit event | R4 `type`, `subtype`, `action`, `recorded`, `outcome`, `agent`, `source`, optional `entity` |

The namespace `https://coldchain.example.org/fhir` is a demo canonical namespace, not a claim of a published clinical implementation guide. `seed-fhir.js` installs the extension StructureDefinitions in a local sandbox. Site-specific implementation-guide validation remains required. The code intentionally does not mix R5 `medication`/`CodeableReference` or R5 AuditEvent fields into an R4 server.

## Privacy boundaries

- The EHR, MongoDB request snapshots and authenticated clinical screens can contain PHI. Restrict and encrypt these stores at deployment.
- RxNorm receives only the submitted drug formulation search string, never the patient/order object.
- The notification builder starts with a fresh object containing only title, controlled courier alias, ETA, generic tag and `/` URL.
- Courier IDs are resolved against trusted configuration. Neither free-form courier names nor raw ZCD fields are copied to a notification.
- Audit events carry actor identifiers and opaque indent references, without raw HL7 or prescription narratives. The audit archive itself still needs controlled access.
- Error messages are fixed safe strings. No request body, cookie, password, raw upstream OperationOutcome, medication message or credentials are logged.
- Sessions use high-entropy random tokens; only a SHA-256 token digest is stored. Passwords use salted scrypt. Expired sessions are rejected even before MongoDB TTL cleanup occurs.
- Browser pages/API responses are not cached for offline access. Service-worker notification clicks open the generic application root and require the normal session.

The demo is intentionally scoped; see README for unsupported dosing, clinical workflow, identity-provider, deployment, immutable-storage and regulatory requirements.
