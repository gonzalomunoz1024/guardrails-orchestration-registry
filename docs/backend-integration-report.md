# Backend Integration Report

**Date:** 2025-05-02
**Status:** Phase 1 Complete

---

## Executive Summary

This report documents the integration of the OPA Policy Registry frontend with the Guardrails Orchestrator Service backend. The integration replaces mocked frontend calls with real backend API calls where endpoints exist, and documents missing endpoints that require backend development.

---

## Key Domain Mapping

| Frontend Term | Backend Term |
|--------------|--------------|
| Policy | Guardrail |
| Policy Code | Not stored in backend (see missing endpoints) |
| Policy Configuration | Guardrail Configuration |
| Policy Status (draft/review/active/deprecated) | Guardrail Status (DRAFT/ACTIVE/INACTIVE) |
| Policy Author | Guardrail Owner |

---

## Files Created/Modified

### New Files Created

| File | Purpose |
|------|---------|
| `src/types/guardrail.types.ts` | Backend DTO type definitions |
| `src/utils/guardrailMapper.ts` | Mappers between backend DTOs and frontend models |
| `src/services/api/guardrailsApi.ts` | Backend API client service |
| `src/hooks/usePolicies.ts` | React Query hooks for policy operations |
| `src/hooks/useEvaluations.ts` | React Query hooks for evaluation queries |
| `docs/backend-integration-analysis.md` | Technical analysis document |
| `docs/missing-backend-endpoints.md` | Specification for missing backend endpoints |
| `docs/backend-integration-report.md` | This report |

### Modified Files

| File | Changes |
|------|---------|
| `src/services/api/index.ts` | Added guardrailsApi export |
| `src/types/index.ts` | Added guardrail.types export |
| `src/utils/index.ts` | Added guardrailMapper export |
| `src/hooks/index.ts` | Added usePolicies and useEvaluations exports |
| `src/components/views/Dashboard.tsx` | Uses usePolicies hook, computes stats from real data |
| `src/components/views/PolicyCatalog.tsx` | Uses usePolicies hook with loading/error states |
| `src/components/views/PolicyDetail.tsx` | Uses usePolicy hook with loading state |
| `src/components/views/BlastRadius.tsx` | Uses usePolicies hook for policy dropdown |

---

## Endpoints Integrated

### Guardrail Definitions

| Operation | Backend Endpoint | Status |
|-----------|-----------------|--------|
| List Guardrails | GET `/api/v1/registry/guardrails` | Integrated |
| Get Guardrail | GET `/api/v1/registry/guardrails/{id}` | Integrated |
| Create Guardrail | POST `/api/v1/registry/guardrails` | Integrated |
| Update Guardrail | PUT `/api/v1/registry/guardrails/{id}` | Integrated |
| Delete Guardrail | DELETE `/api/v1/registry/guardrails/{id}` | Integrated |

### Guardrail Configurations

| Operation | Backend Endpoint | Status |
|-----------|-----------------|--------|
| List Configurations | GET `/api/v1/registry/configurations` | Integrated |
| Get Configuration | GET `/api/v1/registry/configurations/{guardrailId}` | Integrated |
| Upsert Configuration | PUT `/api/v1/registry/configurations/{guardrailId}` | Integrated |
| Delete Configuration | DELETE `/api/v1/registry/configurations/{guardrailId}` | Integrated |

### Evaluations

| Operation | Backend Endpoint | Status |
|-----------|-----------------|--------|
| List Evaluations | GET `/api/v1/evaluations/all` | Integrated |
| Get Evaluation | GET `/api/v1/evaluations/{eventId}` | Integrated |
| Query by Correlation | GET `/api/v1/evaluations?correlationId={id}` | Integrated |
| Query by App | GET `/api/v1/evaluations/app/{appId}` | Integrated |

---

## Mocks Retained with Fallback

The following mock data is retained as fallback when backend is unavailable:

| Mock Data | Used By | Fallback Behavior |
|-----------|---------|-------------------|
| `mockPolicies` | Dashboard, PolicyCatalog, PolicyDetail, BlastRadius | Falls back when backend returns empty/error |
| `mockDashboardStats` | Dashboard | Used for evaluation stats (no backend endpoint) |
| `mockActivityEvents` | Dashboard | Used for activity feed (no backend endpoint) |
| `mockBlastRadiusResults` | BlastRadius | Used for test results (no backend endpoint) |

---

## Missing Backend Endpoints

The following endpoints are required by the frontend but do not exist in the backend:

