import { Badge } from "@/components/ui/badge";
import { CronStatus } from "@/lib/types";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

interface RunStatusBadgeProps {
  status: CronStatus;
  errorMessage?: string;
}

export function RunStatusBadge({ status, errorMessage }: RunStatusBadgeProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'error':
        return <XCircle className="w-3 h-3 mr-1" />;
      case 'running':
        return <Clock className="w-3 h-3 mr-1 animate-spin" />;
      case 'pending':
        return <AlertCircle className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'destructive';
      case 'running':
        return 'info';
      case 'pending':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'running':
        return 'Running';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center">
      <Badge 
        variant={getStatusVariant() as any}
        className="flex items-center"
        title={errorMessage || getStatusText()}
      >
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      {status === 'error' && errorMessage && (
        <div className="ml-2 text-xs text-muted-foreground truncate max-w-xs" title={errorMessage}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}