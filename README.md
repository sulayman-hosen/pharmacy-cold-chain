# Coldline — Pharmacy Cold Chain to IPD

A runnable **MERN application** for the supplied candidate case: React + Express + Node.js + MongoDB/Mongoose. Includes a nurse workspace, pharmacist workflow, HL7 v2 integration, FHIR R4 adapters, private alerts, and a signed audit trail.

**বাংলায় শুরু করুন:** [START_HERE_BN.md](START_HERE_BN.md)

## Run the complete demo

Install **Node.js 22.12+** (Node 24 LTS recommended), then open a terminal inside this extracted folder:

```bash
npm install
npm run demo
```
DEMO_NURSE_PASSWORD=NursePass12345!
DEMO_PHARMACIST_PASSWORD=PharmaPass12345!
DEMO_AUDITOR_PASSWORD=AuditPass12345!
Open **http://localhost:4000**.

`demo` generates `.env` once, builds React, starts a real temporary MongoDB replica set, seeds synthetic records and accounts, and starts the API and background worker. The first run needs internet to download packages and the MongoDB binary. After installation and binary download, the demo integrations work without internet. Temporary demo data is discarded when the demo stops.

Find the generated passwords in `.env`:

| Username | Password setting | Access |
|---|---|---|
| `nurse` | `DEMO_NURSE_PASSWORD` | Read assigned-floor prescriptions; create and receive own requests; private inbox |
| `pharmacist` | `DEMO_PHARMACIST_PASSWORD` | Review, pack, process HL7 departure, inspect/retry integration jobs |
| `auditor` | `DEMO_AUDITOR_PASSWORD` | Read and verify the audit chain; inspect integration job metadata |

No usable passwords, database credentials, or signing keys are shipped in this ZIP. Do not put real patient data into the demo or public test servers.

## Walk through the case

1. Sign in as **nurse**. Click **New request → Read order**, using `demo-order-01`. Confirm the exact drug name, dose `10`, unit `[iU]`, and route. Click **Validate & submit**. `demo-order-02` is a second independent synthetic order with dose `12`.
2. Sign out and sign in as **pharmacist**. Open the request and **Approve request**. The application re-reads the prescription and rechecks terminology.
3. Record the packing temperature, lot, and expiry, then **Confirm packing**. The fixture’s configured transport range is 2–8°C. This is a demonstration policy, not a universal medication rule.
4. Choose a courier, ETA and departure temperature. Click **Generate demo HL7**, inspect/edit the message, then **Process departure**. In live mode, paste a message from the configured hospital interface.
5. The backend parses OMP^O09 using Redox, verifies patient/order/drug/dose/route, records departure and queues a deterministic FHIR `MedicationDispense` write. Until FHIR confirms the write, the status is **Chart sync pending**.
6. Once the chart update succeeds, the nurse gets an in-app alert with only the configured courier alias and ETA. Sign in as **nurse**, open **My notifications**, then open the request and **Confirm receipt**.
7. Sign in as **auditor** and open **Audit trail → Verify chain**.

In another browser or private window, you can keep the nurse and pharmacist sessions open simultaneously. The request list refreshes every 15 seconds; use Refresh for immediate updates. This demo permits one outstanding request per prescription. It is not a recurring-dose scheduling system.

## Persistent local development

Use Docker Desktop for MongoDB, or a MongoDB Atlas replica set:

```bash
npm install
npm run setup
docker compose up -d mongo
npm run seed
npm run dev
```

- React: **http://localhost:5173**
- Express API: **http://localhost:4000/api**
- Vite proxies `/api` to Express; the browser does not receive a database URI or EHR token.
- The root `.env` configures the server. MongoDB data persists in the `mongo-data` Docker volume.
- MongoDB transactions are required. A standalone `mongod` without a replica set is intentionally rejected.
- If port 27017 is already in use, stop the other local database or use Atlas and update `MONGO_URI`.
- For Atlas, supply your own URI with an explicit database, e.g. `mongodb+srv://USERNAME:ENCODED_PASSWORD@YOUR_CLUSTER/cold_chain`. Never commit `.env`.
- `npm run seed` is idempotent and does not reset existing accounts, passwords, records, or audit history. It is disabled when `NODE_ENV=production`.

For a built app with your persistent database:

```bash
npm run build
npm start
```

Both the React app and the API are served at **http://localhost:4000**. The server binds to loopback by default; use a TLS reverse proxy for deployment.

## Live FHIR + RxNorm integrations

