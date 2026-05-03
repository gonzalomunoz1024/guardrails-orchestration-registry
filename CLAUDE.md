# OPA Policy Registry - Development Guide

## Project Overview

A React frontend for creating, testing, and managing OPA (Open Policy Agent) policies. The application provides a VS Code-like experience for writing Rego policies with integrated input/configuration editors, datasource injection, blast radius evaluation, and policy metadata management.

### Core Features

1. **Rego Code Editor** - Monaco Editor with Rego syntax highlighting and auto-completion
2. **Input Editor** - JSON editor for policy input (runtime data)
3. **Configuration Editor** - JSON editor for OPA data/reference configuration
4. **Output Panel** - Evaluation results display with success/error states
5. **Datasource Integration** - Browse and inject dependencies from backend services
6. **Blast Radius Evaluation** - Test policies against existing system inputs
7. **Metadata Management** - Policy name, description, tags, version tracking

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS 4 + CSS Custom Properties |
| Code Editor | Monaco Editor (@monaco-editor/react) |
| Client State | Zustand |
| Server State | TanStack Query (React Query) |
| HTTP Client | Axios |
| Layout | react-resizable-panels |
| Icons | lucide-react |
| Testing | Vitest + React Testing Library |

## Project Structure

```
src/
├── app/                          # Application entry
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Vite entry point
│   └── routes.tsx                # Route definitions
│
├── components/                   # UI Components
│   ├── common/                   # Shared components
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Modal/
│   │   ├── Badge/
│   │   └── Tooltip/
│   │
│   ├── editors/                  # Monaco Editor wrappers
│   │   ├── PolicyEditor/         # Rego code editor
│   │   ├── InputEditor/          # JSON input editor
│   │   ├── ConfigEditor/         # JSON config editor
│   │   └── EditorToolbar/        # Shared editor controls
│   │
│   ├── panels/                   # Panel components
│   │   ├── OutputPanel/          # Evaluation results
│   │   ├── DatasourcePanel/      # Datasource browser
│   │   └── BlastRadiusPanel/     # Impact visualization
│   │
│   ├── forms/                    # Form components
│   │   └── MetadataForm/         # Policy metadata
│   │
│   └── layout/                   # Layout components
│       ├── Header/
│       ├── ResizablePanelLayout/
│       └── SidePanel/
│
├── hooks/                        # Custom React hooks
│   ├── usePolicy.ts              # Policy state
│   ├── useDatasources.ts         # Datasource fetching
│   ├── useEvaluate.ts            # Policy evaluation
│   ├── useBlastRadius.ts         # Blast radius analysis
│   ├── useTheme.ts               # Theme management
│   └── useDebounce.ts            # Input debouncing
│
├── services/                     # API layer
│   └── api/
│       ├── client.ts             # Axios configuration
│       ├── policyApi.ts          # Policy CRUD
│       ├── datasourceApi.ts      # Datasource endpoints
│       └── evaluationApi.ts      # OPA evaluation
│
├── store/                        # Zustand stores
│   ├── policyStore.ts            # Policy editor state
│   ├── evaluationStore.ts        # Evaluation results
│   ├── datasourceStore.ts        # Datasource state
│   └── uiStore.ts                # UI state
│
├── monaco/                       # Monaco configuration
│   ├── languages/
│   │   └── rego.ts               # Rego language definition
│   ├── themes/
│   │   ├── light.ts
│   │   └── dark.ts
│   └── config.ts                 # Monaco setup
│
├── styles/                       # Global styles
│   ├── index.css                 # Tailwind + imports
│   ├── variables.css             # Design tokens
│   └── animations.css            # Keyframe animations
│
├── types/                        # TypeScript types
│   ├── policy.types.ts
│   ├── datasource.types.ts
│   └── evaluation.types.ts
│
└── utils/                        # Utilities
    ├── formatters.ts
    └── validators.ts
```

## Setup Instructions

### Initial Setup (Migrate from CRA to Vite)

