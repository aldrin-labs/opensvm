import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_PROMPT = `You are a Solana transaction analyzer. Your task is to:
1. Analyze the transaction data and explain what happened in simple terms
2. Identify the likely goal of the user who made this transaction
3. Point out any notable patterns or implications

Focus on:
- Program interactions and their purpose
- Token transfers and their significance
- Any interesting patterns in the transaction flow
- Potential user intentions based on the transaction type

Keep your analysis clear and concise, avoiding technical jargon when possible.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // Use deepseek r1 reasoner to analyze the transaction
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-coder:6.7b',
        prompt: `${DEEPSEEK_PROMPT}\n\n${prompt}`,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze transaction');
    }

    const result = await response.json();
    const analysis = result.response.trim();

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    return NextResponse.json(
      { error: 'Failed to analyze transaction' },
      { status: 500 }
    );
  }
}