This adapter explicitly targets **FHIR R4 4.0.1**. The supplied unversioned HL7 links currently describe R5; R4 has different medication and audit field shapes. The app checks `/metadata` and rejects incompatible versions.

For a local HAPI sandbox:

```bash
docker compose --profile fhir up -d
# Wait until http://localhost:8080/fhir/metadata responds.
npm run seed:fhir
```

In `.env`, set:

```dotenv
INTEGRATION_MODE=live
FHIR_BASE_URL=http://127.0.0.1:8080/fhir
ALLOW_LOCAL_HTTP=true
```

Restart with `npm run dev` or `npm start`. **Do not use `npm run demo` for live integration testing:** it deliberately overrides the mode to demo and uses its own temporary database.

In live mode:

- Prescriptions, encounters and referenced medications are read from the configured FHIR server.
- The requested name is looked up with NIH RxNorm `rxcui.json?name=…&search=0&allsrc=0`. It must resolve to exactly the prescribed RxCUI; concept properties must be SCD or SBD. No fuzzy match, ingredient-only match, brand substitution or unit conversion is treated as approval.
- FHIR writes use stable, application-generated resource IDs and `PUT`, so retries do not create another logical dispense resource. A server may retain additional history versions for repeated PUTs.
- All local FHIR AuditEvents are mirrored via the persistent outbox.
- API outages fail closed. Live failures never fall back to synthetic data.
- Use HTTPS for a remote private EHR and set `FHIR_BEARER_TOKEN` on the server as required. The token must have suitable read/write privileges. This project does not implement SMART on FHIR token refresh.
- An exact match is deliberately conservative. If a live terminology release retires a fixture code, the application blocks it; update the seed and approved formulary instead of bypassing the check.

`seed:fhir` creates only synthetic records and the local extension definitions. For safety, it only writes to localhost/127.0.0.1/a Docker host named `hapi`, and refuses production mode. HAPI Docker uses the upstream `latest` demo image; pin and validate a release for a maintained deployment. The included HAPI service is a disposable sandbox; the MongoDB volume is persistent.

The public HAPI R4 endpoint is `https://hapi.fhir.org/baseR4`, for synthetic tests only. Automated public-server seeding is deliberately not included.

## Notification delivery

The **authenticated nurse inbox works by default**. The generated notification payload contains only:

```json
{
  "title": "Delivery update",
  "body": "Courier 07 is on the way. ETA 14:30 UTC. Open Coldline for details.",
  "tag": "coldline-delivery",
  "url": "/"
}
```

It contains no patient identity, patient/order/encounter identifier, room/bed, drug, diagnosis, or request token. Data is constructed from an allowlist, not redacted with a regex. The courier comes from server-controlled aliases; arbitrary HL7 text cannot become the courier name. Internal routing IDs stay in the authenticated API, outside the push payload.

For real browser/phone **Web Push**, generate a VAPID key pair:

