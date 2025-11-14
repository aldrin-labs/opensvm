import { AIServiceHealthDashboard } from '@/components/ai/AIServiceHealthDashboard';

export default function AIHealthPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Service Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time health status and performance metrics for the AI service
        </p>
      </div>
      <AIServiceHealthDashboard />
    </div>
  );
}
