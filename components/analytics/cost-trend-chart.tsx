"use client"

import { useState } from "react"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendBadge } from "./trend-badge"

// Mock data - replace with real data source
const mockData = {
  daily: [
    { date: "2026-01-28", "claude-sonnet-4": 12.50, "claude-opus-4": 3.20, total: 15.70 },
    { date: "2026-01-29", "claude-sonnet-4": 8.30, "claude-opus-4": 5.40, total: 13.70 },
    { date: "2026-01-30", "claude-sonnet-4": 15.20, "claude-opus-4": 2.10, total: 17.30 },
    { date: "2026-01-31", "claude-sonnet-4": 9.80, "claude-opus-4": 4.60, total: 14.40 },
    { date: "2026-02-01", "claude-sonnet-4": 11.40, "claude-opus-4": 6.20, total: 17.60 },
    { date: "2026-02-02", "claude-sonnet-4": 14.70, "claude-opus-4": 3.80, total: 18.50 },
    { date: "2026-02-03", "claude-sonnet-4": 7.90, "claude-opus-4": 2.30, total: 10.20 },
  ],
  weekly: [
    { date: "Week of Jan 20", "claude-sonnet-4": 85.30, "claude-opus-4": 32.40, total: 117.70 },
    { date: "Week of Jan 27", "claude-sonnet-4": 78.20, "claude-opus-4": 28.10, total: 106.30 },
    { date: "Week of Feb 03", "claude-sonnet-4": 92.50, "claude-opus-4": 45.20, total: 137.70 },
  ],
  monthly: [
    { date: "December 2025", "claude-sonnet-4": 285.40, "claude-opus-4": 142.30, total: 427.70 },
    { date: "January 2026", "claude-sonnet-4": 312.20, "claude-opus-4": 138.50, total: 450.70 },
  ]
}

const chartConfig = {
  "claude-sonnet-4": { 
    label: "Claude Sonnet 4", 
    color: "hsl(var(--chart-1))" 
  },
  "claude-opus-4": { 
    label: "Claude Opus 4", 
    color: "hsl(var(--chart-2))" 
  },
}

interface DailyCost {
  date: string
  "claude-sonnet-4": number
  "claude-opus-4": number
  total: number
}

type Granularity = "daily" | "weekly" | "monthly"

const formatCurrency = (value: number) => `$${value.toFixed(2)}`

const formatDate = (dateString: string, granularity: Granularity) => {
  if (granularity === "weekly" || granularity === "monthly") {
    return dateString
  }
  
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CostTrendChart() {
  const [granularity, setGranularity] = useState<Granularity>("daily")
  
  const data = mockData[granularity]
  const currentPeriodTotal = data[data.length - 1]?.total || 0
  const previousPeriodTotal = data[data.length - 2]?.total || 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{formatDate(label, granularity)}</p>
          {payload.reverse().map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
          <p className="font-medium border-t pt-1 mt-1">
            Total: {formatCurrency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cost Trends</CardTitle>
            <CardDescription>
              Token costs over time by model
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <TrendBadge 
              current={currentPeriodTotal} 
              previous={previousPeriodTotal}
            />
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setGranularity(period)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors capitalize ${
                    granularity === period
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: "300px" }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSonnet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="colorOpus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => formatDate(value, granularity)}
              />
              <YAxis 
                tickFormatter={formatCurrency}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="claude-sonnet-4"
                stackId="1"
                stroke="hsl(var(--chart-1))"
                fill="url(#colorSonnet)"
              />
              <Area
                type="monotone"
                dataKey="claude-opus-4"
                stackId="1"
                stroke="hsl(var(--chart-2))"
                fill="url(#colorOpus)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-gray-600">{config.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}