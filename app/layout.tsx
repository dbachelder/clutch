import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Trap - OpenClaw Dashboard',
  description: 'A custom dashboard and control center for OpenClaw',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">
                    🦞 The Trap
                  </h1>
                </div>
                <nav className="flex items-center space-x-4">
                  <a href="/sessions" className="text-gray-700 hover:text-gray-900">
                    Sessions
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}