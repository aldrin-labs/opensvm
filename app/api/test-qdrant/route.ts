
export async function GET() {
  try {
    const { qdrantClient } = await import('../../../lib/qdrant');
    const collections = await qdrantClient.getCollections();
    return Response.json({ 
      status: 'success', 
      collections: collections.collections.map(c => c.name),
      total: collections.collections.length 
    });
  } catch (error) {
    return Response.json({ 
      status: 'error', 
      message: error.message,
      collections: []
    }, { status: 500 });
  }
}
