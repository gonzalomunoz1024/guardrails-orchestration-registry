/**
 * Repository Registry — mock external dependency service.
 *
 * Answers the question: "Is this repository registered, and what is its
 * registration metadata?" Exposes a Swagger UI at /docs and an OpenAPI spec at
 * /openapi.json so the OPA Sandbox can browse its fields and inject responses
 * into `input.external.<name>`.
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
const REPOS = {
  'payments-api': {
    repoId: 'payments-api',
    name: 'payments-api',
    org: 'acme',
    registered: true,
    visibility: 'private',
    defaultBranch: 'main',
    language: 'go',
    owners: ['team-payments'],
    hasCodeowners: true,
    compliance: { tier: 'tier-1', sox: true, pci: true },
    topics: ['payments', 'backend'],
    registeredAt: '2025-11-03T12:00:00Z',
  },
  'marketing-site': {
    repoId: 'marketing-site',
    name: 'marketing-site',
    org: 'acme',
    registered: true,
    visibility: 'public',
    defaultBranch: 'main',
    language: 'typescript',
    owners: ['team-web'],
    hasCodeowners: false,
    compliance: { tier: 'tier-3', sox: false, pci: false },
    topics: ['frontend', 'marketing'],
    registeredAt: '2026-01-22T09:30:00Z',
  },
  'experimental-ml': {
    repoId: 'experimental-ml',
    name: 'experimental-ml',
    org: 'acme',
    registered: false,
    visibility: 'internal',
    defaultBranch: 'develop',
    language: 'python',
    owners: [],
    hasCodeowners: false,
    compliance: { tier: 'unrated', sox: false, pci: false },
    topics: ['research'],
    registeredAt: null,
  },
};

const exampleRepo = REPOS['payments-api'];

// ---------------------------------------------------------------------------
// OpenAPI specification
// ---------------------------------------------------------------------------
const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Repository Registry API',
    version: '1.0.0',
    description:
      'Reports whether a repository is registered in the central registry and ' +
      'exposes its registration metadata: ownership, visibility, and compliance.',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    '/repos': {
      get: {
        operationId: 'listRepos',
        summary: 'List all repositories and their registration status',
        responses: {
          200: {
            description: 'Array of repositories',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Repo' } },
                example: Object.values(REPOS),
              },
            },
          },
        },
      },
    },
    '/repos/{repoId}': {
      get: {
        operationId: 'getRepo',
        summary: 'Get registration status for a single repository',
        parameters: [
          {
            name: 'repoId',
            in: 'path',
            required: true,
            description: 'Repository identifier (e.g. payments-api)',
            schema: { type: 'string', example: 'payments-api' },
          },
        ],
        responses: {
          200: {
            description: 'Repository registration record',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Repo' },
                example: exampleRepo,
              },
            },
          },
          404: { description: 'Repository not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      Repo: {
        type: 'object',
        properties: {
          repoId: { type: 'string', example: 'payments-api' },
          name: { type: 'string', example: 'payments-api' },
          org: { type: 'string', example: 'acme' },
          registered: {
            type: 'boolean',
            description: 'True when the repository is registered in the central registry',
            example: true,
          },
          visibility: {
            type: 'string',
            enum: ['public', 'private', 'internal'],
            example: 'private',
          },
          defaultBranch: { type: 'string', example: 'main' },
          language: { type: 'string', example: 'go' },
          owners: {
            type: 'array',
            items: { type: 'string' },
            example: ['team-payments'],
          },
          hasCodeowners: { type: 'boolean', example: true },
          compliance: { $ref: '#/components/schemas/Compliance' },
          topics: {
            type: 'array',
            items: { type: 'string' },
            example: ['payments', 'backend'],
          },
          registeredAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: '2025-11-03T12:00:00Z',
          },
        },
      },
      Compliance: {
        type: 'object',
        properties: {
          tier: { type: 'string', example: 'tier-1' },
          sox: { type: 'boolean', example: true },
          pci: { type: 'boolean', example: true },
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

app.get('/repos', (_req, res) => res.json(Object.values(REPOS)));

app.get('/repos/:repoId', (req, res) => {
  const repo = REPOS[req.params.repoId];
  if (!repo) return res.status(404).json({ error: 'Repository not found', repoId: req.params.repoId });
  res.json(repo);
});

app.get('/', (_req, res) =>
  res.json({ service: 'repo-registry', docs: `http://localhost:${PORT}/docs`, openapi: `http://localhost:${PORT}/openapi.json` })
);

app.listen(PORT, () => {
  console.log(`Repository Registry listening on http://localhost:${PORT}`);
  console.log(`  Swagger UI: http://localhost:${PORT}/docs`);
});
