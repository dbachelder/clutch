import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TrendBadgeProps {
  current: number
  previous: number
  formatValue?: (value: number) => string
}

export function TrendBadge({ current, previous, formatValue = (v) => v.toString() }: TrendBadgeProps) {
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0
  const isIncrease = percentChange > 0
  const isFlat = Math.abs(percentChange) < 0.01

  if (isFlat) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Minus className="h-3 w-3" />
        No change
      </Badge>
    )
  }

  return (
    <Badge 
      variant={isIncrease ? "destructive" : "success"} 
      className="gap-1"
    >
      {isIncrease ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isIncrease ? "+" : ""}{percentChange.toFixed(1)}%
    </Badge>
  )
}