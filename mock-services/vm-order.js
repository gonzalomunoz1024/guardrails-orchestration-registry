/**
 * VM Order Service — mock external dependency service.
 *
 * Answers the question: "What is the status of a virtual machine provisioning order?"
 * Exposes a Swagger UI at /docs and an OpenAPI spec at /openapi.json so the OPA
 * Sandbox can browse its fields and inject responses into `input.external.<name>`.
 */
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const ORDERS = {
  'ord-1001': {
    orderId: 'ord-1001',
    vmName: 'prod-web-01',
    status: 'ready',
    requestedBy: 'jane.doe@example.com',
    region: 'us-east-1',
    instanceType: 'm5.xlarge',
    os: 'ubuntu-22.04',
    cpu: 4,
    memoryGb: 16,
    diskGb: 100,
    approval: { required: true, approvedBy: 'ops-lead@example.com', approvedAt: '2026-05-22T10:05:00Z' },
    costPerHour: 0.192,
    createdAt: '2026-05-22T09:40:00Z',
    readyAt: '2026-05-22T09:52:00Z',
  },
  'ord-1002': {
    orderId: 'ord-1002',
    vmName: 'analytics-gpu-03',
    status: 'provisioning',
    requestedBy: 'sam.lee@example.com',
    region: 'eu-west-1',
    instanceType: 'g4dn.2xlarge',
    os: 'ubuntu-22.04',
    cpu: 8,
    memoryGb: 32,
    diskGb: 250,
    approval: { required: true, approvedBy: null, approvedAt: null },
    costPerHour: 0.752,
    createdAt: '2026-05-26T08:15:00Z',
    readyAt: null,
  },
  'ord-1003': {
    orderId: 'ord-1003',
    vmName: 'dev-sandbox-12',
    status: 'failed',
    requestedBy: 'priya.n@example.com',
    region: 'us-west-2',
    instanceType: 't3.medium',
    os: 'amazon-linux-2',
    cpu: 2,
    memoryGb: 4,
    diskGb: 30,
    approval: { required: false, approvedBy: null, approvedAt: null },
    costPerHour: 0.0416,
    createdAt: '2026-05-25T16:20:00Z',
    readyAt: null,
  },
};

const exampleOrder = ORDERS['ord-1001'];

// ---------------------------------------------------------------------------
// OpenAPI specification
// ---------------------------------------------------------------------------
const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'VM Order Service API',
    version: '1.0.0',
    description:
      'Tracks virtual machine provisioning orders: their lifecycle status, ' +
      'specifications, approvals, and cost.',
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    '/orders': {
      get: {
        operationId: 'listOrders',
        summary: 'List all virtual machine orders',
        responses: {
          200: {
            description: 'Array of VM orders',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                example: Object.values(ORDERS),
              },
            },
          },
        },
      },
    },
    '/orders/{orderId}': {
      get: {
        operationId: 'getOrder',
        summary: 'Get the status of a single virtual machine order',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            description: 'VM order identifier (e.g. ord-1001)',
            schema: { type: 'string', example: 'ord-1001' },
          },
        ],
        responses: {
          200: {
            description: 'VM order status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
                example: exampleOrder,
              },
            },
          },
          404: { description: 'Order not found' },
        },
      },
    },
  },
  components: {
    schemas: {
      Order: {
        type: 'object',
        properties: {
          orderId: { type: 'string', example: 'ord-1001' },
          vmName: { type: 'string', example: 'prod-web-01' },
          status: {
            type: 'string',
            description: 'Lifecycle status of the VM order',
            enum: ['pending', 'provisioning', 'ready', 'failed', 'cancelled'],
            example: 'ready',
          },
          requestedBy: { type: 'string', example: 'jane.doe@example.com' },
          region: { type: 'string', example: 'us-east-1' },
          instanceType: { type: 'string', example: 'm5.xlarge' },
          os: { type: 'string', example: 'ubuntu-22.04' },
          cpu: { type: 'integer', example: 4 },
          memoryGb: { type: 'integer', example: 16 },
          diskGb: { type: 'integer', example: 100 },
          approval: { $ref: '#/components/schemas/Approval' },
          costPerHour: { type: 'number', format: 'float', example: 0.192 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-05-22T09:40:00Z' },
          readyAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-05-22T09:52:00Z' },
        },
      },
      Approval: {
        type: 'object',
        properties: {
          required: { type: 'boolean', example: true },
          approvedBy: { type: 'string', nullable: true, example: 'ops-lead@example.com' },
          approvedAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-05-22T10:05:00Z' },
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

app.get('/orders', (_req, res) => res.json(Object.values(ORDERS)));

app.get('/orders/:orderId', (req, res) => {
  const order = ORDERS[req.params.orderId];
  if (!order) return res.status(404).json({ error: 'Order not found', orderId: req.params.orderId });
  res.json(order);
});

app.get('/', (_req, res) =>
  res.json({ service: 'vm-order', docs: `http://localhost:${PORT}/docs`, openapi: `http://localhost:${PORT}/openapi.json` })
);

app.listen(PORT, () => {
  console.log(`VM Order Service listening on http://localhost:${PORT}`);
  console.log(`  Swagger UI: http://localhost:${PORT}/docs`);
});
