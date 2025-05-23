/**
 * X.com (Twitter) search integration
 * 
 * This module provides functions to search X.com (formerly Twitter)
 * and integrate the results with the OpenSVM search interface.
 */

/**
 * Search X.com for a query
 * @param query - Search query
 * @param limit - Maximum number of results to return
 * @returns Array of X.com search results
 */
export async function searchXCom(query: string, limit: number = 10) {
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 700));
    
    // In a real implementation, this would call the X.com API
    // For this simulation, we'll generate mock results
    const results = generateSimulatedXComResults(query, limit);
    
    return results;
  } catch (error) {
    console.error('Error searching X.com:', error);
    return [];
  }
}

/**
 * Generate simulated X.com search results
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Simulated X.com search results
 */
function generateSimulatedXComResults(query: string, limit: number) {
  // Crypto and blockchain influencers/accounts
  const accounts = [
    { name: 'Solana', handle: 'solana', verified: true, followers: 2400000, avatar: 'solana.jpg' },
    { name: 'Anatoly Yakovenko', handle: 'aeyakovenko', verified: true, followers: 320000, avatar: 'anatoly.jpg' },
    { name: 'Raj Gokal', handle: 'rajgokal', verified: true, followers: 180000, avatar: 'raj.jpg' },
    { name: 'SolanaFloor', handle: 'SolanaFloor', verified: false, followers: 95000, avatar: 'solanafloor.jpg' },
    { name: 'Solana Status', handle: 'SolanaStatus', verified: true, followers: 450000, avatar: 'solanastatus.jpg' },
    { name: 'Solana Developers', handle: 'SolanaDevelopers', verified: true, followers: 210000, avatar: 'solanadevs.jpg' },
    { name: 'Crypto Analyst', handle: 'CryptoAnalyst', verified: false, followers: 125000, avatar: 'analyst.jpg' },
    { name: 'Blockchain Daily', handle: 'BlockchainDaily', verified: true, followers: 380000, avatar: 'blockchain.jpg' },
    { name: 'DeFi Updates', handle: 'DeFiUpdates', verified: false, followers: 85000, avatar: 'defi.jpg' },
    { name: 'NFT Collector', handle: 'NFTCollector', verified: false, followers: 110000, avatar: 'nft.jpg' }
  ];
  
  const tweetTemplates = [
    "Just published a new article about {query}. Check it out! #Solana #Blockchain",
    "The latest {query} update is a game-changer for the Solana ecosystem. Thoughts? 🧵",
    "{query} is trending today with some impressive metrics. Here's what you need to know:",
    "I've been exploring {query} on Solana and I'm impressed with the performance. 10/10 would recommend.",
    "Breaking: New developments in {query} could reshape how we think about blockchain technology.",
    "Hot take: {query} is underrated and will be a key player in the next bull run. #NotFinancialAdvice",
    "Just released a tutorial on how to use {query} effectively. Link in bio! #SolanaDevs",
    "The community response to {query} has been overwhelming. Thanks for all the support!",
    "Unpopular opinion: {query} still has major issues that need to be addressed before mass adoption.",
    "Excited to announce our partnership with {query}! More details coming soon. #Bullish"
  ];
  
  const results = [];
  
  for (let i = 0; i < Math.min(limit, 20); i++) {
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    const tweetTemplate = tweetTemplates[Math.floor(Math.random() * tweetTemplates.length)];
    const tweet = tweetTemplate.replace('{query}', query);
    
    // Random date within last 7 days
    const timestamp = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
    
    results.push({
      id: `tweet_${Math.random().toString(36).substring(2, 15)}`,
      type: 'x_com',
      content: tweet,
      account: {
        name: account.name,
        handle: account.handle,
        verified: account.verified,
        followers: account.followers,
        avatar: account.avatar
      },
      timestamp: timestamp.toISOString(),
      likes: Math.floor(Math.random() * 5000),
      retweets: Math.floor(Math.random() * 1000),
      replies: Math.floor(Math.random() * 200),
      url: `https://x.com/${account.handle}/status/${Math.random().toString(36).substring(2, 15)}`
    });
  }
  
  return results;
}

/**
 * Format X.com search results for display
 * @param results - X.com search results
 * @returns Formatted results for UI display
 */
export function formatXComResults(results: any[]) {
  return results.map(result => ({
    id: result.id,
    type: 'x_com',
    title: `${result.account.name} (@${result.account.handle})`,
    content: result.content,
    url: result.url,
    timestamp: result.timestamp,
    metadata: {
      account: result.account,
      likes: result.likes,
      retweets: result.retweets,
      replies: result.replies
    }
  }));
}

/**
 * Render an X.com result card
 * @param result - Formatted X.com result
 * @returns JSX for the result card
 */
export function renderXComResultCard(result: any) {
  const date = new Date(result.timestamp);
  const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  
  return `
    <div class="border rounded-lg p-4 hover:bg-muted/30 transition-colors duration-200">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 bg-black rounded-full flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-medium text-sm">${result.metadata.account.name} 
                ${result.metadata.account.verified ? 
                  '<span class="inline-block ml-1 text-blue-500"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></svg></span>' 
                  : ''
                }
              </h3>
              <p class="text-xs text-muted-foreground">@${result.metadata.account.handle} · ${formattedDate}</p>
            </div>
          </div>
          <p class="mt-2 text-sm">${result.content}</p>
          <div class="mt-3 flex items-center gap-4">
            <span class="text-xs text-muted-foreground">${result.metadata.likes.toLocaleString()} likes</span>
            <span class="text-xs text-muted-foreground">${result.metadata.retweets.toLocaleString()} reposts</span>
            <span class="text-xs text-muted-foreground">${result.metadata.replies.toLocaleString()} replies</span>
          </div>
          <div class="mt-2">
            <a href="${result.url}" target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline">View on X.com</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
