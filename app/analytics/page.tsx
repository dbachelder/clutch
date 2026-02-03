import { CostTrendChart } from "@/components/analytics/cost-trend-chart"

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">
          Monitor token usage, costs, and performance across all OpenClaw sessions
        </p>
      </div>
      
      <div className="grid gap-6">
        <CostTrendChart />
        
        {/* Placeholder for future analytics components */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Token usage by model */}
          {/* Session activity */}
          {/* Cost breakdown */}
        </div>
      </div>
    </div>
  )
}