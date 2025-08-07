'use client';

import React, { useEffect, useRef, useState } from 'react';
import { decodeInstruction, type DecodedInstruction } from '@/lib/bpf';

interface ProgramVisualizerProps {
  data: number[];
  onInstructionSelect?: (offset: number | null) => void;
}

// Updated color scheme with better contrast and consistency
const InstructionColors = {
  ALU: '#60a5fa',     // Bright blue for arithmetic
  ALU64: '#3b82f6',   // Darker blue for 64-bit arithmetic
  JMP: '#f472b6',     // Pink for jumps
  JMP32: '#ec4899',   // Darker pink for 32-bit jumps
  LD: '#4ade80',      // Green for loads
  LDX: '#22c55e',     // Darker green for load from register
  ST: '#facc15',      // Yellow for stores
  STX: '#eab308',     // Darker yellow for store to register
  UNKNOWN: '#ef4444'  // Red for unknown instructions
} as const;

const ProgramVisualizer: React.FC<ProgramVisualizerProps> = ({
  data,
  onInstructionSelect
}) => {
  const [decodedInstructions, setDecodedInstructions] = useState<DecodedInstruction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Decode instructions on data change
  useEffect(() => {
    const instructions: DecodedInstruction[] = [];
    for (let i = 0; i < data.length; i += 8) {
      const bytes = data.slice(i, i + 8);
      if (bytes.length === 8) {
        const instruction = bytes.reduce((acc, byte, idx) => {
          return acc + (BigInt(byte) << BigInt(idx * 8));
        }, BigInt(0));
        instructions.push(decodeInstruction(instruction));
      }
    }
    setDecodedInstructions(instructions);
  }, [data]);

  const getInstructionColor = (instruction: DecodedInstruction): string => {
    const mnemonic = instruction.mnemonic.toLowerCase();
    if (mnemonic.includes('add') || mnemonic.includes('sub') || 
        mnemonic.includes('mul') || mnemonic.includes('div') ||
        mnemonic.includes('mod') || mnemonic.includes('neg')) {
      return instruction.mnemonic.includes('32') ? InstructionColors.ALU : InstructionColors.ALU64;
    }
    if (mnemonic.includes('j') || mnemonic === 'call' || mnemonic === 'exit') {
      return instruction.mnemonic.includes('32') ? InstructionColors.JMP32 : InstructionColors.JMP;
    }
    if (mnemonic.startsWith('ld')) return mnemonic.includes('x') ? InstructionColors.LDX : InstructionColors.LD;
    if (mnemonic.startsWith('st')) return mnemonic.includes('x') ? InstructionColors.STX : InstructionColors.ST;
    if (mnemonic === 'unknown') return InstructionColors.UNKNOWN;
    return InstructionColors.ALU64;
  };

  const handleInstructionClick = (index: number) => {
    setSelectedIndex(index);
    onInstructionSelect?.(index);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden bg-gray-900">
      <div className="flex-none px-4 py-3 border-b border-gray-800 bg-gray-900/90 backdrop-blur supports-[backdrop-filter]:bg-gray-900/80">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-100">eBPF Program Instructions</h2>
          <div className="text-sm text-gray-400">
            {decodedInstructions.length} instructions
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-3 space-y-1.5">
          {decodedInstructions.map((instruction, index) => (
            <div
              key={index}
              className={`group relative rounded-md transition-all duration-150 ${
                selectedIndex === index 
                  ? 'bg-gray-800/80 ring-1 ring-gray-700' 
                  : 'hover:bg-gray-800/50'
              }`}
              onClick={() => handleInstructionClick(index)}
            >
              <div className="px-3 py-2">
                <div className="flex items-start gap-3">
                  <div className="flex-none pt-1.5">
                    <div 
                      className="w-2 h-2 rounded-full ring-1 ring-white/10"
                      style={{ backgroundColor: getInstructionColor(instruction) }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="flex-none text-gray-500 text-sm font-mono">
                        {index.toString().padStart(4, '0')}
                      </span>
                      <div className="flex-1 flex items-baseline gap-2 min-w-0">
                        <span className="text-gray-100 font-mono font-medium">
                          {instruction.mnemonic}
                        </span>
                        <span className="text-gray-400 font-mono truncate">
                          {instruction.operands.join(', ')}
                        </span>
                      </div>
                    </div>
                    {instruction.comment && (
                      <div className="mt-1 text-gray-500 text-sm">
                        {instruction.comment}
                      </div>
                    )}
                    {instruction.regInfo && instruction.regInfo.length > 0 && (
                      <div className="mt-1 text-gray-600 text-xs">
                        {instruction.regInfo.join(' | ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-none border-t border-gray-800 bg-gray-900/90 backdrop-blur supports-[backdrop-filter]:bg-gray-900/80">
        <div className="px-3 py-2 overflow-x-auto">
          <div className="flex flex-wrap gap-2">
            {Object.entries(InstructionColors).map(([type, color]) => (
              <div 
                key={type} 
                className="flex items-center gap-2 px-2 py-1 rounded bg-gray-800/50"
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full ring-1 ring-white/10"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-400 text-xs font-medium">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramVisualizer;
