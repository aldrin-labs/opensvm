export function calculateSVMAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Basic pricing model - adjust as needed
  const modelRates = {
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-sonnet-20240229': { input: 3, output: 15 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-2.1': { input: 8, output: 24 },
    'claude-2.0': { input: 8, output: 24 },
    'claude-instant-1.2': { input: 0.8, output: 2.4 }
  };

  const rates = modelRates[model as keyof typeof modelRates] || modelRates['claude-3-haiku-20240307'];
  
  // Calculate cost per 1K tokens, convert to SVMAI
  const inputCost = (inputTokens / 1000) * rates.input;
  const outputCost = (outputTokens / 1000) * rates.output;
  
  return inputCost + outputCost;
}

export function calculateUSDCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // USD pricing per 1K tokens
  const modelRates = {
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-2.1': { input: 0.008, output: 0.024 },
    'claude-2.0': { input: 0.008, output: 0.024 },
    'claude-instant-1.2': { input: 0.0008, output: 0.0024 }
  };

  const rates = modelRates[model as keyof typeof modelRates] || modelRates['claude-3-haiku-20240307'];
  
  const inputCost = (inputTokens / 1000) * rates.input;
  const outputCost = (outputTokens / 1000) * rates.output;
  
  return inputCost + outputCost;
}

export function getSVMAIExchangeRate(): number {
  // Mock exchange rate - 1 USD = 1000 SVMAI
  return 1000;
}

export function convertUSDToSVMAI(usdAmount: number): number {
  return usdAmount * getSVMAIExchangeRate();
}

export function convertSVMAIToUSD(svmaiAmount: number): number {
  return svmaiAmount / getSVMAIExchangeRate();
}

export function getModelInfo(model: string): {
  name: string;
  inputRate: number;
  outputRate: number;
  description: string;
} {
  const modelInfo = {
    'claude-3-opus-20240229': {
      name: 'Claude 3 Opus',
      inputRate: 15,
      outputRate: 75,
      description: 'Most powerful model for complex tasks'
    },
    'claude-3-sonnet-20240229': {
      name: 'Claude 3 Sonnet',
      inputRate: 3,
      outputRate: 15,
      description: 'Balanced performance and cost'
    },
    'claude-3-haiku-20240307': {
      name: 'Claude 3 Haiku',
      inputRate: 0.25,
      outputRate: 1.25,
      description: 'Fast and cost-effective'
    }
  };

  return modelInfo[model as keyof typeof modelInfo] || modelInfo['claude-3-haiku-20240307'];
}