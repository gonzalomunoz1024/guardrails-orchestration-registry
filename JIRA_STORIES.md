# Jira Stories

## Frontend: OPA Policy Registry UI

**Type:** Story
**Priority:** High
**Points:** 21

### Summary
Build a web app for creating and managing OPA policies. Users should be able to write Rego policies, test them against sample inputs, and see how they'd affect existing resources before deploying.

### What we need

**Policy Creation Wizard**
- Form to capture policy metadata (name, description, resource type, enforcement type, tags)
- Monaco code editor with Rego syntax highlighting
- Side panel for test input JSON and configuration
- "Test Policy" button to run evaluation and see results
- Blast radius view to test against real system inputs

**Policy Management**
- Dashboard with policy counts and stats
- Searchable policy catalog with filters (status, resource type)
- Detail view for each policy showing code, test cases, versions

**Other**
- Dark/light mode
- Responsive panel layout (resizable editors)

### Tech stack
React, TypeScript, Vite, Tailwind, Monaco Editor, Zustand, React Query

---

## Backend: Policy Registry API

**Type:** Story
**Priority:** High
**Points:** 13

### Summary
API services to support the policy registry frontend. Needs to handle policy evaluation, test input queries, and basic policy management.

### Endpoints needed

**Evaluation**
- `POST /v1/opa/evaluate` - run a policy against input, return result
- `POST /v1/opa/validate` - check if rego syntax is valid

**Test Inputs**
- `GET /v1/test-inputs` - search/filter test inputs with pagination
  - filters: app id, org, environment, resource kind

**Policies**
- `GET /v1/policies` - list policies with filters
- `GET /v1/policies/:id` - get policy details

**Stats**
- `GET /v1/stats` - dashboard numbers (total, active, pending, draft counts)

### Notes
- Hook into existing OPA server for evaluation
- Test inputs come from existing data store
- Standard error responses, CORS for frontend