```bash
# 1. Remove CRA dependencies
npm uninstall react-scripts

# 2. Install Vite and core dependencies
npm install -D vite @vitejs/plugin-react-swc typescript @types/react @types/react-dom

# 3. Install Tailwind CSS 4
npm install -D tailwindcss @tailwindcss/vite

# 4. Install application dependencies
npm install @monaco-editor/react react-resizable-panels zustand @tanstack/react-query axios lucide-react clsx tailwind-merge

# 5. Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### Configuration Files

**vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## Design System

This application follows Apple's design language. Use these design tokens consistently.

### CSS Custom Properties (src/styles/variables.css)

```css
:root {
  /* Background Colors */
  --color-background: #ffffff;
  --color-surface: #ffffff;
  --color-surface-secondary: #f5f5f7;
  --color-surface-tertiary: #fbfbfd;

  /* Text Colors */
  --color-text-primary: #1d1d1f;
  --color-text-secondary: #6e6e73;
  --color-text-tertiary: #86868b;

  /* Border Colors */
  --color-border: #d2d2d7;
  --color-border-light: #e8e8ed;

  /* Semantic Colors */
  --color-success: #34c759;
  --color-error: #ff3b30;
  --color-warning: #ff9500;
  --color-info: #007aff;
  --color-neutral: #8e8e93;

  /* Background variants for semantic colors */
  --color-success-bg: rgba(52, 199, 89, 0.12);
  --color-error-bg: rgba(255, 59, 48, 0.12);
  --color-warning-bg: rgba(255, 149, 0, 0.12);
  --color-info-bg: rgba(0, 122, 255, 0.12);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.08);

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  --font-mono: 'SF Mono', ui-monospace, Menlo, 'Cascadia Code', monospace;

  /* Glass Morphism */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-blur: 20px;
  --glass-border: rgba(255, 255, 255, 0.18);
}

/* Dark Mode */
.dark {
  --color-background: #000000;
  --color-surface: #000000;
  --color-surface-secondary: #1c1c1e;
  --color-surface-tertiary: #2c2c2e;

  --color-text-primary: #f5f5f7;
  --color-text-secondary: #86868b;
  --color-text-tertiary: #636366;

  --color-border: #38383a;
  --color-border-light: #2c2c2e;

  --glass-bg: rgba(28, 28, 30, 0.72);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

### Component Patterns

**Card Component**
```tsx
<div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)]
  bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-4">
  {children}
</div>
```

**Glass Morphism Header**
```tsx
<header className="sticky top-0 z-50 border-b border-[var(--color-border-light)]
  bg-[var(--color-surface)]/80 backdrop-blur-xl">
  {/* content */}
</header>
```

**Button Variants**
```tsx
// Primary
<button className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)]
  text-white font-medium transition-all hover:opacity-90">
  Evaluate
</button>

// Secondary
<button className="px-4 py-2 rounded-[var(--radius-md)]
  bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]
  font-medium transition-all hover:bg-[var(--color-border-light)]">
  Cancel
</button>
```

**Status Badge**
```tsx
// Success
<span className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold
  bg-[var(--color-success-bg)] text-[var(--color-success)]">
  Allowed
</span>

// Error
<span className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold
  bg-[var(--color-error-bg)] text-[var(--color-error)]">
  Denied
</span>
```

### Typography Scale

- **Headings**: Font weight 600, primary text color
- **Body**: Font weight 400, primary or secondary text color
- **Labels**: Font size 12px (text-xs), secondary text color
- **Code/Mono**: Use `--font-mono` for all code content

### Spacing

Use Tailwind's spacing scale consistently:
- `gap-2` (8px) - Between small elements
- `gap-3` (12px) - Between related elements
- `gap-4` (16px) - Standard component spacing
- `gap-6` (24px) - Between sections
- `p-4` (16px) - Standard card padding
- `p-6` (24px) - Large section padding

### Animations

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}

.animate-slide-in {
  animation: slideIn 0.25s ease-out forwards;
}
```

Use `transition-all duration-200` for hover states.

## Monaco Editor Configuration

### Rego Language Definition (src/monaco/languages/rego.ts)

```typescript
import * as monaco from 'monaco-editor';

export const regoLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
};

