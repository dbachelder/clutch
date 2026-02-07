"use client"

import dynamic from "next/dynamic"

const AgentsContent = dynamic(() => import("./agents-content"), { ssr: false })

export default function AgentsPage() {
  return <AgentsContent />
}
