/**
 * Searx search integration
 *
 * This module provides functions to search the web using Searx
 * and integrate the results with the OpenSVM search interface.
 */

/**
 * Search Searx for a query
 * @param query - Search query
 * @param limit - Maximum number of results to return
 * @returns Array of Searx search results
 */
export async function searchSearx(query: string, limit: number = 10) {
  try {
    const url = `https://searx.stream/search?q=${encodeURIComponent(query)}&category_general=1&language=auto&time_range=&safesearch=0&theme=simple&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Searx request failed');
    const data = await response.json();
    // Searx returns results in data.results
    const results = (data.results || []).slice(0, limit).map((item: any) => ({
      id: item.id || `searx_${Math.random().toString(36).substring(2, 15)}`,
      type: 'searx',
      title: item.title,
      description: item.content || item.description || '',
      url: item.url,
      domain: item.pretty_url || (item.url ? (new URL(item.url)).hostname : ''),
      favicon: item.favicon || (item.url ? `https://${(new URL(item.url)).hostname}/favicon.ico` : ''),
      timestamp: item.publishedDate || item.published || item.date || new Date().toISOString()
    }));
    return results;
  } catch (error) {
    console.error('Error searching Searx:', error);
    return [];
  }
}

// Alias for backward compatibility
export const searchDuckDuckGo = searchSearx;
export const formatDuckDuckGoResults = formatSearxResults;


/**
 * Format Searx search results for display
 * @param results - Searx search results
 * @returns Formatted results for UI display
 */
export function formatSearxResults(results: any[]) {
  return results.map(result => ({
    id: result.id,
    type: 'web',
    title: result.title,
    content: result.description,
    url: result.url,
    domain: result.domain,
    favicon: result.favicon,
    timestamp: result.timestamp
  }));
}

/**
 * Render a Searx result card
 * @param result - Formatted Searx result
 * @returns JSX for the result card
 */
export function renderSearxResultCard(result: any) {
  return `
    <div class="border rounded-lg p-4 hover:bg-muted/30 transition-colors duration-200">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <h3 class="font-medium text-sm">${result.title}</h3>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">${result.domain}</p>
          <p class="mt-1 text-sm">${result.content}</p>
          <div class="mt-2">
            <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline">Visit website</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
