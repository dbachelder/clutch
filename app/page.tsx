export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">🦞 The Trap</h1>
        <p className="text-xl text-gray-600 mb-8">OpenClaw Dashboard & Control Center</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Sessions</h2>
            <p className="text-gray-600">View and manage active sessions</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Cron Jobs</h2>
            <p className="text-gray-600">Monitor and control scheduled tasks</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Analytics</h2>
            <p className="text-gray-600">Token usage and cost tracking</p>
          </div>
        </div>
      </div>
    </main>
  )
}