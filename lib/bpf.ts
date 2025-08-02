// eBPF instruction decoder based on https://github.com/riptl/binaryninja-ebpf

// Helper function to format hex values
function toHex(num: number, width: number = 2): string {
  return (num >>> 0).toString(16).padStart(width, '0').toLowerCase();
}

// BPF instruction classes
const BPF = {
  // Classes
  LD: 0x00, // Load
  LDX: 0x01, // Load from register
  ST: 0x02, // Store
  STX: 0x03, // Store to register
  ALU: 0x04, // Arithmetic operations
  JMP: 0x05, // Jump operations
  JMP32: 0x06, // Jump operations (32-bit)
  ALU64: 0x07, // 64-bit arithmetic operations

  // Sizes
  W: 0x00, // Word (32-bit)
  H: 0x08, // Half-word (16-bit)
  B: 0x10, // Byte (8-bit)
  DW: 0x18, // Double-word (64-bit)

  // Modes
  IMM: 0x00, // Immediate value
  ABS: 0x20, // Absolute
  IND: 0x40, // Indirect
  MEM: 0x60, // Memory
  XADD: 0xc0, // Atomic add

  // ALU operations
  ADD: 0x00, // Add
  SUB: 0x10, // Subtract
  MUL: 0x20, // Multiply
  DIV: 0x30, // Divide
  OR: 0x40, // Bitwise OR
  AND: 0x50, // Bitwise AND
  LSH: 0x60, // Left shift
  RSH: 0x70, // Right shift
  NEG: 0x80, // Negate
  MOD: 0x90, // Modulo
  XOR: 0xa0, // Bitwise XOR
  MOV: 0xb0, // Move
  ARSH: 0xc0, // Arithmetic right shift
  END: 0xd0, // Endianness conversion

  // Jump operations
  JA: 0x00, // Jump always
  JEQ: 0x10, // Jump if equal
  JGT: 0x20, // Jump if greater than
  JGE: 0x30, // Jump if greater or equal
  JSET: 0x40, // Jump if bits set
  JNE: 0x50, // Jump if not equal
  JSGT: 0x60, // Jump if greater than (signed)
  JSGE: 0x70, // Jump if greater or equal (signed)
  CALL: 0x80, // Function call
  EXIT: 0x90, // Return from program
  JLT: 0xa0, // Jump if less than
  JLE: 0xb0, // Jump if less or equal
  JSLT: 0xc0, // Jump if less than (signed)
  JSLE: 0xd0, // Jump if less or equal (signed)
};

// Register descriptions
const REG_DESC = {
  0: 'Return value',
  1: 'First argument / Scratch register',
  2: 'Second argument / Scratch register',
  3: 'Third argument / Scratch register',
  4: 'Fourth argument / Scratch register',
  5: 'Fifth argument / Scratch register',
  6: 'Callee saved register',
  7: 'Callee saved register',
  8: 'Callee saved register',
  9: 'Callee saved register',
  10: 'Frame pointer (read-only)',
};

// Helper functions
function getClass(opcode: number): number {
  return opcode & 0x07;
}

function getSize(opcode: number): number {
  return opcode & 0x18;
}

function getMode(opcode: number): number {
  return opcode & 0xe0;
}

function getOp(opcode: number): number {
  return opcode & 0xf0;
}

function getSource(opcode: number): number {
  return opcode & 0x08;
}

function getSizeStr(size: number): string {
  switch (size) {
    case BPF.W: return 'w';
    case BPF.H: return 'h';
    case BPF.B: return 'b';
    case BPF.DW: return 'dw';
    default: return '';
  }
}

function getRegName(reg: number): string {
  return `r${reg}`;
}

function getRegDesc(reg: number): string {
  return (REG_DESC as Record<number, string>)[reg] || 'Unknown register';
}

function formatImm(imm: number): string {
  if (imm === 0) return '0';
  return imm > 0 ? `+${imm}` : imm.toString();
}

function formatOffset(offset: number): string {
  return formatImm(offset);
}

export interface DecodedInstruction {
  mnemonic: string;     // The instruction mnemonic (e.g., "add", "mov", etc.)
  operands: string[];   // The instruction operands
  comment?: string;     // Optional comment explaining the instruction
  regInfo?: string[];  // Optional register descriptions
}

