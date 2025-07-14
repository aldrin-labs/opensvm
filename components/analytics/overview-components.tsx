'use client';

import React from 'react';

interface MetricCardProps {
  title: string;
  description: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, description, metrics }) => {
  return (
    <div className="bg-background border p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      <div className="space-y-2">
        {metrics.map((metric, index) => (
          <div key={index} className="flex justify-between">
            <span>{metric.label}:</span>
            <span className="font-medium">{metric.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ActionCardProps {
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'muted';
}

export const ActionCard: React.FC<ActionCardProps> = ({ 
  title, 
  description, 
  onClick, 
  variant = 'primary' 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary/10 hover:bg-primary/20 text-primary';
      case 'secondary':
        return 'bg-secondary/50 hover:bg-secondary/70 text-secondary-foreground';
      case 'accent':
        return 'bg-accent/20 hover:bg-accent/30 text-accent-foreground';
      case 'muted':
        return 'bg-muted hover:bg-muted/80 text-foreground';
      default:
        return 'bg-primary/10 hover:bg-primary/20 text-primary';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 text-left rounded-lg transition-colors ${getVariantClasses()}`}
    >
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
};

interface OverviewMetricsProps {
  networkMetrics: Array<{ label: string; value: string }>;
  defiMetrics: Array<{ label: string; value: string }>;
  crossChainMetrics: Array<{ label: string; value: string }>;
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({
  networkMetrics,
  defiMetrics,
  crossChainMetrics
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        title="Network Performance"
        description="Real-time Solana network metrics"
        metrics={networkMetrics}
      />
      
      <MetricCard
        title="DeFi Ecosystem"
        description="Total Value Locked across protocols"
        metrics={defiMetrics}
      />
      
      <MetricCard
        title="Cross-Chain Activity"
        description="Bridge flows and asset migrations"
        metrics={crossChainMetrics}
      />
    </div>
  );
};

interface QuickActionsProps {
  onNavigate: (tab: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const actions = [
    {
      id: 'dex',
      title: 'Explore DEX Analytics',
      description: 'View live DEX data and arbitrage opportunities',
      variant: 'primary' as const
    },
    {
      id: 'cross-chain',
      title: 'Cross-Chain Flows',
      description: 'Monitor bridge activity and migrations',
      variant: 'secondary' as const
    },
    {
      id: 'defi-health',
      title: 'DeFi Health Monitor',
      description: 'Track protocol health and risks',
      variant: 'accent' as const
    },
    {
      id: 'validators',
      title: 'Validator Analytics',
      description: 'Analyze validator performance and stake',
      variant: 'muted' as const
    }
  ];

  return (
    <div className="bg-background border p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {actions.map((action) => (
          <ActionCard
            key={action.id}
            title={action.title}
            description={action.description}
            onClick={() => onNavigate(action.id)}
            variant={action.variant}
          />
        ))}
      </div>
    </div>
  );
};