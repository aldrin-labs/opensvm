'use client';

import { useEffect, useRef } from 'react';
import rough from 'roughjs';
import type { ParsedInstruction } from '@/lib/blockchain/transaction-parser';

interface TransactionVisualizerProps {
  instructions: ParsedInstruction[];
  width?: number;
  height?: number;
}

export function TransactionVisualizer({ 
  instructions,
  width = 800,
  height = 200
}: TransactionVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || instructions.length === 0) return;

    const rc = rough.canvas(canvasRef.current);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate positions
    const padding = 40;
    const nodeRadius = 20;
    const availableWidth = width - (padding * 2);
    const stepWidth = availableWidth / (instructions.length + 1);
    const centerY = height / 2;

    // Draw nodes and connections
    instructions.forEach((ix, index) => {
      const x = padding + (stepWidth * (index + 1));
      
      // Draw node
      rc.circle(x, centerY, nodeRadius * 2, {
        fill: 'white',
        fillStyle: 'solid',
        stroke: '#666',
        roughness: 1.5
      });

      // Draw program name
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.fillText(ix.name.slice(0, 10), x, centerY + nodeRadius + 20);

      // Draw connection line to next node
      if (index < instructions.length - 1) {
        rc.line(
          x + nodeRadius,
          centerY,
          x + stepWidth - nodeRadius,
          centerY,
          { roughness: 1.5, stroke: '#666' }
        );
      }
    });

  }, [instructions, width, height]);

  return (
    <div className="w-full overflow-x-auto">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full"
        style={{ maxWidth: width }}
      />
    </div>
  );
}

export function TransactionDescription({ instructions }: { instructions: ParsedInstruction[] }) {
  if (instructions.length === 0) return null;

  function generateDescription(instructions: ParsedInstruction[]): string {
    const steps = instructions.map((ix, index) => {
      const step = `${index + 1}. ${ix.name} instruction executed by ${ix.programName}`;
      if (ix.accounts.length > 0) {
        const signers = ix.accounts.filter(acc => acc.isSigner).map(acc => acc.name || acc.pubkey.toString());
        if (signers.length > 0) {
          return `${step} with ${signers.join(', ')} as signer${signers.length > 1 ? 's' : ''}`;
        }
      }
      return step;
    });

    return `This transaction consists of ${instructions.length} instruction${instructions.length > 1 ? 's' : ''}: ${steps.join('. ')}`;
  }

  return (
    <div className="bg-muted p-4 rounded-lg">
      <p className="text-sm text-muted-foreground">
        {generateDescription(instructions)}
      </p>
    </div>
  );
}
