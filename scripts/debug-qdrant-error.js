import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_SERVER || 'http://localhost:6333',
  apiKey: process.env.QDRANT || undefined,
});

async function debugQdrantError() {
  try {
    console.log('Testing Qdrant connection...');
    
    // Test basic connection
    const collections = await qdrantClient.getCollections();
    console.log('Collections:', collections.collections?.map(c => c.name));
    
    // Check if global_chat collection exists
    try {
      const collection = await qdrantClient.getCollection('global_chat');
      console.log('global_chat collection info:', JSON.stringify(collection, null, 2));
    } catch (collError) {
      console.error('Collection error:', collError);
      return;
    }
    
    // Test inserting a simple message
    const testMessage = {
      id: crypto.randomUUID(), // Use proper UUID for Qdrant compatibility
      username: 'debug',
      message: 'debug message',
      timestamp: Date.now(),
      isGuest: true,
      userColor: '#FF6B6B'
    };
    
    console.log('Testing message insert:', testMessage);
    
    // Generate simple vector
    const vector = new Array(384).fill(0).map((_, i) => Math.sin(i) * 0.1);
    
    const upsertData = {
      wait: true,
      points: [{
        id: testMessage.id,
        vector,
        payload: testMessage
      }]
    };
    
    console.log('Upserting with payload keys:', Object.keys(testMessage));
    
    const result = await qdrantClient.upsert('global_chat', upsertData);
    console.log('Upsert result:', result);
    
    // Clean up - delete the test message
    await qdrantClient.delete('global_chat', {
      points: [testMessage.id]
    });
    console.log('Cleanup successful');
    
  } catch (error) {
    console.error('Debug error:', error);
    
    // Check if error has additional data
    if (error.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2));
    }
    
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response, null, 2));
    }
    
    if (error.headers) {
      console.error('Error headers:', error.headers);
    }
    
    if (error.url) {
      console.error('Error URL:', error.url);
    }
    
    if (error.status) {
      console.error('Error status:', error.status);
    }
    
    if (error.statusText) {
      console.error('Error status text:', error.statusText);
    }
  }
}

debugQdrantError();
