/**
 * Client-side Convex client
 * 
 * This module provides a Convex React client for use in browser components.
 * It uses React context and MUST NOT be imported in server-side code.
 * 
 * IMPORTANT: Only use this in client-side React components.
 * For server-side API routes, use lib/convex/server.ts instead.
 */

import { ConvexReactClient } from "convex/react"

// Self-hosted Convex — use the server's LAN IP so browsers on other machines can connect.
// Turbopack doesn't inline NEXT_PUBLIC_ env vars reliably, so we derive the URL at runtime
// from the current page origin (same host, port 3210).
function getConvexUrl(): string {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    return process.env.NEXT_PUBLIC_CONVEX_URL
  }
  // In the browser, use the same hostname the page was loaded from
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3210`
  }
  // Server-side fallback
  return "http://127.0.0.1:3210"
}

const CONVEX_URL = getConvexUrl()

if (typeof window !== "undefined" && !CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL environment variable is required for client-side Convex")
}

/**
 * Convex React client for browser use.
 * 
 * This client is lazy-initialized to avoid errors during SSR.
 * The provider component in provider.tsx handles the actual initialization.
 */
export function createConvexClient(): ConvexReactClient | null {
  if (!CONVEX_URL) {
    return null
  }
  return new ConvexReactClient(CONVEX_URL)
}

export { ConvexReactClient }
export type { ConvexReactClient as ConvexClientType }
