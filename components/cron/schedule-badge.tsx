import { CronSchedule, formatSchedule } from "@/lib/cron-utils"

interface ScheduleBadgeProps {
  schedule: CronSchedule
  className?: string
}

export default function ScheduleBadge({ schedule, className = "" }: ScheduleBadgeProps) {
  const getScheduleColor = (kind: string) => {
    switch (kind) {
      case "cron":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "every":
        return "bg-green-100 text-green-800 border-green-200"
      case "at":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getScheduleColor(
        schedule.kind
      )} ${className}`}
    >
      <span className="mr-1.5 text-xs opacity-75 uppercase">
        {schedule.kind}
      </span>
      {formatSchedule(schedule)}
    </span>
  )
}