export const regoMonarchTokens: monaco.languages.IMonarchLanguage = {
  defaultToken: 'invalid',

  keywords: [
    'package', 'import', 'as', 'default', 'else', 'not', 'with',
    'null', 'true', 'false', 'some', 'every', 'in', 'if', 'contains',
  ],

  operators: [
    '=', '==', '!=', '<', '>', '<=', '>=',
    '+', '-', '*', '/', '%', '&', '|', ':=',
  ],

  builtins: [
    'count', 'sum', 'product', 'max', 'min', 'sort',
    'array.concat', 'array.slice', 'intersection', 'union',
    'concat', 'contains', 'endswith', 'startswith', 'lower', 'upper',
    'trim', 'split', 'sprintf', 'format_int', 'indexof', 'replace',
    'is_array', 'is_boolean', 'is_null', 'is_number', 'is_object',
    'is_set', 'is_string', 'type_name', 'json.marshal', 'json.unmarshal',
    'base64.encode', 'base64.decode', 'time.now_ns', 'time.parse_ns',
    'http.send', 'opa.runtime', 'trace', 'print',
  ],

  tokenizer: {
    root: [
      [/#.*$/, 'comment'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/`/, 'string', '@string_raw'],
      [/\d+\.\d+/, 'number.float'],
      [/\d+/, 'number'],
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@builtins': 'predefined',
          '@default': 'identifier',
        },
      }],
      [/:=|==|!=|<=|>=|[=<>+\-*/%&|]/, 'operator'],
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      [/\s+/, 'white'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
    string_raw: [
      [/[^`]+/, 'string'],
      [/`/, 'string', '@pop'],
    ],
  },
};

export function registerRegoLanguage() {
  monaco.languages.register({ id: 'rego' });
  monaco.languages.setLanguageConfiguration('rego', regoLanguageConfig);
  monaco.languages.setMonarchTokensProvider('rego', regoMonarchTokens);
}
```

### Editor Component Pattern

```tsx
import Editor from '@monaco-editor/react';
import { useTheme } from '@/hooks/useTheme';

interface PolicyEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export function PolicyEditor({ value, onChange }: PolicyEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="h-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)]">
      <Editor
        height="100%"
        language="rego"
        theme={resolvedTheme === 'dark' ? 'rego-dark' : 'rego-light'}
        value={value}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
```

## State Management

### Zustand Store Pattern

```typescript
// src/store/policyStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PolicyMetadata {
  name: string;
  description: string;
  tags: string[];
  version: string;
  author: string;
}

interface PolicyState {
  // State
  regoCode: string;
  inputJson: string;
  configJson: string;
  metadata: PolicyMetadata;

  // Actions
  setRegoCode: (code: string) => void;
  setInputJson: (json: string) => void;
  setConfigJson: (json: string) => void;
  updateMetadata: (metadata: Partial<PolicyMetadata>) => void;
  resetPolicy: () => void;
}

const initialMetadata: PolicyMetadata = {
  name: '',
  description: '',
  tags: [],
  version: '1.0.0',
  author: '',
};

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set) => ({
      regoCode: '',
      inputJson: '{}',
      configJson: '{}',
      metadata: initialMetadata,

      setRegoCode: (code) => set({ regoCode: code }),
      setInputJson: (json) => set({ inputJson: json }),
      setConfigJson: (json) => set({ configJson: json }),
      updateMetadata: (metadata) => set((state) => ({
        metadata: { ...state.metadata, ...metadata },
      })),
      resetPolicy: () => set({
        regoCode: '',
        inputJson: '{}',
        configJson: '{}',
        metadata: initialMetadata,
      }),
    }),
    { name: 'policy-storage' }
  )
);
```

### React Query Pattern

```typescript
// src/hooks/useDatasources.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { datasourceApi } from '@/services/api/datasourceApi';

