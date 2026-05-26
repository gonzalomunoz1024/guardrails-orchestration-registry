# Mock External Dependency Services

Two small Express apps that expose **Swagger UI + OpenAPI specs**, used by the OPA
Policy Sandbox to demo the **External Dependencies** feature end-to-end. Their
responses get injected into the OPA evaluation input under `input.external.<name>`.

| Service | Port | Answers | Swagger |
|---------|------|---------|---------|
| **Repository Registry** | 4001 | Is a repository registered, and what is its metadata? | http://localhost:4001/docs |
| **VM Order Service** | 4002 | What is the status of a VM provisioning order? | http://localhost:4002/docs |

## Run

```bash
cd mock-services
npm install
npm start          # runs both services concurrently
```

Or individually:

```bash
npm run repo-registry   # port 4001
npm run vm-order        # port 4002
```

CORS is enabled on both, so the sandbox frontend (http://localhost:3000) can fetch
them directly from the browser.

## Endpoints

### Repository Registry (`:4001`)
- `GET /repos` — all repositories and their registration status
- `GET /repos/{repoId}` — single repo (try `payments-api` registered, `marketing-site` public, `experimental-ml` unregistered)
- `GET /openapi.json` — spec consumed by the sandbox

### VM Order Service (`:4002`)
- `GET /orders` — all VM orders
- `GET /orders/{orderId}` — single order (try `ord-1001` ready, `ord-1002` provisioning, `ord-1003` failed)
- `GET /openapi.json` — spec consumed by the sandbox
