import { CronJob, CronRun, OpenClawRPCRequest, OpenClawRPCResponse } from './types';

export class OpenClawAPI {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private listeners = new Set<(event: any) => void>();

  constructor(private url: string = 'ws://localhost:18789') {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('Connected to OpenClaw gateway');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        reject(new Error('Failed to connect to OpenClaw gateway'));
      };

      this.ws.onmessage = (event) => {
        try {
          const response: OpenClawRPCResponse = JSON.parse(event.data);
          this.handleMessage(response);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from OpenClaw gateway');
        this.ws = null;
        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Connection closed'));
        });
        this.pendingRequests.clear();
      };
    });
  }

  private handleMessage(response: OpenClawRPCResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    } else {
      // This might be an event/notification
      this.listeners.forEach(listener => listener(response));
    }
  }

  private async rpcCall(method: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = `req_${++this.requestId}`;
    const request: OpenClawRPCRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));

      // Set a timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC call timeout: ${method}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  // Cron API methods
  async getCronJobs(): Promise<CronJob[]> {
    const result = await this.rpcCall('cron.list');
    return result?.jobs || [];
  }

  async getCronJob(jobId: string): Promise<CronJob | null> {
    try {
      const jobs = await this.getCronJobs();
      return jobs.find(job => job.id === jobId || job.jobId === jobId) || null;
    } catch (error) {
      console.error('Failed to get cron job:', error);
      return null;
    }
  }

  async getCronRuns(jobId: string): Promise<CronRun[]> {
    try {
      const result = await this.rpcCall('cron.runs', { jobId });
      return result?.runs || [];
    } catch (error) {
      console.error('Failed to get cron runs:', error);
      return [];
    }
  }

  async runCronJob(jobId: string): Promise<void> {
    await this.rpcCall('cron.run', { jobId });
  }

  async enableCronJob(jobId: string): Promise<void> {
    await this.rpcCall('cron.update', { jobId, patch: { enabled: true } });
  }

  async disableCronJob(jobId: string): Promise<void> {
    await this.rpcCall('cron.update', { jobId, patch: { enabled: false } });
  }

  // Event listeners
  onEvent(listener: (event: any) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const openclawAPI = new OpenClawAPI();