// Utility function to handle AI response errors
export function handleAiResponseError(error: any): string {
  console.error('AI Response Error:', error);
  
  // Check for specific error types
  if (error.message?.includes('API key')) {
    return 'Authentication error: Please check your API key configuration.';
  }
  
  if (error.message?.includes('rate limit')) {
    return 'Rate limit exceeded: Too many requests. Please try again later.';
  }
  
  if (error.message?.includes('timeout') || error.name === 'AbortError') {
    return 'Request timed out: The AI service took too long to respond. Please try again.';
  }
  
  if (error.message?.includes('network') || error.name === 'NetworkError') {
    return 'Network error: Please check your internet connection and try again.';
  }
  
  // Default error message
  return 'An error occurred while generating the AI response. Please try again later.';
}

// Utility function to validate streaming response
export function validateStreamResponse(chunk: any): boolean {
  if (!chunk) return false;
  
  try {
    // Check if the chunk has the expected format
    if (typeof chunk.text === 'string' || Array.isArray(chunk.sources)) {
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error validating stream response:', e);
    return false;
  }
}

// Utility function to sanitize AI response text
export function sanitizeAiResponseText(text: string): string {
  // Remove any potentially harmful HTML
  const sanitized = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<img[^>]*>/gi, '[IMAGE]');
  
  return sanitized;
}

// Utility function to format AI response for display
export function formatAiResponseForDisplay(text: string): string[] {
  // Split by double newlines to get paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  
  // Handle bullet points and formatting
  return paragraphs.map(paragraph => {
    // Convert markdown-style bullet points to proper HTML if needed
    return paragraph.replace(/^\s*-\s+/gm, '• ');
  });
}
