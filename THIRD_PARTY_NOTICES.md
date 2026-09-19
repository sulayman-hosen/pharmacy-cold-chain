# Open-source dependencies

Application source in this project is provided for the requested candidate exercise. Third-party libraries retain their own licenses. `package-lock.json` records the exact installed dependency graph; `npm ci` reproduces that graph.

Key direct dependencies:

| Component | Upstream | License |
|---|---|---|
| React / React DOM | https://github.com/facebook/react | MIT |
| Express | https://github.com/expressjs/express | MIT |
| Mongoose | https://github.com/Automattic/mongoose | MIT |
| Redox HL7 v2 | https://github.com/RedoxEngine/redox-hl7-v2 | MIT |
| Vite | https://github.com/vitejs/vite | MIT |
| Zod | https://github.com/colinhacks/zod | MIT |
| web-push | https://github.com/web-push-libs/web-push | MIT |
| Lucide icons | https://github.com/lucide-icons/lucide | ISC |
| mongodb-memory-server | https://github.com/typegoose/mongodb-memory-server | MIT |

The demo/test helper downloads and runs a MongoDB Community binary. MongoDB Server has its own SSPL license. HAPI FHIR and the optional Docker images also retain their upstream licenses. No dependency source is copied into the ZIP; packages are installed from the committed manifests and lockfile.
