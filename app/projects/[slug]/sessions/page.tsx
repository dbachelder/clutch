"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { SessionsList } from "@/components/sessions/sessions-list"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default function ProjectSessionsPage({ params }: PageProps) {
  const { slug } = use(params)
  const router = useRouter()

  const handleSessionClick = (sessionId: string) => {
    const encodedSessionId = encodeURIComponent(sessionId)
    router.push(`/projects/${slug}/sessions/${encodedSessionId}`)
  }

  return (
    <div className="space-y-6">
      <SessionsList 
        projectSlug={slug}
        onSessionClick={handleSessionClick}
        showStats={false}
        title="OpenClaw Sessions"
        description={`Sessions related to ${slug} project`}
      />
    </div>
  )
}
