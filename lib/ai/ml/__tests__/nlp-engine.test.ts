/**
 * Test suite for NLP Engine
 */

import { NLPEngine, ConversationRequest } from '../nlp-engine';

describe('NLPEngine', () => {
  let engine: NLPEngine;

  beforeEach(() => {
    engine = new NLPEngine();
  });

  describe('Blockchain Query Processing', () => {
    it('should process simple balance queries', async () => {
      const request: ConversationRequest = {
        user_input: "What's my SOL balance?",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response).toBeDefined();
      expect(response.response_text).toContain('SOL');
      expect(response.intent).toBe('balance_query');
      expect(response.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'token',
            value: 'SOL'
          })
        ])
      );
      expect(response.confidence).toBeGreaterThan(0.5);
    });

    it('should handle transaction history queries', async () => {
      const request: ConversationRequest = {
        user_input: "Show me my recent transactions on Jupiter",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('transaction_history');
      expect(response.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'protocol',
            value: 'Jupiter'
          })
        ])
      );
      expect(response.blockchain_actions).toHaveLength(0);
    });

    it('should process portfolio analysis requests', async () => {
      const request: ConversationRequest = {
        user_input: "Analyze my portfolio performance this month",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('portfolio_analysis');
      expect(response.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'timeframe',
            value: expect.stringMatching(/month|30.*day/i)
          })
        ])
      );
      expect(response.suggested_actions).toBeDefined();
      expect(response.suggested_actions!.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Extraction', () => {
    it('should extract token symbols correctly', async () => {
      const request: ConversationRequest = {
        user_input: "Compare SOL, ETH, and BTC prices",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      const tokenEntities = response.entities.filter(e => e.entity_type === 'token');
      expect(tokenEntities).toHaveLength(3);
      expect(tokenEntities.map(e => e.value)).toEqual(
        expect.arrayContaining(['SOL', 'ETH', 'BTC'])
      );
    });

    it('should extract protocol names', async () => {
      const request: ConversationRequest = {
        user_input: "What are the fees on Raydium vs Orca?",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      const protocolEntities = response.entities.filter(e => e.entity_type === 'protocol');
      expect(protocolEntities).toHaveLength(2);
      expect(protocolEntities.map(e => e.value)).toEqual(
        expect.arrayContaining(['Raydium', 'Orca'])
      );
    });

    it('should extract amounts and timeframes', async () => {
      const request: ConversationRequest = {
        user_input: "I want to invest $1000 in SOL for the next 6 months",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      const amountEntity = response.entities.find(e => e.entity_type === 'amount');
      const timeframeEntity = response.entities.find(e => e.entity_type === 'timeframe');

      expect(amountEntity).toBeDefined();
      expect(amountEntity!.value).toContain('1000');
      expect(timeframeEntity).toBeDefined();
      expect(timeframeEntity!.value).toContain('6 months');
    });
  });

  describe('Intent Classification', () => {
    it('should classify trading intents correctly', async () => {
      const tradingQueries = [
        { query: "Buy 10 SOL", expected_intent: 'trade_execution' },
        { query: "Sell half of my ETH", expected_intent: 'trade_execution' },
        { query: "Swap USDC for SOL", expected_intent: 'swap_request' },
        { query: "What's the best price for buying SOL?", expected_intent: 'price_inquiry' }
      ];

      for (const { query, expected_intent } of tradingQueries) {
        const request: ConversationRequest = {
          user_input: query,
          conversation_history: [],
          user_context: { preferred_language: 'en' }
        };

        const response = await engine.processConversation(request);
        expect(response.intent).toBe(expected_intent);
      }
    });

    it('should classify analytical intents correctly', async () => {
      const analyticalQueries = [
        { query: "Show me market trends", expected_intent: 'market_analysis' },
        { query: "What's the sentiment around BONK?", expected_intent: 'sentiment_analysis' },
        { query: "Analyze this wallet address", expected_intent: 'wallet_analysis' },
        { query: "How is my portfolio performing?", expected_intent: 'portfolio_analysis' }
      ];

      for (const { query, expected_intent } of analyticalQueries) {
        const request: ConversationRequest = {
          user_input: query,
          conversation_history: [],
          user_context: { preferred_language: 'en' }
        };

        const response = await engine.processConversation(request);
        expect(response.intent).toBe(expected_intent);
      }
    });
  });

  describe('Conversation Context', () => {
    it('should maintain conversation context', async () => {
      const firstRequest: ConversationRequest = {
        user_input: "What's the price of SOL?",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const firstResponse = await engine.processConversation(firstRequest);

      const secondRequest: ConversationRequest = {
        user_input: "How about ETH?",
        conversation_history: [
          { role: 'user', content: firstRequest.user_input },
          { role: 'assistant', content: firstResponse.response_text }
        ],
        user_context: { preferred_language: 'en' }
      };

      const secondResponse = await engine.processConversation(secondRequest);

      expect(secondResponse.intent).toBe('price_inquiry');
      expect(secondResponse.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'token',
            value: 'ETH'
          })
        ])
      );
    });

    it('should handle follow-up questions', async () => {
      const conversationHistory = [
        { role: 'user', content: "Show me Jupiter's TVL" },
        { role: 'assistant', content: "Jupiter's current TVL is $150M..." }
      ];

      const request: ConversationRequest = {
        user_input: "What about Raydium?",
        conversation_history: conversationHistory,
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('protocol_analysis');
      expect(response.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'protocol',
            value: 'Raydium'
          })
        ])
      );
    });
  });

  describe('Blockchain Actions', () => {
    it('should generate appropriate blockchain actions for trades', async () => {
      const request: ConversationRequest = {
        user_input: "Swap 100 USDC for SOL on Jupiter",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response.blockchain_actions).toBeDefined();
      expect(response.blockchain_actions!).toHaveLength(1);
      const action = response.blockchain_actions![0];
      
      expect(action.action_type).toBe('swap');
      expect(action.parameters).toEqual(
        expect.objectContaining({
          from_token: 'USDC',
          to_token: 'SOL',
          amount: '100',
          protocol: 'Jupiter'
        })
      );
      expect(action.requires_approval).toBe(true);
    });

    it('should suggest multiple blockchain actions for complex requests', async () => {
      const request: ConversationRequest = {
        user_input: "I want to stake my SOL and provide liquidity to the SOL-USDC pool",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response.blockchain_actions).toBeDefined();
      expect(response.blockchain_actions!.length).toBeGreaterThanOrEqual(2);
      
      const stakingAction = response.blockchain_actions!.find(a => a.action_type === 'stake');
      const liquidityAction = response.blockchain_actions!.find(a => a.action_type === 'add_liquidity');
      
      expect(stakingAction).toBeDefined();
      expect(liquidityAction).toBeDefined();
    });
  });

  describe('Multi-language Support', () => {
    it('should handle Spanish queries', async () => {
      const request: ConversationRequest = {
        user_input: "¿Cuál es el precio de SOL?",
        conversation_history: [],
        user_context: { preferred_language: 'es' }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('price_inquiry');
      expect(response.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entity_type: 'token',
            value: 'SOL'
          })
        ])
      );
      expect(response.detected_language).toBe('es');
    });

    it('should handle French queries', async () => {
      const request: ConversationRequest = {
        user_input: "Montrez-moi l'historique des transactions",
        conversation_history: [],
        user_context: { preferred_language: 'fr' }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('transaction_history');
      expect(response.detected_language).toBe('fr');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle ambiguous queries gracefully', async () => {
      const request: ConversationRequest = {
        user_input: "it",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('unclear');
      expect(response.confidence).toBeLessThan(0.5);
      expect(response.response_text).toContain('clarify');
    });

    it('should handle empty input', async () => {
      const request: ConversationRequest = {
        user_input: "",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.intent).toBe('unclear');
      expect(response.response_text).toContain('help');
    });

    it('should handle very long inputs', async () => {
      const longInput = "I want to " + "analyze ".repeat(100) + "my portfolio";
      
      const request: ConversationRequest = {
        user_input: longInput,
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response).toBeDefined();
      expect(response.intent).toBeDefined();
    });

    it('should sanitize potentially harmful inputs', async () => {
      const request: ConversationRequest = {
        user_input: "<script>alert('xss')</script> Show me my balance",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.response_text).not.toContain('<script>');
      expect(response.response_text).not.toContain('alert');
    });
  });

  describe('Confidence Scoring', () => {
    it('should provide high confidence for clear queries', async () => {
      const request: ConversationRequest = {
        user_input: "What is the current price of SOL in USD?",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.confidence).toBeGreaterThan(0.8);
    });

    it('should provide low confidence for ambiguous queries', async () => {
      const request: ConversationRequest = {
        user_input: "What about that thing?",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.confidence).toBeLessThan(0.5);
    });
  });

  describe('Suggested Actions', () => {
    it('should provide relevant suggested actions', async () => {
      const request: ConversationRequest = {
        user_input: "My portfolio is down 20% this week",
        conversation_history: [],
        user_context: {
          wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          preferred_language: 'en'
        }
      };

      const response = await engine.processConversation(request);

      expect(response.suggested_actions).toBeDefined();
      expect(response.suggested_actions!.length).toBeGreaterThan(0);
      expect(response.suggested_actions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/analyz|review|diversif|rebalanc/i)
        ])
      );
    });

    it('should suggest educational actions for beginners', async () => {
      const request: ConversationRequest = {
        user_input: "I'm new to DeFi, what should I do?",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);

      expect(response.suggested_actions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/learn|education|start|basic/i)
        ])
      );
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const request: ConversationRequest = {
        user_input: "Analyze the correlation between SOL and ETH over the last month",
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const startTime = Date.now();
      const response = await engine.processConversation(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(response).toBeDefined();
    });
  });
});

