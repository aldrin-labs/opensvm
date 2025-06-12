import { LiveEventMonitor } from '@/components/LiveEventMonitor';

export default function MonitoringPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Real-Time Blockchain Monitoring
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor live Solana blockchain events and AI-driven anomaly detection alerts in real-time.
        </p>
      </div>
      
      <LiveEventMonitor />
    </div>
  );
}