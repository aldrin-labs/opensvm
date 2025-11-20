// RISC-V instruction decoder
const OPCODE_MASK = 0x7f;
const RD_MASK = 0xf80;
const FUNCT3_MASK = 0x7000;
const RS1_MASK = 0xf8000;
const RS2_MASK = 0x1f00000;
const FUNCT7_MASK = 0xfe000000;

// RISC-V opcodes
const OPCODES = {
  LUI: 0x37,     // Load Upper Immediate
  AUIPC: 0x17,   // Add Upper Immediate to PC
  JAL: 0x6f,     // Jump and Link
  JALR: 0x67,    // Jump and Link Register
  BRANCH: 0x63,  // Branch
  LOAD: 0x03,    // Load
  STORE: 0x23,   // Store
  OP_IMM: 0x13,  // Integer Register-Immediate
  OP: 0x33,      // Integer Register-Register
  SYSTEM: 0x73,  // System
};

// RISC-V register names
const REGISTERS = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

// RISC-V branch conditions
const BRANCH_CONDITIONS = {
  0x0: 'beq',  // Branch if Equal
  0x1: 'bne',  // Branch if Not Equal
  0x4: 'blt',  // Branch if Less Than
  0x5: 'bge',  // Branch if Greater Than or Equal
  0x6: 'bltu', // Branch if Less Than Unsigned
  0x7: 'bgeu'  // Branch if Greater Than or Equal Unsigned
};

// RISC-V arithmetic operations
const ARITHMETIC_OPS = {
  0x0: { 0x00: 'add', 0x20: 'sub' },
  0x1: { 0x00: 'sll' },
  0x2: { 0x00: 'slt' },
  0x3: { 0x00: 'sltu' },
  0x4: { 0x00: 'xor' },
  0x5: { 0x00: 'srl', 0x20: 'sra' },
  0x6: { 0x00: 'or' },
  0x7: { 0x00: 'and' }
};

// RISC-V immediate arithmetic operations
const IMM_ARITHMETIC_OPS = {
  0x0: 'addi',
  0x1: 'slli',
  0x2: 'slti',
  0x3: 'sltiu',
  0x4: 'xori',
  0x5: { 0x00: 'srli', 0x20: 'srai' },
  0x6: 'ori',
  0x7: 'andi'
};

export function decodeInstruction(instruction: number): string {
  const opcode = instruction & OPCODE_MASK;
  const rd = (instruction & RD_MASK) >> 7;
  const funct3 = (instruction & FUNCT3_MASK) >> 12;
  const rs1 = (instruction & RS1_MASK) >> 15;
  const rs2 = (instruction & RS2_MASK) >> 20;
  const funct7 = (instruction & FUNCT7_MASK) >> 25;

  switch (opcode) {
    case OPCODES.LUI:
      return `lui ${REGISTERS[rd]}, ${(instruction >>> 12).toString(16)}`;

    case OPCODES.AUIPC:
      return `auipc ${REGISTERS[rd]}, ${(instruction >>> 12).toString(16)}`;

    case OPCODES.JAL: {
      const imm = ((instruction & 0x80000000) >> 11) |
        ((instruction & 0x7fe00000) >> 20) |
        ((instruction & 0x00100000) >> 9) |
        (instruction & 0x000ff000);
      return `jal ${REGISTERS[rd]}, ${imm.toString(16)}`;
    }

    case OPCODES.JALR:
      return `jalr ${REGISTERS[rd]}, ${REGISTERS[rs1]}, ${((instruction >> 20) & 0xfff).toString(16)}`;

    case OPCODES.BRANCH:
      if ((BRANCH_CONDITIONS as any)[funct3]) {
        const imm = ((instruction & 0x80000000) >> 19) |
          ((instruction & 0x7e000000) >> 20) |
          ((instruction & 0x00000f00) >> 7) |
          ((instruction & 0x00000080) << 4);
        return `${(BRANCH_CONDITIONS as any)[funct3]} ${REGISTERS[rs1]}, ${REGISTERS[rs2]}, ${imm.toString(16)}`;
      }
      break;

    case OPCODES.LOAD: {
      const imm = (instruction >> 20) & 0xfff;
      const loadTypes = ['lb', 'lh', 'lw', 'ld', 'lbu', 'lhu', 'lwu'];
      if (loadTypes[funct3]) {
        return `${loadTypes[funct3]} ${REGISTERS[rd]}, ${imm}(${REGISTERS[rs1]})`;
      }
      break;
    }

    case OPCODES.STORE: {
      const imm = ((instruction >> 20) & 0xfe0) | ((instruction >> 7) & 0x1f);
      const storeTypes = ['sb', 'sh', 'sw', 'sd'];
      if (storeTypes[funct3]) {
        return `${storeTypes[funct3]} ${REGISTERS[rs2]}, ${imm}(${REGISTERS[rs1]})`;
      }
      break;
    }

    case OPCODES.OP_IMM: {
      const imm = (instruction >> 20) & 0xfff;
      const immOp = (IMM_ARITHMETIC_OPS as any)[funct3];
      if (immOp) {
        if (typeof immOp === 'string') {
          return `${immOp} ${REGISTERS[rd]}, ${REGISTERS[rs1]}, ${imm}`;
        } else if (immOp[funct7 & 0x20]) {
          return `${immOp[funct7 & 0x20]} ${REGISTERS[rd]}, ${REGISTERS[rs1]}, ${imm & 0x1f}`;
        }
      }
      break;
    }

    case OPCODES.OP: {
      const arithOp = (ARITHMETIC_OPS as any)[funct3];
      if (arithOp && arithOp[funct7 & 0x20]) {
        return `${arithOp[funct7 & 0x20]} ${REGISTERS[rd]}, ${REGISTERS[rs1]}, ${REGISTERS[rs2]}`;
      }
      break;
    }

    case OPCODES.SYSTEM:
      if (funct3 === 0 && instruction === 0x00000073) {
        return 'ecall';
      } else if (funct3 === 0 && instruction === 0x00100073) {
        return 'ebreak';
      }
      break;
  }

  return `unknown (${instruction.toString(16)})`;
}
