// OpenRouter API integration for AI-powered search responses
import axios from 'axios';

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-or-v1-free-tier-demo-key';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Available models with their capabilities
const AVAILABLE_MODELS = {
  'anthropic/claude-3-opus:beta': {
    description: 'Claude 3 Opus - Most powerful model for detailed blockchain analysis',
    contextWindow: 200000,
    bestFor: ['detailed analysis', 'technical explanations', 'complex blockchain data']
  },
  'anthropic/claude-3-sonnet:beta': {
    description: 'Claude 3 Sonnet - Balanced model for most blockchain queries',
    contextWindow: 180000,
    bestFor: ['general blockchain queries', 'transaction explanations', 'token analysis']
  },
  'anthropic/claude-3-haiku:beta': {
    description: 'Claude 3 Haiku - Fast model for simple blockchain queries',
    contextWindow: 150000,
    bestFor: ['quick explanations', 'simple address lookups', 'token identification']
  },
  'openai/gpt-4-turbo': {
    description: 'GPT-4 Turbo - Excellent for general blockchain knowledge',
    contextWindow: 128000,
    bestFor: ['general blockchain knowledge', 'code explanation', 'protocol analysis']
  },
  'google/gemini-pro': {
    description: 'Gemini Pro - Good for technical blockchain explanations',
    contextWindow: 30000,
    bestFor: ['technical explanations', 'token analysis', 'general blockchain queries']
  }
};

// Default model to use
const DEFAULT_MODEL = 'anthropic/claude-3-opus:beta';

// Interface for OpenRouter request options
interface OpenRouterRequestOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

// Interface for OpenRouter response
interface OpenRouterResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Interface for streaming response
interface OpenRouterStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    delta: {
      content?: string;
    };
    index: number;
    finish_reason: string | null;
  }[];
}

// Interface for blockchain data types
interface BlockchainData {
  type: 'token' | 'nft' | 'account' | 'transaction' | 'unknown';
  query: string;
  network: string;
  timestamp: string;
  data: any;
}

/**
 * Generate AI response using OpenRouter API
 * @param prompt The prompt to send to the AI
 * @param options Configuration options for the request
 * @returns The AI-generated response
 */
export async function generateAIResponse(
  prompt: string,
  options: OpenRouterRequestOptions = {}
): Promise<string> {
  try {
    const response = await axios.post<OpenRouterResponse>(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: options.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000,
        top_p: options.top_p ?? 1,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://opensvm.com',
          'X-Title': 'OpenSVM Search',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw new Error('Failed to generate AI response');
  }
}

/**
 * Generate AI response with streaming using OpenRouter API
 * @param prompt The prompt to send to the AI
 * @param onChunk Callback function to handle each chunk of the response
 * @param onComplete Callback function to execute when streaming is complete
 * @param options Configuration options for the request
 */
export async function generateStreamingAIResponse(
  prompt: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  options: OpenRouterRequestOptions = {}
): Promise<void> {
  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: options.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000,
        top_p: options.top_p ?? 1,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://opensvm.com',
          'X-Title': 'OpenSVM Search',
        },
        responseType: 'stream',
      }
    );

    const stream = response.data;
    let buffer = '';

    stream.on('data', (chunk: Buffer) => {
      const lines = chunk
        .toString()
        .split('\n')
        .filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') continue;

          try {
            const parsed: OpenRouterStreamResponse = JSON.parse(data);
            const content = parsed.choices[0].delta.content;
            
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            console.error('Error parsing streaming response:', e);
          }
        }
      }
    });

    stream.on('end', () => {
      onComplete();
    });

    stream.on('error', (err: Error) => {
      console.error('Stream error:', err);
      onComplete();
    });
  } catch (error) {
    console.error('Error generating streaming AI response:', error);
    onComplete();
    throw new Error('Failed to generate streaming AI response');
  }
}

