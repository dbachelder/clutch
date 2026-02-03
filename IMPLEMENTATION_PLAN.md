# Implementation Plan - Issue #12: Cron Execution History View

## Overview
Create a cron job detail page that displays execution history, job metadata, and provides job controls.

## Prerequisites 
Since the Next.js app structure doesn't exist yet, I need to:
1. Initialize basic Next.js 15 app with App Router
2. Set up TypeScript, Tailwind, shadcn/ui
3. Create basic cron infrastructure

## Implementation Steps

### 1. Bootstrap Next.js Application
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

### 2. Install Dependencies
```bash
# Core UI components
npx shadcn@latest init
npx shadcn@latest add button badge card table separator

# State management and utilities  
npm install zustand date-fns
```

### 3. Create Core Files

#### App Structure
```
app/
├── layout.tsx          # Root layout
├── page.tsx           # Dashboard home  
├── cron/
│   ├── page.tsx       # Cron list (stub for dependency)
│   └── [id]/
│       └── page.tsx   # Cron detail page (main deliverable)
├── components/
│   ├── ui/            # shadcn components
│   └── cron/
│       ├── run-history.tsx      # Execution history table
│       ├── run-status-badge.tsx # Status indicators
│       ├── job-metadata.tsx     # Job info display
│       └── job-controls.tsx     # Run Now, Enable/Disable
└── lib/
    ├── utils.ts       # Utility functions
    ├── openclaw-api.ts # API client
    └── types.ts       # TypeScript types
```

### 4. OpenClaw API Integration

#### Types
```typescript
// lib/types.ts
export interface CronJob {
  id: string;
  name: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    expr?: string;
    everyMs?: number;
    atMs?: number;
  };
  enabled: boolean;
  createdAt: string;
  description?: string;
}

export interface CronRun {
  id: string;
  jobId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
  sessionId?: string;
}
```

#### API Client
```typescript
// lib/openclaw-api.ts
export class OpenClawAPI {
  private ws: WebSocket | null = null;

  async connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:18789');
    // Setup RPC handling
  }

  async getCronRuns(jobId: string): Promise<CronRun[]> {
    return this.rpcCall('cron.runs', { jobId });
  }

  async getCronJob(jobId: string): Promise<CronJob> {
    return this.rpcCall('cron.get', { jobId });
  }

  async runCronJob(jobId: string): Promise<void> {
    return this.rpcCall('cron.run', { jobId });
  }
}
```

### 5. Component Implementation

#### Cron Detail Page
```typescript
// app/cron/[id]/page.tsx
export default async function CronDetailPage({ params }: { params: { id: string } }) {
  // Fetch job data and execution history
  // Render metadata + history components
}
```

#### Execution History Table
```typescript
// components/cron/run-history.tsx
interface RunHistoryProps {
  runs: CronRun[];
  jobId: string;
}

export function RunHistory({ runs, jobId }: RunHistoryProps) {
  // Table with columns: start time, duration, status, error message, session link
  // Most recent runs at top
  // Expandable error messages
  // Pagination for long history
}
```

#### Status Badge Component
```typescript
// components/cron/run-status-badge.tsx
interface RunStatusBadgeProps {
  status: CronRun['status'];
  errorMessage?: string;
}

export function RunStatusBadge({ status, errorMessage }: RunStatusBadgeProps) {
  // Green badge for success
  // Red badge for error with tooltip showing message
  // Yellow/blue badge for running
}
```

## Technical Decisions

1. **Next.js 15 App Router** - Modern routing with server components
2. **shadcn/ui + Tailwind** - Consistent component system 
3. **WebSocket API integration** - Real-time connection to OpenClaw
4. **Zustand for state** - Simple state management for real-time updates
5. **Server Components where possible** - Better performance for static data

## Testing Strategy

1. **Component tests** with Vitest + React Testing Library
2. **API integration tests** for OpenClaw communication  
3. **E2E tests** with Playwright for full user flows

## Acceptance Criteria Checklist

- [ ] History loads on page mount ✓
- [ ] Most recent runs at top ✓  
- [ ] Failed runs clearly marked with red indicator ✓
- [ ] Error messages expandable for details ✓
- [ ] Pagination for long history ✓
- [ ] Job metadata display ✓
- [ ] Quick actions: Run Now, Enable/Disable ✓
- [ ] Links to sessions ✓

## Files to Create

1. `package.json` - Dependencies and scripts
2. `next.config.js` - Next.js configuration  
3. `tailwind.config.js` - Tailwind setup
4. `components.json` - shadcn configuration
5. `app/layout.tsx` - Root layout
6. `app/cron/[id]/page.tsx` - Main cron detail page
7. `components/cron/run-history.tsx` - History table component
8. `components/cron/run-status-badge.tsx` - Status badge component
9. `components/cron/job-metadata.tsx` - Job information display
10. `components/cron/job-controls.tsx` - Action buttons
11. `lib/openclaw-api.ts` - API integration
12. `lib/types.ts` - TypeScript definitions
13. `lib/utils.ts` - Utility functions

This plan addresses the missing foundation while delivering the specific feature requirements for issue #12.