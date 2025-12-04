exports.handler = async function(event, context) {
  // Basic health check function
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'ok',
      service: 'dflow-mcp',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    })
  };
};