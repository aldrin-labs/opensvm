import { decodeInstruction } from './bpf';

describe('eBPF Instruction Decoder', () => {
  test('decodes ALU64 add instruction', () => {
    // BPF_ALU64 | BPF_ADD | BPF_K (opcode: 0x07)
    // dst_reg = 1, src_reg = 0, offset = 0, imm = 123
    const instruction = {
      opcode: 0x07,  // ALU64 | ADD | IMM
      dst_reg: 1,
      src_reg: 0,
      offset: 0,
      imm: 123
    };
    
    const decoded = decodeInstruction(instruction);
    expect(decoded).toEqual({
      mnemonic: 'add',
      operands: ['r1', '123'],
      comment: 'r1 = r1 + 123',
      regInfo: ['r1: First argument / Scratch register']
    });
  });

  test('decodes jump instruction', () => {
    // BPF_JMP | BPF_JEQ | BPF_K (opcode: 0x15)
    // dst_reg = 1, src_reg = 0, offset = 5, imm = 0
    const instruction = {
      opcode: 0x15,  // JMP | JEQ | IMM
      dst_reg: 1,
      src_reg: 0,
      offset: 5,
      imm: 0
    };
    
    const decoded = decodeInstruction(instruction);
    expect(decoded).toEqual({
      mnemonic: 'jeq',
      operands: ['r1', '0', '+5'],
      comment: 'if r1 == 0 goto +5',
      regInfo: ['r1: First argument / Scratch register']
    });
  });

  test('decodes load instruction', () => {
    // BPF_LDX | BPF_MEM | BPF_W (opcode: 0x61)
    // dst_reg = 2, src_reg = 1, offset = 4, imm = 0
    const instruction = {
      opcode: 0x61,  // LDX | MEM | W
      dst_reg: 2,
      src_reg: 1,
      offset: 4,
      imm: 0
    };
    
    const decoded = decodeInstruction(instruction);
    expect(decoded).toEqual({
      mnemonic: 'ldw',
      operands: ['r2', '[r1 + 4]'],
      comment: 'r2 = *(w*)(r1 + 4)',
      regInfo: [
        'r2: Second argument / Scratch register',
        'r1: First argument / Scratch register'
      ]
    });
  });

  test('decodes store instruction', () => {
    // BPF_STX | BPF_MEM | BPF_W (opcode: 0x63)
    // dst_reg = 1, src_reg = 2, offset = 8, imm = 0
    const instruction = {
      opcode: 0x63,  // STX | MEM | W
      dst_reg: 1,
      src_reg: 2,
      offset: 8,
      imm: 0
    };
    
    const decoded = decodeInstruction(instruction);
    expect(decoded).toEqual({
      mnemonic: 'stw',
      operands: ['[r1 + 8]', 'r2'],
      comment: '*(w*)(r1 + 8) = r2',
      regInfo: [
        'r1: First argument / Scratch register',
        'r2: Second argument / Scratch register'
      ]
    });
  });
}); 