export function useDatasources() {
  return useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDatasource(id: string) {
  return useQuery({
    queryKey: ['datasource', id],
    queryFn: () => datasourceApi.getById(id),
    enabled: !!id,
  });
}
```

## API Integration

### API Client Setup

```typescript
// src/services/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors, handle auth failures, etc.
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
```

### Evaluation API

```typescript
// src/services/api/evaluationApi.ts
import { apiClient } from './client';

export interface EvaluateRequest {
  policy: string;
  input: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface EvaluateResponse {
  result: unknown;
  decision_id?: string;
  metrics?: {
    timer_rego_query_eval_ns: number;
    timer_rego_query_compile_ns: number;
  };
}

export const evaluationApi = {
  evaluate: async (request: EvaluateRequest): Promise<EvaluateResponse> => {
    const response = await apiClient.post<EvaluateResponse>('/v1/evaluate', request);
    return response.data;
  },

  validatePolicy: async (policy: string): Promise<{ valid: boolean; errors?: string[] }> => {
    const response = await apiClient.post('/v1/validate', { policy });
    return response.data;
  },
};
```

## Layout Pattern

### Resizable Panel Layout

```tsx
// src/components/layout/ResizablePanelLayout.tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export function EditorLayout() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Left: Rego Editor + Input */}
      <Panel defaultSize={40} minSize={25}>
        <PanelGroup direction="vertical">
          <Panel defaultSize={60} minSize={20}>
            <PolicyEditor />
          </Panel>
          <PanelResizeHandle className="h-1 bg-[var(--color-border-light)]
            hover:bg-[var(--color-info)] transition-colors" />
          <Panel defaultSize={40} minSize={20}>
            <InputEditor />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="w-1 bg-[var(--color-border-light)]
        hover:bg-[var(--color-info)] transition-colors" />

      {/* Center: Config + Output */}
      <Panel defaultSize={35} minSize={25}>
        <PanelGroup direction="vertical">
          <Panel defaultSize={50} minSize={20}>
            <ConfigEditor />
          </Panel>
          <PanelResizeHandle className="h-1 bg-[var(--color-border-light)]
            hover:bg-[var(--color-info)] transition-colors" />
          <Panel defaultSize={50} minSize={20}>
            <OutputPanel />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="w-1 bg-[var(--color-border-light)]
        hover:bg-[var(--color-info)] transition-colors" />

      {/* Right: Side Panels */}
      <Panel defaultSize={25} minSize={15} collapsible>
        <SidePanelContainer />
      </Panel>
    </PanelGroup>
  );
}
```

## Testing Conventions

### Test Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, ...props }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  ),
}));
```

### Component Test Pattern

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OutputPanel } from './OutputPanel';

