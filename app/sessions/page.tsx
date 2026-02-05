'use client';

/**
 * Sessions List Page
 * Real-time session monitoring with WebSocket updates
 */

import { SessionsList } from '@/components/sessions/sessions-list';

export default function SessionsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <SessionsList 
        showStats={true}
        title="Sessions"
        description="Monitor and manage OpenClaw sessions in real-time"
      />
    </div>
  );
}