/**
 * Create a prompt for blockchain data search with enhanced context
 * @param query User's search query
 * @param blockchainData Additional blockchain data to include in the prompt
 * @returns Formatted prompt for the AI
 */
export function createBlockchainSearchPrompt(query: string, blockchainData: BlockchainData | null = null): string {
  // Base system prompt with detailed instructions
  let prompt = `You are an expert blockchain analyst assistant for OpenSVM, a blockchain explorer for Solana. 
You provide detailed, accurate, and insightful analysis of blockchain data.

USER QUERY: "${query}"

Your task is to analyze this query and provide a detailed, informative response about it in the context of the Solana blockchain.`;

  // Add specific instructions based on data type
  if (blockchainData) {
    prompt += `\n\n## BLOCKCHAIN DATA\nI have retrieved the following blockchain data related to this query:\n\`\`\`json\n${JSON.stringify(blockchainData, null, 2)}\n\`\`\`\n`;
    
    // Add type-specific instructions
    if (blockchainData.type === 'token') {
      prompt += `\n## TOKEN ANALYSIS INSTRUCTIONS
This appears to be a Solana token. Please provide:
1. A detailed overview of this token, including its name, symbol, and purpose
2. Analysis of the token's metadata, supply, and distribution if available
3. Recent price action and trading volume if available
4. Notable holders or recent significant transactions if available
5. Any relevant context about the project behind this token
6. Potential risks or considerations for users interested in this token`;
    } 
    else if (blockchainData.type === 'nft') {
      prompt += `\n## NFT ANALYSIS INSTRUCTIONS
This appears to be a Solana NFT. Please provide:
1. A detailed description of this NFT, including its collection, attributes, and rarity if available
2. Information about the creator/artist and the project behind it
3. Analysis of recent sales or transfers if available
4. Context about the NFT's significance in the Solana ecosystem
5. Any notable features or utilities of this NFT`;
    }
    else if (blockchainData.type === 'account') {
      prompt += `\n## ACCOUNT ANALYSIS INSTRUCTIONS
This appears to be a Solana account/wallet. Please provide:
1. A detailed overview of this account, including its type and purpose if identifiable
2. Analysis of the account's portfolio, including SOL balance and token holdings
3. Recent transaction patterns and notable activities
4. Any identifiable connections to known projects, exchanges, or entities
5. Context about the account's significance in the Solana ecosystem if applicable`;
    }
    else if (blockchainData.type === 'transaction') {
      prompt += `\n## TRANSACTION ANALYSIS INSTRUCTIONS
This appears to be a Solana transaction. Please provide:
1. A detailed explanation of what this transaction does in plain language
2. Analysis of the transaction's inputs, outputs, and effects
3. Identification of the programs/contracts involved and their purpose
4. Context about the significance of this transaction
5. Any notable amounts, tokens, or accounts involved`;
    }
    else {
      prompt += `\n## GENERAL ANALYSIS INSTRUCTIONS
Please analyze the provided blockchain data and explain its significance in the context of Solana.
Identify any patterns, notable information, or insights that would be valuable to the user.`;
    }
  } else {
    // No blockchain data available
    prompt += `\n\nI could not retrieve specific blockchain data for this query. Please provide:
1. General information about what this query might refer to in the Solana ecosystem
2. Possible interpretations of this query (address, transaction, token, etc.)
3. Educational context about relevant Solana concepts
4. Suggestions for further exploration`;
  }

  // Add formatting instructions
  prompt += `\n\n## RESPONSE FORMAT INSTRUCTIONS
1. Structure your response in clear, well-organized paragraphs
2. Begin with a concise summary of what the query refers to
3. Provide detailed analysis in subsequent paragraphs
4. Use technical terms where appropriate, but explain them for users who may not be blockchain experts
5. If you identify any potential security concerns or risks, highlight them clearly
6. Cite specific data points from the provided blockchain data to support your analysis
7. Be specific and detailed, but avoid speculation beyond what the data supports
8. If certain information is not available or unclear, acknowledge these limitations
9. End with a brief conclusion summarizing the key insights

Your response should be comprehensive, accurate, and educational, helping the user understand the blockchain data in context.`;

  return prompt;
}