describe('OutputPanel', () => {
  it('displays success state for allowed decision', () => {
    render(<OutputPanel result={{ allow: true }} />);

    expect(screen.getByText(/allowed/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-[var(--color-success)]');
  });

  it('displays error state for denied decision', () => {
    render(<OutputPanel result={{ allow: false }} />);

    expect(screen.getByText(/denied/i)).toBeInTheDocument();
  });

  it('shows loading state during evaluation', () => {
    render(<OutputPanel isEvaluating />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

## Development Workflow

### Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run typecheck

# Lint
npm run lint
```

### File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `PolicyEditor.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `usePolicy.ts`)
- Stores: `camelCase.ts` with `Store` suffix (e.g., `policyStore.ts`)
- Types: `camelCase.types.ts` (e.g., `policy.types.ts`)
- Tests: `ComponentName.test.tsx` (co-located with component)

### Git Commit Format

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- style: Styling changes
- test: Adding tests
- docs: Documentation
- chore: Build/config changes
```

## Environment Variables

```bash
# .env
VITE_API_BASE_URL=http://localhost:8080/api

# .env.production
VITE_API_BASE_URL=/api
```

## Key Dependencies Reference

| Package | Purpose | Docs |
|---------|---------|------|
| @monaco-editor/react | Code editor | https://github.com/suren-atoyan/monaco-react |
| react-resizable-panels | Split pane layout | https://github.com/bvaughn/react-resizable-panels |
| zustand | State management | https://zustand-demo.pmnd.rs/ |
| @tanstack/react-query | Server state | https://tanstack.com/query |
| lucide-react | Icons | https://lucide.dev/icons |
| tailwind-merge | Class merging | https://github.com/dcastil/tailwind-merge |
| octokit | GitHub API client | https://github.com/octokit/octokit.js |

---

## GitHub Integration

After a user creates a policy, runs test suites, and populates metadata, they can submit the policy as a Pull Request to the enterprise GitHub repository.

### PR File Structure

When a PR is created, the following files are added to the repository:

```
policies/
└── <policy-name>.rego          # The Rego policy file

configuration/
└── <policy-name>.json          # The data/configuration JSON
```

### GitHub OAuth Flow

The application uses GitHub OAuth to authenticate users before they can create PRs.

**Flow:**
1. User clicks "Create Pull Request" button
2. If not authenticated, redirect to GitHub OAuth authorization
3. GitHub redirects back with authorization code
4. Backend exchanges code for access token
5. Token stored securely (httpOnly cookie or encrypted localStorage)
6. User can now create PRs on behalf of their GitHub account

### Environment Variables for GitHub

```bash
# .env
VITE_GITHUB_CLIENT_ID=your_github_oauth_app_client_id
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/auth/github/callback
VITE_GITHUB_REPO_OWNER=your-org
VITE_GITHUB_REPO_NAME=policy-registry

# Backend .env (for token exchange)
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
```

### Auth Store

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

interface AuthState {
  // State
  isAuthenticated: boolean;
  user: GitHubUser | null;
  accessToken: string | null;

  // Actions
  setAuth: (user: GitHubUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,

      setAuth: (user, token) => set({
        isAuthenticated: true,
        user,
        accessToken: token,
      }),

      logout: () => set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist non-sensitive data
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        // Token should be stored securely via httpOnly cookie in production
      }),
    }
  )
);
```

### GitHub API Service

```typescript
// src/services/api/githubApi.ts
import { Octokit } from 'octokit';
import { useAuthStore } from '@/store/authStore';

const REPO_OWNER = import.meta.env.VITE_GITHUB_REPO_OWNER;
const REPO_NAME = import.meta.env.VITE_GITHUB_REPO_NAME;

export interface CreatePRRequest {
  policyName: string;
  regoCode: string;
  configJson: string;
  metadata: {
    description: string;
    author: string;
    tags: string[];
  };
}

export interface CreatePRResponse {
  prNumber: number;
  prUrl: string;
  branchName: string;
}

export const githubApi = {
  /**
   * Initialize GitHub OAuth flow
   */
  initiateOAuth: () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI;
    const scope = 'repo'; // Need repo access to create PRs

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', crypto.randomUUID());

    // Store state for CSRF protection
    sessionStorage.setItem('github_oauth_state', authUrl.searchParams.get('state')!);

    window.location.href = authUrl.toString();
  },

  /**
   * Exchange authorization code for access token (via backend)
   */
  exchangeCodeForToken: async (code: string, state: string): Promise<{ token: string; user: any }> => {
    const storedState = sessionStorage.getItem('github_oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }
    sessionStorage.removeItem('github_oauth_state');

    // Exchange code via backend to protect client secret
    const response = await fetch('/api/auth/github/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    return response.json();
  },

  /**
   * Create a Pull Request with the policy files
   */
  createPullRequest: async (request: CreatePRRequest): Promise<CreatePRResponse> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Not authenticated with GitHub');
    }

    const octokit = new Octokit({ auth: token });
    const branchName = `policy/${request.policyName}-${Date.now()}`;

    // 1. Get the default branch SHA
    const { data: repo } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });

    const defaultBranch = repo.default_branch;

    const { data: ref } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${defaultBranch}`,
    });

    const baseSha = ref.object.sha;

    // 2. Create a new branch
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    // 3. Create the policy file
    const policyPath = `policies/${request.policyName}.rego`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: policyPath,
      message: `Add policy: ${request.policyName}`,
      content: btoa(request.regoCode), // Base64 encode
      branch: branchName,
    });

    // 4. Create the configuration file
    const configPath = `configuration/${request.policyName}.json`;
    const configContent = JSON.stringify(JSON.parse(request.configJson), null, 2);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: configPath,
      message: `Add configuration for policy: ${request.policyName}`,
      content: btoa(configContent), // Base64 encode
      branch: branchName,
    });

    // 5. Create the Pull Request
    const prBody = `## New Policy: ${request.policyName}

${request.metadata.description}

### Files Added
- \`${policyPath}\` - Rego policy
- \`${configPath}\` - Policy configuration

### Metadata
- **Author**: ${request.metadata.author}
- **Tags**: ${request.metadata.tags.join(', ') || 'None'}

---
*Created via OPA Policy Registry*`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `[Policy] Add ${request.policyName}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
    });

    return {
      prNumber: pr.number,
      prUrl: pr.html_url,
      branchName,
    };
  },

  /**
   * Get authenticated user info
   */
  getUser: async (): Promise<any> => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new Error('Not authenticated');
    }

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();
    return data;
  },
};
```

