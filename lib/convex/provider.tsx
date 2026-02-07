'use client'

import React from "react"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { createConvexClient } from "./client"

interface ConvexProviderWrapperProps {
  children: React.ReactNode
}

export function ConvexProviderWrapper({ children }: ConvexProviderWrapperProps) {
  // Create client synchronously on the first render.
  // This avoids a useEffect race where dynamic(ssr:false) components can mount
  // and call useQuery before the provider is ready.
  const client = React.useMemo(
    () => (typeof window !== "undefined" ? createConvexClient() : null),
    [],
  )

  if (!client) {
    return <>{children}</>
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}

export { ConvexProvider } from "convex/react"
export { useConvex, useQuery, useMutation } from "convex/react"
export type { ConvexReactClient }
