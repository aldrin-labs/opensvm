/**
 * DuckDuckGo search integration
 * 
 * This module provides functions to search the web using DuckDuckGo
 * and integrate the results with the OpenSVM search interface.
 */

/**
 * Search DuckDuckGo for a query
 * @param query - Search query
 * @param limit - Maximum number of results to return
 * @returns Array of DuckDuckGo search results
 */
export async function searchDuckDuckGo(query: string, limit: number = 10) {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // In a real implementation, this would call the DuckDuckGo API or use web scraping
    // For this simulation, we'll generate mock results
    const results = generateSimulatedDuckDuckGoResults(query, limit);
    
    return results;
  } catch (error) {
    console.error('Error searching DuckDuckGo:', error);
    return [];
  }
}

/**
 * Generate simulated DuckDuckGo search results
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Simulated DuckDuckGo search results
 */
function generateSimulatedDuckDuckGoResults(query: string, limit: number) {
  // Add Solana and blockchain specific domains for realistic results
  const domains = [
    { name: 'Solana.com', domain: 'solana.com' },
    { name: 'Solana Docs', domain: 'docs.solana.com' },
    { name: 'Solana Foundation', domain: 'solana-foundation.org' },
    { name: 'SolDev', domain: 'soldev.app' },
    { name: 'Solana Cookbook', domain: 'solanacookbook.com' },
    { name: 'CoinDesk', domain: 'coindesk.com' },
    { name: 'CoinTelegraph', domain: 'cointelegraph.com' },
    { name: 'Decrypt', domain: 'decrypt.co' },
    { name: 'GitHub', domain: 'github.com' },
    { name: 'Medium', domain: 'medium.com' },
    { name: 'Dev.to', domain: 'dev.to' },
    { name: 'Stack Overflow', domain: 'stackoverflow.com' },
    { name: 'Reddit', domain: 'reddit.com' },
    { name: 'Twitter', domain: 'twitter.com' },
    { name: 'YouTube', domain: 'youtube.com' }
  ];
  
  const titleTemplates = [
    '{query} - Complete Guide and Tutorial',
    'Understanding {query} in Solana Blockchain',
    'How to Use {query} for Blockchain Development',
    'Latest Updates on {query} in 2025',
    '{query} Explained: Everything You Need to Know',
    'Top 10 Features of {query} You Should Know',
    'Building with {query}: Best Practices',
    '{query} vs Alternatives: A Comparison',
    'Troubleshooting Common {query} Issues',
    'Getting Started with {query} on Solana'
  ];
  
  const descriptionTemplates = [
    'A comprehensive guide to {query} with examples and code snippets for developers.',
    'Learn how {query} works in the Solana ecosystem and how to leverage it for your projects.',
    'Discover the latest updates and features of {query} in the blockchain space.',
    'This article explains {query} in simple terms with practical applications.',
    'An in-depth analysis of {query} and its impact on blockchain technology.',
    'Step-by-step tutorial on implementing {query} in your Solana applications.',
    'Explore the benefits and limitations of {query} compared to other solutions.',
    'Community insights and best practices for working with {query}.',
    'Expert opinions on how {query} is shaping the future of decentralized applications.',
    'Troubleshooting guide for common issues when working with {query}.'
  ];
  
  const results = [];
  
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const titleTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
    const descriptionTemplate = descriptionTemplates[Math.floor(Math.random() * descriptionTemplates.length)];
    
    const title = titleTemplate.replace('{query}', query);
    const description = descriptionTemplate.replace('{query}', query);
    const path = `/${query.toLowerCase().replace(/\s+/g, '-')}${Math.random() > 0.5 ? '.html' : ''}`;
    const url = `https://${domain.domain}${path}`;
    
    results.push({
      id: `ddg_${Math.random().toString(36).substring(2, 15)}`,
      type: 'duckduckgo',
      title: title,
      description: description,
      url: url,
      domain: domain.name,
      favicon: `https://${domain.domain}/favicon.ico`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString() // Random date within last 90 days
    });
  }
  
  return results;
}

/**
 * Format DuckDuckGo search results for display
 * @param results - DuckDuckGo search results
 * @returns Formatted results for UI display
 */
export function formatDuckDuckGoResults(results: any[]) {
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
 * Render a DuckDuckGo result card
 * @param result - Formatted DuckDuckGo result
 * @returns JSX for the result card
 */
export function renderDuckDuckGoResultCard(result: any) {
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