export function decodeInstruction(instruction: number | bigint | { opcode: number; dst_reg: number; src_reg: number; offset: number; imm: number }): DecodedInstruction {
  // Handle both raw number/bigint and instruction object formats
  let opcode: number, dst_reg: number, src_reg: number, offset: number, imm: number;

  if (typeof instruction === 'number' || typeof instruction === 'bigint') {
    // Convert to BigInt for proper 64-bit handling if not already
    const bigInstruction = BigInt(instruction);

    // Extract fields using BigInt operations
    opcode = Number(bigInstruction & 0xffn);
    dst_reg = Number((bigInstruction >> 8n) & 0xfn);
    src_reg = Number((bigInstruction >> 12n) & 0xfn);

    // Handle offset as signed 16-bit value using BigInt for sign extension
    const offsetBig = (bigInstruction >> 16n) & 0xffffn;
    offset = Number((offsetBig << 48n) >> 48n); // Sign extend using BigInt shifts

    // Handle immediate as signed 32-bit value using BigInt for sign extension
    const immBig = (bigInstruction >> 32n) & 0xffffffffn;
    imm = Number((immBig << 32n) >> 32n); // Sign extend using BigInt shifts
  } else {
    opcode = instruction.opcode;
    dst_reg = instruction.dst_reg;
    src_reg = instruction.src_reg;
    offset = instruction.offset;
    imm = instruction.imm;
  }

  const cls = getClass(opcode);
  const op = getOp(opcode);
  const src = getSource(opcode);
  const dst = getRegName(dst_reg);
  const src_reg_name = getRegName(src_reg);

  // Get register descriptions
  const regInfo = [
    `${dst}: ${getRegDesc(dst_reg)}`,
    src && src_reg !== dst_reg ? `${src_reg_name}: ${getRegDesc(src_reg)}` : null
  ].filter(Boolean) as string[];

  switch (cls) {
    case BPF.ALU:
    case BPF.ALU64: {
      const is64 = cls === BPF.ALU64;
      const suffix = is64 ? '' : '32';
      const src_val = src ? src_reg_name : imm.toString();

      switch (op) {
        case BPF.ADD: return {
          mnemonic: `add${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} + ${src_val}`,
          regInfo
        };
        case BPF.SUB: return {
          mnemonic: `sub${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} - ${src_val}`,
          regInfo
        };
        case BPF.MUL: return {
          mnemonic: `mul${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} * ${src_val}`,
          regInfo
        };
        case BPF.DIV: return {
          mnemonic: `div${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} / ${src_val}`,
          regInfo
        };
        case BPF.OR: return {
          mnemonic: `or${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} | ${src_val}`,
          regInfo
        };
        case BPF.AND: return {
          mnemonic: `and${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} & ${src_val}`,
          regInfo
        };
        case BPF.LSH: return {
          mnemonic: `lsh${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} << ${src_val}`,
          regInfo
        };
        case BPF.RSH: return {
          mnemonic: `rsh${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} >> ${src_val}`,
          regInfo
        };
        case BPF.NEG: return {
          mnemonic: `neg${suffix}`,
          operands: [dst],
          comment: `${dst} = -${dst}`,
          regInfo
        };
        case BPF.MOD: return {
          mnemonic: `mod${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} % ${src_val}`,
          regInfo
        };
        case BPF.XOR: return {
          mnemonic: `xor${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} ^ ${src_val}`,
          regInfo
        };
        case BPF.MOV: return {
          mnemonic: `mov${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${src_val}`,
          regInfo
        };
        case BPF.ARSH: return {
          mnemonic: `arsh${suffix}`,
          operands: [dst, src_val],
          comment: `${dst} = ${dst} >> ${src_val} (arithmetic)`,
          regInfo
        };
        case BPF.END: return {
          mnemonic: `end${suffix}`,
          operands: [dst, imm.toString()],
          comment: `Convert endianness of ${dst}`,
          regInfo
        };
      }
      break;
    }

    case BPF.JMP:
    case BPF.JMP32: {
      const is32 = cls === BPF.JMP32;
      const suffix = is32 ? '32' : '';
      const src_val = src ? src_reg_name : imm.toString();

      switch (op) {
        case BPF.JA: return {
          mnemonic: 'ja',
          operands: [formatOffset(offset)],
          comment: `Jump to ${formatOffset(offset)} (unconditional)`,
          regInfo
        };
        case BPF.JEQ: return {
          mnemonic: `jeq${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} == ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JGT: return {
          mnemonic: `jgt${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} > ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JGE: return {
          mnemonic: `jge${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} >= ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JSET: return {
          mnemonic: `jset${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} & ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JNE: return {
          mnemonic: `jne${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} != ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JSGT: return {
          mnemonic: `jsgt${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} > ${src_val} goto ${formatOffset(offset)} (signed)`,
          regInfo
        };
        case BPF.JSGE: return {
          mnemonic: `jsge${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} >= ${src_val} goto ${formatOffset(offset)} (signed)`,
          regInfo
        };
        case BPF.CALL: return {
          mnemonic: 'call',
          operands: [imm.toString()],
          comment: `Call helper function ${imm}`,
          regInfo
        };
        case BPF.EXIT: return {
          mnemonic: 'exit',
          operands: [],
          comment: 'Return from program',
          regInfo
        };
        case BPF.JLT: return {
          mnemonic: `jlt${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} < ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JLE: return {
          mnemonic: `jle${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} <= ${src_val} goto ${formatOffset(offset)}`,
          regInfo
        };
        case BPF.JSLT: return {
          mnemonic: `jslt${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} < ${src_val} goto ${formatOffset(offset)} (signed)`,
          regInfo
        };
        case BPF.JSLE: return {
          mnemonic: `jsle${suffix}`,
          operands: [dst, src_val, formatOffset(offset)],
          comment: `if ${dst} <= ${src_val} goto ${formatOffset(offset)} (signed)`,
          regInfo
        };
      }
      break;
    }

    case BPF.LD:
    case BPF.LDX: {
      const size = getSize(opcode);
      const mode = getMode(opcode);
      const sizeStr = getSizeStr(size);

      // For memory operations, always include both registers in regInfo
      const memRegInfo = [
        `${dst}: ${getRegDesc(dst_reg)}`,
        mode === BPF.MEM ? `${src_reg_name}: ${getRegDesc(src_reg)}` : null
      ].filter(Boolean) as string[];

      if (mode === BPF.IMM) {
        return {
          mnemonic: `ld${sizeStr}`,
          operands: [dst, imm.toString()],
          comment: `${dst} = ${imm}`,
          regInfo: memRegInfo
        };
      } else if (mode === BPF.MEM) {
        const addr = offset ? `${src_reg_name} + ${offset}` : src_reg_name;
        return {
          mnemonic: `ld${sizeStr}`,
          operands: [dst, `[${addr}]`],
          comment: `${dst} = *(${sizeStr}*)(${addr})`,
          regInfo: memRegInfo
        };
      } else if (mode === BPF.ABS) {
        return {
          mnemonic: `ld${sizeStr}`,
          operands: [dst, `[${imm}]`],
          comment: `${dst} = *(${sizeStr}*)(${imm})`,
          regInfo: memRegInfo
        };
      } else if (mode === BPF.IND) {
        return {
          mnemonic: `ld${sizeStr}`,
          operands: [dst, `[${src_reg_name} + ${imm}]`],
          comment: `${dst} = *(${sizeStr}*)(${src_reg_name} + ${imm})`,
          regInfo: memRegInfo
        };
      }
      break;
    }

    case BPF.ST:
    case BPF.STX: {
      const size = getSize(opcode);
      const mode = getMode(opcode);
      const sizeStr = getSizeStr(size);

      // For memory operations, always include both registers in regInfo
      const memRegInfo = [
        `${dst}: ${getRegDesc(dst_reg)}`,
        cls === BPF.STX ? `${src_reg_name}: ${getRegDesc(src_reg)}` : null
      ].filter(Boolean) as string[];

      if (mode === BPF.MEM) {
        const value = cls === BPF.ST ? imm.toString() : src_reg_name;
        const addr = offset ? `${dst} + ${offset}` : dst;
        return {
          mnemonic: `st${sizeStr}`,
          operands: [`[${addr}]`, value],
          comment: `*(${sizeStr}*)(${addr}) = ${value}`,
          regInfo: memRegInfo
        };
      } else if (mode === BPF.XADD) {
        const addr = offset ? `${dst} + ${offset}` : dst;
        return {
          mnemonic: `xadd${sizeStr}`,
          operands: [`[${addr}]`, src_reg_name],
          comment: `Atomic: *(${sizeStr}*)(${addr}) += ${src_reg_name}`,
          regInfo: memRegInfo
        };
      }
      break;
    }
  }

  return {
    mnemonic: 'unknown',
    operands: [
      `op:${toHex(opcode, 2)}`,
      `r:${dst_reg},${src_reg}`,
      `off:${offset}`,
      `imm:${imm}`
    ],
    comment: 'Unknown instruction',
    regInfo
  };
}