### GitHub Auth Hook

```typescript
// src/hooks/useGitHubAuth.ts
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { githubApi } from '@/services/api/githubApi';

export function useGitHubAuth() {
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();

  const login = useCallback(() => {
    githubApi.initiateOAuth();
  }, []);

  return {
    isAuthenticated,
    user,
    login,
    logout,
  };
}

/**
 * Hook for handling OAuth callback
 * Use this in the /auth/github/callback route
 */
export function useGitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('GitHub OAuth error:', error);
      navigate('/?auth_error=' + error);
      return;
    }

    if (code && state) {
      githubApi.exchangeCodeForToken(code, state)
        .then(({ token, user }) => {
          setAuth(user, token);
          navigate('/?auth_success=true');
        })
        .catch((err) => {
          console.error('Token exchange failed:', err);
          navigate('/?auth_error=token_exchange_failed');
        });
    }
  }, [searchParams, setAuth, navigate]);
}
```

### Create PR Hook

```typescript
// src/hooks/useCreatePR.ts
import { useMutation } from '@tanstack/react-query';
import { githubApi, CreatePRRequest, CreatePRResponse } from '@/services/api/githubApi';
import { usePolicyStore } from '@/store/policyStore';
import { useAuthStore } from '@/store/authStore';

export function useCreatePR() {
  const { regoCode, configJson, metadata } = usePolicyStore();
  const { isAuthenticated } = useAuthStore();

  const mutation = useMutation<CreatePRResponse, Error, void>({
    mutationFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Please sign in with GitHub first');
      }

      if (!metadata.name) {
        throw new Error('Policy name is required');
      }

      const request: CreatePRRequest = {
        policyName: metadata.name.toLowerCase().replace(/\s+/g, '-'),
        regoCode,
        configJson,
        metadata: {
          description: metadata.description,
          author: metadata.author,
          tags: metadata.tags,
        },
      };

      return githubApi.createPullRequest(request);
    },
  });

  return {
    createPR: mutation.mutate,
    isCreating: mutation.isPending,
    error: mutation.error,
    prResult: mutation.data,
    reset: mutation.reset,
  };
}
```

### GitHub Login Button Component

```tsx
// src/components/common/GitHubLoginButton/GitHubLoginButton.tsx
import { Github } from 'lucide-react';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';

export function GitHubLoginButton() {
  const { isAuthenticated, user, login, logout } = useGitHubAuth();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full border border-[var(--color-border-light)]"
        />
        <span className="text-sm text-[var(--color-text-secondary)]">
          {user.login}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1.5 text-sm rounded-[var(--radius-sm)]
            text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
            hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]
        bg-[#24292f] text-white font-medium transition-all hover:bg-[#32383f]"
    >
      <Github className="w-5 h-5" />
      Sign in with GitHub
    </button>
  );
}
```

### Create PR Modal Component

