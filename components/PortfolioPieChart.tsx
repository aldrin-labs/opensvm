'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface TokenBalance {
  mint: string;
  balance: number;
}

interface Props {
  solBalance: number;
  tokenBalances: TokenBalance[];
}

export default function PortfolioPieChart({ solBalance, tokenBalances }: Props) {
  const data: { name: string; value: number }[] = [];

  if (solBalance > 0) {
    data.push({ name: 'SOL', value: solBalance });
  }

  tokenBalances.forEach(token => {
    if (token.balance > 0) {
      const name = token.mint.slice(0, 4) + '...';
      data.push({ name, value: token.balance });
    }
  });

  if (data.length === 0) return null;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={60}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: any) => val.toLocaleString()} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
