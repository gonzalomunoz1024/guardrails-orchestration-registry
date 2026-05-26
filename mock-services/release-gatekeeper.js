/**
 * Release Gatekeeper — mock external dependency service.
 *
 * Answers the question: "Is this application enabled / eligible to go to production?"
 * Exposes a Swagger UI at /docs and an OpenAPI spec at /openapi.json so the OPA
 * Sandbox can browse its fields and inject responses into `input.external.<name>`.
 */
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const APPS = {
  'checkout-service': {
    appId: 'checkout-service',
    name: 'Checkout Service',
    team: 'Payments',
    productionEnabled: true,
    riskScore: 12,
    checks: {
      securityScan: 'passed',
      unitTests: 'passed',
      codeReview: 'approved',
      changeApproval: 'approved',
    },
    environmentReadiness: { staging: true, canary: true, production: true },
    owner: 'jane.doe@example.com',
    lastDeployedAt: '2026-05-20T14:32:00Z',
  },
  'recommendation-engine': {
    appId: 'recommendation-engine',
    name: 'Recommendation Engine',
    team: 'Discovery',
    productionEnabled: false,
    riskScore: 68,
    checks: {
      securityScan: 'failed',
      unitTests: 'passed',
      codeReview: 'approved',
      changeApproval: 'pending',
    },
    environmentReadiness: { staging: true, canary: false, production: false },
    owner: 'sam.lee@example.com',
    lastDeployedAt: '2026-04-02T09:10:00Z',
  },
  'billing-batch': {
    appId: 'billing-batch',
    name: 'Billing Batch Processor',
    team: 'Finance Platform',
    productionEnabled: false,
    riskScore: 41,
    checks: {
      securityScan: 'passed',
      unitTests: 'failed',
      codeReview: 'pending',
      changeApproval: 'pending',
    },
    environmentReadiness: { staging: true, canary: false, production: false },
    owner: 'priya.n@example.com',
    lastDeployedAt: '2026-05-11T18:45:00Z',
  },
};

const exampleApp = APPS['checkout-service'];

// ---------------------------------------------------------------------------
// OpenAPI specification
// ---------------------------------------------------------------------------
const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Release Gatekeeper API',
    version: '1.0.0',
    description:
      'Reports whether an application is eligible to be promoted to production, ' +
      'including its release gating checks and per-environment readiness.',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    '/apps': {
      get: {
        operationId: 'listApps',
        summary: 'List all applications and their production eligibility',
        responses: {
          200: {
            description: 'Array of applications',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/App' } },
                example: Object.values(APPS),
              },
            },
          },
        },
      },
    },
    '/apps/{appId}': {
      get: {
        operationId: 'getApp',
        summary: 'Get production eligibility for a single application',
        parameters: [
          {
            name: 'appId',
            in: 'path',
            required: true,
            description: 'Application identifier (e.g. checkout-service)',
            schema: { type: 'string', example: 'checkout-service' },
          },
        ],
        responses: {
          200: {
            description: 'Application release status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/App' },
                example: exampleApp,
              },
            },
          },
          404: { description: 'Application not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      App: {
        type: 'object',
        properties: {
          appId: { type: 'string', example: 'checkout-service' },
          name: { type: 'string', example: 'Checkout Service' },
          team: { type: 'string', example: 'Payments' },
          productionEnabled: {
            type: 'boolean',
            description: 'True when the app is cleared to deploy to production',
            example: true,
          },
          riskScore: {
            type: 'integer',
            description: 'Aggregate release risk score (0 = safest, 100 = riskiest)',
            example: 12,
          },
          checks: { $ref: '#/components/schemas/Checks' },
          environmentReadiness: { $ref: '#/components/schemas/EnvironmentReadiness' },
          owner: { type: 'string', example: 'jane.doe@example.com' },
          lastDeployedAt: { type: 'string', format: 'date-time', example: '2026-05-20T14:32:00Z' },
        },
      },
      Checks: {
        type: 'object',
        properties: {
          securityScan: { type: 'string', enum: ['passed', 'failed'], example: 'passed' },
          unitTests: { type: 'string', enum: ['passed', 'failed'], example: 'passed' },
          codeReview: { type: 'string', enum: ['approved', 'pending'], example: 'approved' },
          changeApproval: { type: 'string', enum: ['approved', 'pending', 'rejected'], example: 'approved' },
        },
      },
      EnvironmentReadiness: {
        type: 'object',
        properties: {
          staging: { type: 'boolean', example: true },
          canary: { type: 'boolean', example: true },
          production: { type: 'boolean', example: true },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
app.use('/docs', swaggerUi.serveFiles(openapiSpec), swaggerUi.setup(openapiSpec));

app.get('/apps', (_req, res) => res.json(Object.values(APPS)));

app.get('/apps/:appId', (req, res) => {
  const app = APPS[req.params.appId];
  if (!app) return res.status(404).json({ error: 'Application not found', appId: req.params.appId });
  res.json(app);
});

app.get('/', (_req, res) =>
  res.json({ service: 'release-gatekeeper', docs: `http://localhost:${PORT}/docs`, openapi: `http://localhost:${PORT}/openapi.json` })
);

app.listen(PORT, () => {
  console.log(`Release Gatekeeper listening on http://localhost:${PORT}`);
  console.log(`  Swagger UI: http://localhost:${PORT}/docs`);
});