| Priority | Endpoint | Frontend Flow |
|----------|----------|---------------|
| HIGH | Dashboard Statistics | Dashboard stat cards and metrics |
| HIGH | Blast Radius Execution | Run blast radius test button |
| HIGH | Blast Radius Results | Display test results |
| MEDIUM | Activity Events / Audit Log | Dashboard activity feed |
| MEDIUM | Guardrail Evaluation Stats | Policy stats display |
| MEDIUM | Extended Metadata (severity, category, tags) | Policy filtering and display |
| LOW | Version History | Policy versions tab |
| LOW | Test Case Management | Policy tests tab |
| HIGH/LOW | Policy Code Storage | Store Rego code (depends on architecture) |

See `docs/missing-backend-endpoints.md` for complete specifications including proposed paths, request/response schemas, and sample payloads.

---

## Composed Workflows Implemented

### Save Policy (Create/Update)

```
1. Create/Update Guardrail Definition
   POST/PUT /api/v1/registry/guardrails/{id}

2. Upsert Configuration
   PUT /api/v1/registry/configurations/{guardrailId}
```

The `guardrailsApi.savePolicy()` method handles this composed workflow, including:
- Creating guardrail first to get ID for new policies
- Updating both resources for existing policies
- Handling partial failures gracefully

### Delete Policy

```
1. Delete Configuration (if exists)
   DELETE /api/v1/registry/configurations/{guardrailId}

2. Delete Guardrail Definition
   DELETE /api/v1/registry/guardrails/{id}
```

---

## Field Mapping Issues

### Fields in Frontend but NOT in Backend

| Frontend Field | Notes |
|---------------|-------|
| `severity` | Inferred from `enforcementType` |
| `category` | Inferred from `resourceType`/`kind` |
| `tags` | Not stored in backend |
| `regoCode` | Not stored in guardrail definition |
| `testCases` | Not in backend |
| `stats` | Requires stats endpoint |
| `versions` | Requires version history endpoint |
| `approvedBy` / `approvedAt` | Not in backend |

### Fields in Backend but NOT in Frontend

| Backend Field | Notes |
|--------------|-------|
| `enforcementType` | MANDATORY / OPTIONAL |
| `kind` | PRECHECK / POSTCHECK |
| `resourceType` | LIGHTSPEED / VMFORGE |
| `resourceKind` | VIRTUAL_MACHINE / MONGO_DB |
| `scopeExclusions` | LOB exclusions |

The `guardrailMapper.ts` utility handles these mapping discrepancies.

---

## Loading and Error States

All integrated components now handle:

1. **Loading State**: Shows spinner while fetching data
2. **Error State**: Falls back to mock data with retry option
3. **Empty State**: Shows appropriate message when no data

---

## Testing Recommendations

### Manual Verification Steps

1. **Verify Backend Connection**
   - Ensure `VITE_API_BASE_URL` points to running backend
   - Check browser console for API call logs

2. **Test Policy Listing**
   - Navigate to Policies view
   - Verify policies load from backend (not mock)
   - Test filtering works with real data

3. **Test Policy Detail**
   - Click on a policy
   - Verify detail loads with configuration

4. **Test Create/Update Flow**
   - Create new policy in Create Policy view
   - Verify it appears in policy list
   - Update policy and verify changes persist

5. **Test Delete Flow**
   - Delete a policy
   - Verify it's removed from list

### Automated Test Updates

Consider adding:
- Integration tests for `guardrailsApi` methods
- Unit tests for `guardrailMapper` functions
- E2E tests for policy CRUD flows

---

## Environment Configuration

### Required Environment Variables

```bash
# Backend API base URL
VITE_API_BASE_URL=http://localhost:8181/api

# For production
VITE_API_BASE_URL=/api
```

### Vite Proxy Configuration

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8181',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

---

## Open Questions for Backend Team

1. **Policy Code Storage**: Where should Rego policy code be stored?
   - As part of configuration?
   - As a separate resource?
   - In an external OPA server?

2. **Severity/Category Fields**: Should these be added to the guardrail definition schema or remain frontend-only?

3. **Version History**: Is there an existing versioning mechanism for guardrails?

4. **Blast Radius Implementation**: What data source should blast radius tests use?

5. **Activity/Audit Log**: Is there an existing audit log system to integrate with?

---

## Next Steps

1. **Backend Team**: Review `docs/missing-backend-endpoints.md` and prioritize endpoint implementation

2. **Frontend Team**:
   - Remove mock data fallbacks once backend endpoints are stable
   - Add comprehensive error handling for edge cases
   - Implement remaining features as backend endpoints become available

3. **Integration Testing**: Set up E2E tests with mock backend

---

## Conclusion

Phase 1 backend integration is complete. The frontend now:
- Fetches policies from real backend endpoints
- Falls back to mock data when backend is unavailable
- Has a clean API client layer for all backend operations
- Documents all missing endpoints for backend development

The integration architecture is designed for incremental backend development - new endpoints can be connected without major frontend changes.
