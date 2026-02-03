import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">🦞 The Trap</h1>
        <p className="text-xl text-gray-600">
          OpenClaw Dashboard and Control Center
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link 
          href="/analytics"
          className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Analytics</h3>
          <p className="text-gray-600">
            Token usage, costs, and performance metrics
          </p>
        </Link>

        <div className="p-6 bg-gray-50 rounded-lg border border-dashed">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">🎛️ Sessions</h3>
          <p className="text-gray-400">
            Coming soon - Session management and control
          </p>
        </div>

        <div className="p-6 bg-gray-50 rounded-lg border border-dashed">
          <h3 className="text-lg font-semibold text-gray-500 mb-2">📋 Tasks</h3>
          <p className="text-gray-400">
            Coming soon - Task management
          </p>
        </div>
      </div>
    </div>
  )
}