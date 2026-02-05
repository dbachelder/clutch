'use client';

/**
 * Providers index - centralizes all context providers
 */

import React from 'react';
import { WebSocketProvider } from './websocket-provider';
import { OpenClawWSProvider } from '@/lib/providers/openclaw-ws-provider';
import { ConvexProviderWrapper } from '@/lib/convex/provider';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexProviderWrapper>
      <WebSocketProvider>
        <OpenClawWSProvider>
          {children}
        </OpenClawWSProvider>
      </WebSocketProvider>
    </ConvexProviderWrapper>
  );
}

// Re-export individual providers for specific use cases
export { WebSocketProvider } from './websocket-provider';
export { OpenClawWSProvider, useOpenClawWS } from '@/lib/providers/openclaw-ws-provider';