import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prediction Markets Aggregator | OpenSVM',
  description: 'Real-time metrics and charts from Kalshi, Polymarket, Manifold, and Drift prediction markets. Track volume, arbitrage opportunities, and trending topics.',
  keywords: ['prediction markets', 'kalshi', 'polymarket', 'manifold', 'drift', 'arbitrage', 'trading'],
  openGraph: {
    title: 'Prediction Markets Aggregator | OpenSVM',
    description: 'Real-time metrics from all major prediction market platforms',
    type: 'website',
  },
};

export default function PredictionMarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
