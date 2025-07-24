"use client";

import { useEffect, useState, useRef } from 'react';
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface MemecoinInfo {
    id: string;
    name: string;
    symbol: string;
    launchpad: string;
    priceUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    ageMinutes: number;
}

export default function ScanPage() {
    const [data, setData] = useState<MemecoinInfo[]>([]);
    const wsRef = useRef<WebSocket | null>(null);

    // Establish WebSocket connection
    useEffect(() => {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = typeof window !== 'undefined' ? window.location.host : '';
        const ws = new WebSocket(`${protocol}://${host}/api/scan`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'snapshot') {
                setData(msg.data);
            } else if (msg.type === 'update') {
                setData((prev) => {
                    const exists = prev.some((x) => x.id === msg.data.id);
                    if (exists) return prev.map((x) => (x.id === msg.data.id ? msg.data : x));
                    return [msg.data, ...prev].slice(0, 200); // keep last 200
                });
            }
        };

        return () => {
            ws.close();
        };
    }, []);

    const columns: ColumnDef<MemecoinInfo>[] = [
        {
            header: 'Name',
            accessorKey: 'name',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium">{row.original.name}</span>
                    <Badge variant="secondary" className="text-xs">{row.original.symbol}</Badge>
                </div>
            ),
        },
        {
            header: 'Launchpad',
            accessorKey: 'launchpad',
        },
        {
            header: 'Price (USD)',
            accessorKey: 'priceUsd',
            cell: ({ getValue }) => `$${Number(getValue<number>()).toFixed(6)}`,
        },
        {
            header: 'MCap',
            accessorKey: 'marketCapUsd',
            cell: ({ getValue }) => `$${Number(getValue<number>()).toLocaleString()}`,
        },
        {
            header: 'Liquidity',
            accessorKey: 'liquidityUsd',
            cell: ({ getValue }) => `$${Number(getValue<number>()).toLocaleString()}`,
        },
        {
            header: 'Volume 24h',
            accessorKey: 'volume24hUsd',
            cell: ({ getValue }) => `$${Number(getValue<number>()).toLocaleString()}`,
        },
        {
            header: 'Age (min)',
            accessorKey: 'ageMinutes',
        },
    ];

    return (
        <div className="container mx-auto py-6">
            <Card>
                <CardHeader>
                    <CardTitle>Real-time Memecoin Scan</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.length === 0 ? (
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <Skeleton key={i} className="h-6 w-full" />
                            ))}
                        </div>
                    ) : (
                        <DataTable columns={columns} data={data} pageSize={25} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 