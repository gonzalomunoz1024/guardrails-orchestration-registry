import type { ResourceKind } from '@/types/guardrail.types';

/**
 * Convert any legacy or backend-style resourceKind into the canonical
 * PascalCase form (acronyms preserved) the frontend stores everywhere.
 *
 * Handles:
 *   - SCREAMING_SNAKE_CASE persisted by older Studio builds
 *     (`VIRTUAL_MACHINE`, `MONGODB`, `ANY`)
 *   - The new wire form (`VirtualMachine`, `MongoDB`, `Any`, `CNAME`) —
 *     returned unchanged
 *   - Anything else falls back to `VirtualMachine` so the studio stays
 *     usable on unexpected input.
 */
export function normalizeResourceKind(raw: unknown): ResourceKind {
  if (typeof raw !== 'string') return 'VirtualMachine';
  switch (raw) {
    case 'Any':
    case 'ANY':
      return 'Any';
    case 'CNAME':
    case 'Cname':
    case 'CName':
      return 'CNAME';
    case 'MongoDB':
    case 'MONGODB':
    case 'Mongodb':
      return 'MongoDB';
    case 'VirtualMachine':
    case 'VIRTUAL_MACHINE':
    case 'Virtualmachine':
      return 'VirtualMachine';
    default:
      return 'VirtualMachine';
  }
}
