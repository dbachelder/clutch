import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="px-4 sm:px-0">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to The Trap
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          OpenClaw Dashboard and Control Center
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/sessions"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            View Sessions
          </Link>
        </div>
      </div>
    </div>
  )
}