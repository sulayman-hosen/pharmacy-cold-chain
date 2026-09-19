# API reference

Base path: `/api`. All successful responses are JSON. `POST /hl7/dispatch` includes an HL7 ACK string inside JSON.

Login:

```http
POST /api/auth/login
Content-Type: application/json

{"username":"nurse","password":"YOUR_GENERATED_PASSWORD"}
```

The response sets an HttpOnly `coldline` session cookie and returns `{user, csrf}`. Send the cookie and `X-CSRF-Token: <csrf>` for every protected POST. `GET /auth/me` restores a session and returns the CSRF token. Never store credentials or clinical records in browser localStorage.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Process database readiness only |
| POST | `/auth/login` | Public | Authenticate; throttled |
| GET | `/auth/me` | Any signed-in role | Current session |
| POST | `/auth/logout` | Any signed-in role | Revoke session |
| GET | `/config` | Any signed-in role | Mode, formulary, courier aliases and public push key |
| GET | `/prescriptions/:id` | Nurse, pharmacist | Read authorized-floor EHR prescription summary |
| GET | `/indents` | Nurse, pharmacist | Last 100 assigned requests; nurse sees only own requests |
| POST | `/indents` | Nurse | Validate prescription/name/dose and create request |
| GET | `/indents/:id` | Nurse, pharmacist | Authorized request and original prescription snapshot |
| POST | `/indents/:id/validate` | Pharmacist | Re-read and approve |
| POST | `/indents/:id/pack` | Pharmacist | Record temperature, lot and expiry |
| POST | `/indents/:id/cancel` | Nurse, pharmacist | Cancel before departure |
| POST | `/indents/:id/sample-hl7` | Pharmacist, demo only | Generate a current OMP departure message |
| POST | `/hl7/dispatch` | Pharmacist | Parse/validate departure; transactional outbox |
| POST | `/indents/:id/receive` | Requesting nurse | Confirm delivery receipt |
| GET | `/notifications` | Nurse | Own safe alerts, last 50 |
| POST | `/notifications/:id/read` | Nurse | Mark own alert read |
| POST | `/push/subscriptions` | Nurse | Register an allowed Web Push endpoint |
| GET | `/audit` | Auditor | Last 100 signed audit entries |
| GET | `/audit/verify` | Auditor | Verify complete signed chain against head |
| GET | `/integrations` | Pharmacist, auditor | Last 100 job summaries; no clinical payloads |
| POST | `/integrations/:id/retry` | Pharmacist | Retry a terminally failed job |

Create a request:

```json
{
  "prescriptionId": "demo-order-01",
  "requestedName": "insulin glargine 100 UNT/ML Injectable Solution",
  "dose": 10,
  "unit": "[iU]",
  "route": "34206005"
}
```

Pack request body (use a future date):

```json
{"temperature":4,"lot":"DEMO-LOT-001","expiresAt":"2030-01-31T23:59:59.000Z"}
```

Demo HL7 generator body:

```json
{"courierId":"C-07","minutes":15,"temperature":4}
```

Dispatch body:

```json
{"message":"<the complete OMP^O09 message>"}
```

The workflow is requested → validated → packed → dispatch-pending → dispatched → received. Cancellation is allowed only from requested/validated/packed. Authorization and state transitions are enforced on the server, independent of UI buttons.

Errors:

```json
{"error":{"code":"DOSE_MISMATCH","message":"Dose, UCUM units and route must exactly match the prescription. No automatic conversions are performed.","requestId":"<opaque server request ID>"}}
```

Use the code for programmatic decisions. Error bodies and logs never include raw integration responses or incoming HL7. The worker writes stable reason codes to retry jobs, without upstream diagnostic text.