/**
 * Extract and format sources from blockchain data
 * @param blockchainData The blockchain data to extract sources from
 * @returns Array of sources with titles and URLs
 */
export function extractSourcesFromBlockchainData(blockchainData: BlockchainData | null): { title: string, url: string }[] {
  const sources: { title: string, url: string }[] = [
    { title: 'Solana Documentation', url: 'https://docs.solana.com' }
  ];
  
  if (!blockchainData) return sources;
  
  const query = blockchainData.query;
  
  // Add type-specific sources
  if (blockchainData.type === 'token') {
    const tokenName = blockchainData.data?.metadata?.name || 'Token';
    sources.push(
      { title: `${tokenName} on Solscan`, url: `https://solscan.io/token/${query}` },
      { title: `${tokenName} on Solana Explorer`, url: `https://explorer.solana.com/address/${query}` }
    );
    
    // Add Jupiter if price data is available
    if (blockchainData.data?.price) {
      sources.push({ title: `${tokenName} on Jupiter`, url: `https://jup.ag/swap/SOL-${query}` });
    }
  } 
  else if (blockchainData.type === 'nft') {
    const nftName = blockchainData.data?.metadata?.name || 'NFT';
    sources.push(
      { title: `${nftName} on Solscan`, url: `https://solscan.io/token/${query}` },
      { title: `${nftName} on Solana Explorer`, url: `https://explorer.solana.com/address/${query}` }
    );
    
    // Add Magic Eden if it's likely an NFT
    sources.push({ title: `${nftName} on Magic Eden`, url: `https://magiceden.io/item-details/${query}` });
  }
  else if (blockchainData.type === 'account') {
    sources.push(
      { title: 'Account on Solscan', url: `https://solscan.io/account/${query}` },
      { title: 'Account on Solana Explorer', url: `https://explorer.solana.com/address/${query}` }
    );
  }
  else if (blockchainData.type === 'transaction') {
    sources.push(
      { title: 'Transaction on Solscan', url: `https://solscan.io/tx/${query}` },
      { title: 'Transaction on Solana Explorer', url: `https://explorer.solana.com/tx/${query}` }
    );
  }
  
  return sources;
}

/**
 * Select the best AI model for a specific blockchain data type
 * @param blockchainData The blockchain data to analyze
 * @returns The recommended model ID
 */
export function selectBestModelForData(blockchainData: BlockchainData | null): string {
  if (!blockchainData) return DEFAULT_MODEL;
  
  // Select model based on data type and complexity
  switch (blockchainData.type) {
    case 'token':
      // For tokens with extensive data, use a more powerful model
      const hasExtensiveData = 
        (blockchainData.data?.price && blockchainData.data?.holders && blockchainData.data?.recentSwaps);
      return hasExtensiveData ? 'anthropic/claude-3-opus:beta' : 'anthropic/claude-3-sonnet:beta';
      
    case 'nft':
      // NFTs typically don't need the most powerful model
      return 'anthropic/claude-3-sonnet:beta';
      
    case 'account':
      // For accounts with many transactions or tokens, use a more powerful model
      const hasComplexPortfolio = 
        blockchainData.data?.portfolio?.tokens?.length > 10 || 
        blockchainData.data?.recentSwaps?.length > 10;
      return hasComplexPortfolio ? 'anthropic/claude-3-opus:beta' : 'anthropic/claude-3-sonnet:beta';
      
    case 'transaction':
      // Complex transactions need more powerful analysis
      return 'anthropic/claude-3-opus:beta';
      
    default:
      return DEFAULT_MODEL;
  }
}

export default {
  generateAIResponse,
  generateStreamingAIResponse,
  createBlockchainSearchPrompt,
  extractSourcesFromBlockchainData,
  selectBestModelForData,
  AVAILABLE_MODELS
};
