"use client";

import { decodeInstruction } from '@/lib/solana/bpf';

interface DisassemblyViewProps {
  data: number[];
  address: string;
}

const toHex = (num: number, width: number = 2): string => {
  const hex = num >>> 0; // Convert to unsigned 32-bit integer
  return hex.toString(16).padStart(width, '0').toLowerCase();
};

const DisassemblyView: React.FC<DisassemblyViewProps> = ({ data }) => {
  return (
    <div className="font-mono text-sm">
      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-center space-x-4 text-xs text-gray-500 border-b border-white/5 pb-2 mb-4">
          <div className="w-24 shrink-0">Offset</div>
          <div className="w-48 shrink-0">Bytes</div>
          <div className="w-48 shrink-0">Components</div>
          <div className="flex-1">Instruction</div>
          <div className="w-96 shrink-0 text-right">Description</div>
        </div>

        {/* Instructions */}
        {Array.from({ length: Math.min(data.length, 1024) }, (_, i) => {
          if (i % 8 !== 0) return null;
          const bytes = data.slice(i, i + 8);
          if (bytes.length < 8) return null;
          
          // Parse BPF instruction components (little-endian)
          const opcode = bytes[0] || 0;
          const dst_reg = bytes[1] ? bytes[1] & 0xf : 0;
          const src_reg = bytes[1] ? (bytes[1] >> 4) & 0xf : 0;
          
          // Create typed arrays for offset and imm
          const offsetBuffer = new Uint8Array([bytes[2] || 0, bytes[3] || 0]).buffer;
          const immBuffer = new Uint8Array([bytes[4] || 0, bytes[5] || 0, bytes[6] || 0, bytes[7] || 0]).buffer;
          
          const offset = new Int16Array(offsetBuffer)[0] || 0;
          const imm = new Int32Array(immBuffer)[0] || 0;

          // Create BPF instruction object with explicit types
          const instruction = {
            opcode: opcode as number,
            dst_reg: dst_reg as number,
            src_reg: src_reg as number,
            offset: offset as number,
            imm: imm as number
          };

          // Get decoded instruction with register info
          const decoded = decodeInstruction(instruction);
          
          return (
            <div key={i} className="flex items-center space-x-4 py-1 hover:bg-white/[0.02] group">
              {/* Offset */}
              <div className="w-24 shrink-0">
                <span className="text-blue-400/60">{toHex(i, 8)}</span>
              </div>

              {/* Bytes */}
              <div className="w-48 shrink-0 text-gray-400 font-light tracking-wider">
                {bytes.map((b, idx) => (
                  <span key={idx} className={idx === 0 ? 'text-yellow-400/80' : ''}>
                    {toHex(b || 0)}{idx < 7 ? ' ' : ''}
                  </span>
                ))}
              </div>

              {/* Components */}
              <div className="w-48 shrink-0 text-gray-400/80 font-light">
                <span className="text-yellow-400/80">op:{toHex(opcode, 2)}</span>
                <span className="text-blue-400/80"> r{dst_reg}</span>
                <span className="text-gray-500">,</span>
                <span className="text-blue-400/80">r{src_reg}</span>
                {offset !== 0 && <span className="text-purple-400/80"> +{offset}</span>}
                {imm !== 0 && <span className="text-green-400/80"> #{imm}</span>}
              </div>

              {/* Decoded Instruction */}
              <div className="flex-1 text-white group-hover:text-white/90 transition-colors">
                <span className="text-yellow-400/80">{decoded.mnemonic}</span>
                <span className="text-gray-300"> {decoded.operands.join(', ')}</span>
              </div>

              {/* Description */}
              <div className="w-96 shrink-0 text-right">
                {/* C-like syntax */}
                <span className="text-gray-500 text-sm">{decoded.comment}</span>
                {/* Register descriptions */}
                {decoded.regInfo && decoded.regInfo.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">
                    {decoded.regInfo.map((info, idx) => (
                      <div key={idx}>{info}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
};

export default DisassemblyView;
