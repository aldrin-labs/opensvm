import { Connection } from '@solana/web3.js';

export class BaseCapability {
  constructor(connection) {
    this.connection = connection;
  }

  extractFromContent(content, pattern) {
    const match = content.match(pattern);
    return match ? match[0] : null;
  }

  async executeWithConnection(operation) {
    try {
      return await operation(this.connection);
    } catch (error) {
      console.error(`Error executing operation:`, error);
      throw error;
    }
  }

  createToolExecutor(name, description, executor) {
    return {
      name,
      description,
      execute: executor
    };
  }
}