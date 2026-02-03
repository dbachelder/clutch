import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, BarChart3, MessageSquare, Zap } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            The Trap Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring and control for your OpenClaw instance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cron Jobs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">—</div>
              <p className="text-xs text-muted-foreground mb-3">
                Automated task scheduling and execution history
              </p>
              <Link href="/cron">
                <Button variant="outline" size="sm" className="w-full">
                  View Cron Jobs
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">—</div>
              <p className="text-xs text-muted-foreground mb-3">
                Real-time session monitoring and management
              </p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                View Sessions <span className="text-xs ml-1">(Coming Soon)</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">—</div>
              <p className="text-xs text-muted-foreground mb-3">
                Token consumption and cost analytics
              </p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                View Analytics <span className="text-xs ml-1">(Coming Soon)</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Quick Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  System Status
                </CardTitle>
                <CardDescription>
                  Check OpenClaw gateway connection and system health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  Check Status <span className="text-xs ml-1">(Coming Soon)</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Start Chat
                </CardTitle>
                <CardDescription>
                  Begin a new conversation with your AI assistant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" disabled>
                  New Chat <span className="text-xs ml-1">(Coming Soon)</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}