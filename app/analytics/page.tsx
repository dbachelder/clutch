"use client";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

const chartConfig = {
  input: { 
    label: "Input", 
    color: "hsl(var(--chart-1))" 
  },
  output: { 
    label: "Output", 
    color: "hsl(var(--chart-2))" 
  },
};

// TODO: Replace with real RPC call to gateway
const data = [
  { model: "sonnet", input: 50000, output: 12000 },
  { model: "opus", input: 20000, output: 8000 },
  { model: "haiku", input: 150000, output: 25000 },
  { model: "kimi", input: 80000, output: 18000 },
];

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      
      <div className="grid gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Token Usage by Model</h2>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <BarChart data={data}>
              <XAxis dataKey="model" />
              <YAxis />
              <ChartTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--card-foreground))",
                }}
              />
              <Bar 
                dataKey="input" 
                stackId="a" 
                fill="var(--color-input)" 
                radius={[0, 0, 4, 4]}
              />
              <Bar 
                dataKey="output" 
                stackId="a" 
                fill="var(--color-output)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Input Tokens</p>
            <p className="text-2xl font-bold">
              {data.reduce((acc, d) => acc + d.input, 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Output Tokens</p>
            <p className="text-2xl font-bold">
              {data.reduce((acc, d) => acc + d.output, 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Models</p>
            <p className="text-2xl font-bold">{data.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}