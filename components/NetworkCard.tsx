'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface NetworkCardProps {
  name: string;
  status: "Active" | "Development";
  stats: {
    blocksProcessed: number | "N/A";
    activeValidators: number | "N/A";
    tps: number | "N/A";
  };
  epoch: {
    current: number | "N/A";
    progress: number;
  };
  tpsHistory: Array<{
    timestamp: number;
    value: number;
  }>;
}

function StatusBadge({ status }: { status: "Active" | "Development" }) {
  const bgColor = status === "Active" ? "bg-primary/10" : "bg-warning/10";
  const textColor = status === "Active" ? "text-primary" : "text-warning";
  const borderColor = status === "Active" ? "border-primary/30" : "border-warning/30";
  
  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium border ${bgColor} ${textColor} ${borderColor}`}>
      {status}
    </span>
  );
}

function formatNumber(value: number | "N/A"): string {
  if (value === "N/A") return "N/A";
  return value.toLocaleString();
}

export function NetworkCard({
  name,
  status,
  stats,
  epoch,
  tpsHistory
}: NetworkCardProps) {
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!chartRef.current || !tpsHistory.length) return;

    const svg = d3.select(chartRef.current);
    const width = chartRef.current.clientWidth;
    const height = chartRef.current.clientHeight;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // Clear previous content
    svg.selectAll("*").remove();

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(tpsHistory, d => new Date(d.timestamp)) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(tpsHistory, d => d.value) as number])
      .range([height - margin.bottom, margin.top]);

    // Create line generator
    const line = d3.line<{ timestamp: number; value: number }>()
      .x(d => xScale(new Date(d.timestamp)))
      .y(d => yScale(d.value))
      .curve(d3.curveBasis);

    // Add path
    // Create gradient
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "line-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0)
      .attr("y1", height - margin.bottom)
      .attr("x2", 0)
      .attr("y2", margin.top);

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "hsl(var(--primary))")
      .attr("stop-opacity", 0.2);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "hsl(var(--primary))")
      .attr("stop-opacity", 1);

    // Add area
    const area = d3.area<{ timestamp: number; value: number }>()
      .x(d => xScale(new Date(d.timestamp)))
      .y0(height - margin.bottom)
      .y1(d => yScale(d.value))
      .curve(d3.curveBasis);

    svg.append("path")
      .datum(tpsHistory)
      .attr("fill", "url(#line-gradient)")
      .attr("d", area);

    // Add line
    svg.append("path")
      .datum(tpsHistory)
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--primary))")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  }, [tpsHistory]);

  return (
    <div className="bg-background border border-border p-6">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-medium text-foreground">{name}</h3>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-3 gap-8 mb-8">
        <div>
          <div className="text-sm text-muted-foreground mb-2">Blocks Processed</div>
          <div className="text-2xl font-medium text-foreground">{formatNumber(stats.blocksProcessed)}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">Active Validators</div>
          <div className="text-2xl font-medium text-foreground">{formatNumber(stats.activeValidators)}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">TPS</div>
          <div className="text-2xl font-medium text-foreground">{formatNumber(stats.tps)}</div>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm text-muted-foreground mb-2">Current Epoch</div>
        <div className="text-2xl font-medium text-foreground mb-3">{formatNumber(epoch.current)}</div>
        <div className="w-full bg-muted h-1 overflow-hidden">
          <div
            className="bg-primary h-1 transition-all duration-300 ease-in-out"
            style={{ width: `${epoch.progress}%` }}
          />
        </div>
        <div className="text-sm text-muted-foreground mt-2">Progress: {epoch.progress.toFixed(2)}%</div>
      </div>

      <div>
        <div className="text-sm text-muted-foreground mb-3">TPS History</div>
        <div className="h-24">
          <svg ref={chartRef} width="100%" height="100%" className="text-primary" />
        </div>
      </div>
    </div>
  );
}