describe('NLP Entity Processing', () => {
  let engine: NLPEngine;

  beforeEach(() => {
    engine = new NLPEngine();
  });

  it('should handle complex entity combinations', async () => {
    const request: ConversationRequest = {
      user_input: "Swap 500 USDC for SOL on Jupiter and then stake 50% of it on Marinade",
      conversation_history: [],
      user_context: { preferred_language: 'en' }
    };

    const response = await engine.processConversation(request);

    // Should extract multiple tokens
    const tokenEntities = response.entities.filter(e => e.entity_type === 'token');
    expect(tokenEntities.length).toBeGreaterThanOrEqual(2);

    // Should extract amounts
    const amountEntities = response.entities.filter(e => e.entity_type === 'amount');
    expect(amountEntities.length).toBeGreaterThanOrEqual(1);

    // Should extract protocols
    const protocolEntities = response.entities.filter(e => e.entity_type === 'protocol');
    expect(protocolEntities.length).toBeGreaterThanOrEqual(2);
  });

  it('should normalize token symbols', async () => {
    const variations = [
      "sol", "SOL", "Solana", "$SOL", "solana"
    ];

    for (const variation of variations) {
      const request: ConversationRequest = {
        user_input: `What's the price of ${variation}?`,
        conversation_history: [],
        user_context: { preferred_language: 'en' }
      };

      const response = await engine.processConversation(request);
      
      const tokenEntity = response.entities.find(e => e.entity_type === 'token');
      expect(tokenEntity).toBeDefined();
      expect(tokenEntity!.normalized_value).toBe('SOL');
    }
  });
});