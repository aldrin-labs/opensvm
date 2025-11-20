export async function sendMessageToAnthropic(messages: { role: string; content: string; }[]) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error('Failed to get response from chat API');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling chat API:', error);
    throw error;
  }
} 