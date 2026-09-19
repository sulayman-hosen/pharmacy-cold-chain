# Verification report

The delivered project was checked with Node.js 24.19.0 and npm 11.9.0.

| Check | Result |
|---|---|
| `npm test` | 25 tests passed; 0 failed; 0 skipped |
| React production build | Passed (Vite) |
| Production dependency audit | 0 known vulnerabilities reported at verification time |
| Real MongoDB replica-set integration | Passed, including transactions and concurrent duplicate dispatch |
| Browser workflow | Passed: nurse request, pharmacist approval, packing, generated HL7 departure, nurse alert and receipt |
| Mobile layout | Checked at 390 × 844; no document-level horizontal overflow |

Automated coverage includes authentication, CSRF, roles, assigned-floor access, request ownership, exact drug/dose/route checks, inactive/changed prescriptions, temperature boundaries, Redox parsing, unsupported HL7 fields, replay conflicts, privacy payload construction, audit tampering, outbox retry and session revocation.

A simulated FHIR outage was tested against the real MongoDB outbox: the chart stayed pending and the nurse alert was held; retry created one alert after the write succeeded.

Live-adapter tests use controlled HTTP responses and validate exact NIH query parameters, concept term types, fail-closed behavior, R4 version enforcement, MedicationReference resolution and stable-ID PUTs. No claim is made that the public NIH or HAPI services were exercised end to end. A real VAPID push subscription, external immutable archive, Docker/HAPI startup and a hospital implementation-guide validator were not provisioned or tested here.

The screenshots in this directory show the running app using synthetic records:

- `login.png`
- `dashboard.png`
- `delivery.png`
- `notifications.png`
- `mobile.png`

Re-run `npm run check` after changes. Clinical deployment needs the site-specific validation and controls described in README.