```bash
npx web-push generate-vapid-keys
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `.env`; restart. Sign in as the nurse and click **Enable phone alerts** in My notifications. Use a supported browser with notification permission and HTTPS for remote devices (localhost works for local testing). Push providers must be in `PUSH_ALLOWED_HOSTS`. No service worker caches patient records. Closed-app alerts require Web Push; the default inbox alone does not send an external pager/SMS message. Web Push delivery is at least once; the stable tag collapses duplicate visible notifications. Never put patient details in a push deep link.

## Audit integrity and HIPAA scope

The application implements relevant technical safeguards: assigned-floor/owner access, server-side expiring sessions, HttpOnly cookies, CSRF checks, origin checks, input limits, role restrictions, PHI-free notification payloads, and structured audit events. It **does not certify HIPAA compliance**. Deployment, organizational controls, vendor agreements, operational procedures and an appropriate security review remain necessary.

The audit collection is **tamper-evident**, not an honest claim of absolute “tamper-proof” storage:

- No application route can edit/delete an audit record.
- Every workflow change, receipt/idempotency record and outbox insertion is committed with its audit entry in a MongoDB transaction.
- Sequence, previous hash and the canonical FHIR AuditEvent are authenticated with HMAC-SHA256. The key is outside MongoDB.
- Verification detects edited records, gaps, reordering and tail truncation relative to the stored head.
- A database administrator who deletes/rolls back both history and head requires an independently retained checkpoint to be detected. A standard FHIR AuditEvent alone does not make storage immutable.

Export a signed archive while using the persistent database:

```bash
npm run audit:export -- .local/audit-export.json
node server/src/export-audit.js --verify .local/audit-export.json
```

Use a new filename for each export; existing archives are not overwritten. Retain the signed checkpoint and export in an independently managed WORM/Object Lock archive. A scheduled external archive/retention service is a deployment responsibility; no cloud immutability service is claimed to be configured in this ZIP. Protect and back up the audit key; rotating it requires an explicit key-version migration.

## Supported scope and limits

- One active inpatient encounter, one active floor, one coded full formulation, one fixed positive UCUM dose, one SNOMED route and a coded dispense quantity.
- Nurse access follows assigned floor and ownership of the request. The EHR owns prescription content; this UI cannot edit a doctor’s order.
- Supported medication reference forms: inline CodeableConcept, contained `#Medication`, or relative `Medication/id`. External references and unsupported modifiers are rejected.
- Complex, PRN, range or rate dosing requires manual review. This is a workflow validation exercise, not a drug-interaction checker, dose calculator or clinical decision support system.
- The transport policy and courier list are configured in `server/src/fixtures.js`. Demo ranges require approved, product-specific policies before clinical use. Spot temperatures do not provide continuous cold-chain monitoring.
- Prescription and encounter snapshots are re-read before approval, packing and departure. A change blocks progression and requires cancellation/recreation. Cross-system EHR changes cannot be locked atomically with MongoDB; an actual hospital integration must coordinate order changes around the handoff.
- `MedicationDispense.status` is `in-progress` at courier departure. Nurse receipt is a local delivery acknowledgement, not medication administration. This case does not claim to document administration or to complete the dispensing lifecycle in the EHR.
- The outbox retries with backoff, then holds a visible failed job after 8 attempts. A pharmacist can retry. Indents are not marked dispatched and nurse alerts are not released before successful chart write. Operational teams must monitor pending/failed syncs because the courier may already have departed.
- Rate limiting is local to one Node process. Multi-instance deployments need a shared limiter and appropriate network controls. Production cookie security requires HTTPS. The demo Docker Mongo service has no authentication and is bound to localhost only.
- Provide a real identity provider/MFA, production database credentials/encryption, secrets management, backups, scoped EHR authorization and immutable audit retention before clinical deployment. No live infrastructure is deployed by this project.

## Project map

| Path | Purpose |
|---|---|
| `client/src/main.jsx` | Nurse/pharmacist/auditor React workspaces |
| `client/src/styles.css` | Responsive visual design |
| `client/public/sw.js` | Minimal PHI-free Web Push worker; no offline data cache |
| `server/src/app.js` | Express endpoints, request schemas and protections |
| `server/src/fhir.js` | R4 reads, supported-order validation and dispense mapping |
| `server/src/rxnorm.js` | Exact live NIH validation and clearly separated fixtures |
| `server/src/hl7.js` | Actual Redox OMP parser and local ZCD schema |
| `server/src/workflow.js` | Transactional state changes and replay protection |
| `server/src/worker.js` | Persistent FHIR/push retry queue with expiring leases |
| `server/src/audit.js` | Signed chain and verification |
| `server/tests/` | Executable unit, adapter and real-Mongo integration tests |
| `docs/` | API, HL7 interface, implementation notes and verification report |
| `samples/` | Synthetic FHIR and HL7 examples |

## Verification

```bash
npm test
npm run build
# or both:
npm run check
```

Tests start their own real temporary MongoDB replica set and never connect to your configured application database. Live-adapter tests use controlled HTTP responses; they do not transmit data to public systems. See [docs/VERIFICATION.md](docs/VERIFICATION.md) for checks actually run and their limits.

## Official references

- [FHIR R4 MedicationRequest](https://hl7.org/fhir/R4/medicationrequest.html)
- [FHIR R4 MedicationDispense](https://hl7.org/fhir/R4/medicationdispense.html)
- [FHIR R4 AuditEvent](https://hl7.org/fhir/R4/auditevent.html)
- [NIH RxNorm exact-name search](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.findRxcuiByString.html)
- [NIH RxNorm concept properties](https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRxConceptProperties.html)
- [Redox open-source parser](https://github.com/RedoxEngine/redox-hl7-v2) — published package `@redox-opensource/redox-hl7-v2@2.0.0`
- [HAPI FHIR JPA Server Starter](https://github.com/hapifhir/hapi-fhir-jpaserver-starter)
- [HAPI public test sandbox](https://hapi.fhir.org/)
- [HHS Security Rule overview](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
