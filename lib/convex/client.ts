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

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL

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
