"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import CronTable from "@/components/cron/cron-table"
import { CronJob } from "@/lib/cron-utils"

// Mock data for development - will be replaced with actual OpenClaw API calls
const mockJobs: CronJob[] = [
  {
    jobId: "axiom-trader-loop",
    name: "Axiom Trader Loop",
    schedule: {
      kind: "every",
      everyMs: 120000 // Every 2 minutes
    },
    enabled: true,
    sessionTarget: "isolated",
    payload: { kind: "script", command: "bash ~/bin/axiom-gate.sh" },
    lastRunMs: Date.now() - 180000, // 3 minutes ago
    nextRunMs: Date.now() + 60000, // 1 minute from now
  },
  {
    jobId: "daily-reports",
    name: "Daily Analytics Report",
    schedule: {
      kind: "cron",
      expr: "0 8 * * *", // Every day at 8 AM
      tz: "America/Los_Angeles"
    },
    enabled: true,
    sessionTarget: "main",
    payload: { kind: "systemEvent", text: "Generate daily analytics report" },
    lastRunMs: Date.now() - 43200000, // 12 hours ago  
    nextRunMs: Date.now() + 57600000, // 16 hours from now
  },
  {
    jobId: "weekly-cleanup",
    name: "Weekly Cleanup",
    schedule: {
      kind: "cron",
      expr: "0 3 * * 0", // Every Sunday at 3 AM
    },
    enabled: false,
    sessionTarget: "isolated",
    payload: { kind: "script", command: "bash ~/bin/cleanup-logs.sh" },
    lastRunMs: Date.now() - 604800000, // 1 week ago
    nextRunMs: undefined,
  },
  {
    jobId: "one-time-task",
    name: "One-time Migration",
    schedule: {
      kind: "at",
      atMs: Date.now() + 3600000 // 1 hour from now
    },
    enabled: true,
    sessionTarget: "isolated",
    payload: { kind: "agentTurn", message: "Run database migration" },
    lastRunMs: undefined,
    nextRunMs: Date.now() + 3600000,
  }
]

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const loadCronJobs = async () => {
      try {
        setLoading(true)
        
        // TODO: Replace with actual OpenClaw API call
        // const response = await fetch('/api/cron/list')
        // const data = await response.json()
        // setJobs(data.jobs || [])
        
        // For now, simulate API delay and use mock data
        await new Promise(resolve => setTimeout(resolve, 500))
        setJobs(mockJobs)
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cron jobs')
      } finally {
        setLoading(false)
      }
    }

    loadCronJobs()

    // TODO: Set up real-time updates via WebSocket or polling
    // const interval = setInterval(loadCronJobs, 10000) // Refresh every 10 seconds
    // return () => clearInterval(interval)
    
  }, [])

  const handleJobClick = (jobId: string) => {
    router.push(`/cron/${jobId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cron Jobs</h1>
              <p className="mt-1 text-sm text-gray-600">
                Monitor and manage scheduled tasks
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  className="h-4 w-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading cron jobs
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <CronTable 
          jobs={jobs}
          onJobClick={handleJobClick}
          loading={loading}
        />
        
        {/* Stats Footer */}
        {!loading && jobs.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Jobs
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {jobs.filter(job => job.enabled).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Paused Jobs
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {jobs.filter(job => !job.enabled).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Next Run
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {(() => {
                          const nextJob = jobs
                            .filter(job => job.enabled && job.nextRunMs)
                            .sort((a, b) => (a.nextRunMs! - b.nextRunMs!))[0]
                          return nextJob ? 
                            new Date(nextJob.nextRunMs!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                            'N/A'
                        })()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}