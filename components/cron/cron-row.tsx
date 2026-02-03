import { CronJob, formatRelativeTime, formatAbsoluteTime } from "@/lib/cron-utils"
import ScheduleBadge from "./schedule-badge"

interface CronRowProps {
  job: CronJob
  onClick: (jobId: string) => void
}

export default function CronRow({ job, onClick }: CronRowProps) {
  const handleClick = () => {
    onClick(job.jobId)
  }

  const getStatusBadge = (enabled: boolean) => {
    if (enabled) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
          Enabled
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></div>
          Paused
        </span>
      )
    }
  }

  return (
    <tr
      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
        !job.enabled ? "opacity-60" : ""
      }`}
      onClick={handleClick}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {job.name || job.jobId}
            </div>
            {job.name && (
              <div className="text-sm text-gray-500 font-mono">
                {job.jobId}
              </div>
            )}
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <ScheduleBadge schedule={job.schedule} />
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(job.enabled)}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {job.lastRunMs ? (
          <div>
            <div>{formatRelativeTime(job.lastRunMs)}</div>
            <div className="text-xs text-gray-400">
              {formatAbsoluteTime(job.lastRunMs)}
            </div>
          </div>
        ) : (
          <span className="text-gray-400">Never</span>
        )}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {job.nextRunMs ? (
          <div>
            <div>{formatRelativeTime(job.nextRunMs)}</div>
            <div className="text-xs text-gray-400">
              {formatAbsoluteTime(job.nextRunMs)}
            </div>
          </div>
        ) : (
          <span className="text-gray-400">N/A</span>
        )}
      </td>
    </tr>
  )
}