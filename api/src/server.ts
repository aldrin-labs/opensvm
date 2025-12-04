import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { contentType } from 'https://deno.land/std@0.168.0/media_types/content_type.ts';

// Health check endpoint
function healthCheck() {
  return new Response(
    JSON.stringify({ 
      status: 'ok', 
      service: 'dflow-mcp',
      version: '1.0.0',
      tools: 23
    }), 
    { 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}

// File server with proper content types
async function serveFile(path: string) {
  try {
    const content = await Deno.readTextFile(`.${path}`);
    const ext = path.split('.').pop();
    const ct = contentType(ext || 'text/plain');
    
    return new Response(content, {
      headers: { 'Content-Type': ct || 'text/plain' }
    });
  } catch {
    return new Response('File not found', { status: 404 });
  }
}

// Handle requests
Deno.serve({ port: 8000 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Health check
  if (path === '/health') {
    return healthCheck();
  }

  // API documentation
  if (path === '/') {
    return serveFile('/index.html');
  }

  // Static files
  if (path.startsWith('/src/') || path.endsWith('.json') || path.endsWith('.md')) {
    return serveFile(path);
  }

  // 404 for other routes
  return serveFile('/index.html');
});

console.log('DFlow MCP Server running on http://localhost:8000');