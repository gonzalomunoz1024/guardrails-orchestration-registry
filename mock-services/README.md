# Mock External Dependency Services

Two small Express apps that expose **Swagger UI + OpenAPI specs**, used by the OPA
Policy Sandbox to demo the **External Dependencies** feature end-to-end. Their
responses get injected into the OPA evaluation input under `input.external.<name>`.

| Service | Port | Answers | Swagger |
|---------|------|---------|---------|
| **Release Gatekeeper** | 4001 | Is an app enabled / eligible to go to production? | http://localhost:4001/docs |
| **VM Order Service** | 4002 | What is the status of a VM provisioning order? | http://localhost:4002/docs |

## Run

```bash
cd mock-services
npm install
npm start          # runs both services concurrently
```

Or individually:

```bash
npm run gatekeeper   # port 4001
npm run vm-order     # port 4002
```

CORS is enabled on both, so the sandbox frontend (http://localhost:3000) can fetch
them directly from the browser.

## Endpoints

### Release Gatekeeper (`:4001`)
- `GET /apps` — all apps and their production eligibility
- `GET /apps/{appId}` — single app (try `checkout-service`, `recommendation-engine`, `billing-batch`)
- `GET /openapi.json` — spec consumed by the sandbox

### VM Order Service (`:4002`)
- `GET /orders` — all VM orders
- `GET /orders/{orderId}` — single order (try `ord-1001` ready, `ord-1002` provisioning, `ord-1003` failed)
- `GET /openapi.json` — spec consumed by the sandbox