```tsx
// src/components/common/CreatePRModal/CreatePRModal.tsx
import { useState } from 'react';
import { X, GitPullRequest, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { useCreatePR } from '@/hooks/useCreatePR';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { usePolicyStore } from '@/store/policyStore';
import { GitHubLoginButton } from '../GitHubLoginButton/GitHubLoginButton';

interface CreatePRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreatePRModal({ isOpen, onClose }: CreatePRModalProps) {
  const { isAuthenticated } = useGitHubAuth();
  const { metadata } = usePolicyStore();
  const { createPR, isCreating, error, prResult, reset } = useCreatePR();

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 rounded-[var(--radius-xl)]
        bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
              <GitPullRequest className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Create Pull Request
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-secondary)]
              transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success State */}
          {prResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)]
                bg-[var(--color-success-bg)]">
                <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                <span className="text-sm font-medium text-[var(--color-success)]">
                  Pull Request created successfully!
                </span>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  PR #{prResult.prNumber}
                </p>
                <a
                  href={prResult.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[var(--color-info)] hover:underline"
                >
                  View Pull Request
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)]
                  bg-[var(--color-info)] text-white font-medium
                  transition-all hover:opacity-90"
              >
                Done
              </button>
            </div>
          )}

          {/* Error State */}
          {error && !prResult && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-[var(--radius-md)]
              bg-[var(--color-error-bg)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
              <span className="text-sm text-[var(--color-error)]">
                {error.message}
              </span>
            </div>
          )}

          {/* Auth Required */}
          {!isAuthenticated && !prResult && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Sign in with GitHub to create a pull request for this policy.
              </p>
              <GitHubLoginButton />
            </div>
          )}

          {/* Ready to Create */}
          {isAuthenticated && !prResult && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Policy Name</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {metadata.name || 'Unnamed Policy'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Files to Create</span>
                  <span className="font-mono text-xs text-[var(--color-text-primary)]">
                    2 files
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]
                font-mono text-xs text-[var(--color-text-secondary)]">
                <div>policies/{metadata.name?.toLowerCase().replace(/\s+/g, '-') || 'policy'}.rego</div>
                <div>configuration/{metadata.name?.toLowerCase().replace(/\s+/g, '-') || 'policy'}.json</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)]
                    bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]
                    font-medium transition-all hover:bg-[var(--color-border-light)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createPR()}
                  disabled={isCreating || !metadata.name}
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)]
                    bg-[var(--color-info)] text-white font-medium
                    transition-all hover:opacity-90
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create PR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Backend OAuth Endpoint (Express Example)

The frontend cannot safely exchange the OAuth code for a token because the client secret must remain secret. Here's an example backend endpoint:

```typescript
// backend/routes/auth.ts (Express.js example)
import { Router } from 'express';

const router = Router();

router.post('/auth/github/callback', async (req, res) => {
  const { code } = req.body;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    // Fetch user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    const user = await userResponse.json();

    // In production, consider:
    // 1. Setting token in httpOnly cookie
    // 2. Creating a session
    // 3. Encrypting sensitive data
    res.json({
      token: tokenData.access_token,
      user: {
        id: user.id,
        login: user.login,
        avatar_url: user.avatar_url,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
```

### OAuth Callback Route

```tsx
// src/app/routes.tsx
import { Routes, Route } from 'react-router-dom';
import { App } from './App';
import { GitHubCallback } from '@/components/auth/GitHubCallback';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/auth/github/callback" element={<GitHubCallback />} />
    </Routes>
  );
}
```

```tsx
// src/components/auth/GitHubCallback.tsx
import { useEffect } from 'react';
import { useGitHubCallback } from '@/hooks/useGitHubAuth';
import { Loader2 } from 'lucide-react';

export function GitHubCallback() {
  useGitHubCallback();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-info)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Completing GitHub authentication...
        </p>
      </div>
    </div>
  );
}
```

### Updated Project Structure

```
src/
├── components/
│   ├── auth/                     # Auth components
│   │   └── GitHubCallback.tsx    # OAuth callback handler
│   │
│   ├── common/
│   │   ├── GitHubLoginButton/    # GitHub sign-in button
│   │   └── CreatePRModal/        # PR creation modal
│   │
│   └── ... (existing components)
│
├── hooks/
│   ├── useGitHubAuth.ts          # GitHub authentication
│   ├── useCreatePR.ts            # PR creation mutation
│   └── ... (existing hooks)
│
├── services/api/
│   ├── githubApi.ts              # GitHub API integration
│   └── ... (existing services)
│
├── store/
│   ├── authStore.ts              # GitHub auth state
│   └── ... (existing stores)
│
└── ... (rest of structure)
```

### Installation for GitHub Integration

```bash
# Add GitHub API client
npm install octokit

# Add routing if not already installed
npm install react-router-dom
```

### Security Considerations

1. **Never expose `GITHUB_CLIENT_SECRET`** in frontend code
2. **Use httpOnly cookies** for token storage in production
3. **Validate OAuth state** to prevent CSRF attacks
4. **Limit token scope** to minimum required permissions (`repo`)
5. **Consider token expiration** and refresh mechanisms
6. **Audit logging** for PR creation activities
