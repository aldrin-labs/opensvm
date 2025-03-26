'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FAQItem {
  question: string;
  answer: string;
  links?: { text: string; url: string }[];
}

const CATEGORIES = [
  'Getting Started',
  'Wallet',
  'Solana Basics',
  'Tokens & NFTs',
  'Analytics',
  'Technical'
];

const FAQ_ITEMS: Record<string, FAQItem[]> = {
  'Getting Started': [
    {
      question: 'What is OpenSVM?',
      answer: 'OpenSVM is a comprehensive platform for exploring and analyzing the Solana blockchain. It provides tools for viewing transactions, accounts, tokens, NFTs, and network statistics. The platform also includes AI-powered features to help users understand blockchain data more easily.'
    },
    {
      question: 'How do I search for a transaction or account?',
      answer: 'You can use the search bar at the top of the page to search for transactions, accounts, tokens, or programs. Enter a Solana address, transaction signature, or keyword to get started.',
      links: [
        { text: 'Go to Search', url: '/search' }
      ]
    },
    {
      question: 'Is OpenSVM free to use?',
      answer: 'Yes, OpenSVM is completely free to use. There are no subscription fees or hidden costs.'
    }
  ],
  'Wallet': [
    {
      question: 'How do I connect my wallet to OpenSVM?',
      answer: 'You can connect your Solana wallet by clicking the "Connect Wallet" button in the navigation bar. We support popular wallets like Phantom, Solflare, and others. Once connected, you\'ll be able to view your account details and interact with the platform more effectively.',
      links: [
        { text: 'Connect Wallet', url: '/wallet' }
      ]
    },
    {
      question: 'Which wallets are supported?',
      answer: 'OpenSVM supports most popular Solana wallets, including Phantom, Solflare, Torus, Ledger, Slope, and Sollet.'
    },
    {
      question: 'Is it safe to connect my wallet?',
      answer: 'Yes, connecting your wallet to OpenSVM is safe. We only request view access to your public address to display your account information. We never request or store your private keys or seed phrases, and we don\'t initiate any transactions without your explicit approval.'
    }
  ],
  'Solana Basics': [
    {
      question: 'What is Solana?',
      answer: 'Solana is a high-performance blockchain platform designed for decentralized applications and marketplaces. It offers fast transaction speeds (up to 65,000 TPS theoretically), low costs, and a growing ecosystem of applications spanning DeFi, NFTs, gaming, and more.'
    },
    {
      question: 'What is SVM?',
      answer: 'SVM (Solana Virtual Machine) is the runtime environment that executes programs on the Solana blockchain. It processes transactions and smart contracts with high throughput and low latency, making Solana one of the fastest blockchains available.'
    },
    {
      question: 'How does Solana achieve high performance?',
      answer: 'Solana achieves high performance through several innovations, including Proof of History (a clock before consensus), Tower BFT (an optimized version of PBFT), Turbine (a block propagation protocol), Gulf Stream (transaction forwarding protocol), Sealevel (parallel transaction processing), Pipelining (transaction processing optimization), and Cloudbreak (horizontally-scaled accounts database).'
    }
  ],
  'Tokens & NFTs': [
    {
      question: 'How can I find information about a specific token?',
      answer: 'You can search for a token by its name or address using the search bar. Alternatively, you can browse all tokens in the Tokens section. Each token page displays price information, market data, and recent transactions.',
      links: [
        { text: 'Browse Tokens', url: '/tokens' }
      ]
    },
    {
      question: 'Where can I see NFT collections?',
      answer: 'You can explore Solana NFT collections in the NFTs section. There you can browse collections, view trending NFTs, and discover new mints.',
      links: [
        { text: 'Browse NFT Collections', url: '/nfts' },
        { text: 'Trending NFTs', url: '/nfts/trending' }
      ]
    },
    {
      question: 'How do I check if a token is legitimate?',
      answer: 'To verify a token\'s legitimacy, check its transaction history, holder count, and market data on its token page. Legitimate tokens typically have consistent trading activity, a reasonable number of holders, and verifiable links to official websites and social media. Always be cautious of tokens with very low liquidity or suspicious transaction patterns.'
    }
  ],
  'Analytics': [
    {
      question: 'What kind of analytics does OpenSVM provide?',
      answer: 'OpenSVM provides comprehensive analytics about the Solana network, including current TPS (Transactions Per Second), active accounts, total transaction count, block time and epoch information, validator statistics, and DeFi metrics like Market Cap and TVL (Total Value Locked).',
      links: [
        { text: 'View Analytics Dashboard', url: '/analytics' }
      ]
    },
    {
      question: 'How often is the analytics data updated?',
      answer: 'Most analytics data is updated in real-time or near real-time (within minutes). Some aggregated statistics may be updated less frequently, typically hourly or daily.'
    },
    {
      question: 'Can I see historical performance data?',
      answer: 'Yes, many of our analytics charts display historical data, allowing you to track changes in network performance, token prices, and other metrics over time.'
    }
  ],
  'Technical': [
    {
      question: 'What are Solana programs?',
      answer: 'Solana programs (similar to smart contracts on other blockchains) are immutable pieces of code deployed on the Solana blockchain that define the rules for how data is stored and updated. They power decentralized applications (dApps) and execute various functions like token transfers, swaps, lending, and more.',
      links: [
        { text: 'Explore Programs', url: '/programs' }
      ]
    },
    {
      question: 'How do I view transaction details?',
      answer: 'You can view detailed information about a transaction by searching for its signature or clicking on a transaction link from an account or token page. The transaction page shows the sender, receiver, amount, timestamp, and other relevant details.',
      links: [
        { text: 'Recent Transactions', url: '/tx' }
      ]
    },
    {
      question: 'What is a Solana account?',
      answer: 'In Solana, an account is a record in the blockchain that stores data. There are different types of accounts: system accounts (owned by users), program accounts (containing executable code), and data accounts (storing program data). Each account has an owner, lamport balance (SOL), and data specific to its purpose.'
    }
  ]
};

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Help & FAQ</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about OpenSVM and Solana.
        </p>
      </div>

      {/* Category navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? 'default' : 'outline'}
            onClick={() => setActiveCategory(category)}
            className="mb-2"
          >
            {category}
          </Button>
        ))}
      </div>

      {/* FAQ items */}
      <div className="space-y-6">
        {FAQ_ITEMS[activeCategory]?.map((item, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-xl">{item.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-foreground/90 whitespace-pre-line text-base">
                {item.answer}
              </CardDescription>
              
              {item.links && item.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.links.map((link, linkIndex) => (
                    <Button 
                      key={linkIndex} 
                      variant="outline" 
                      size="sm" 
                      asChild
                    >
                      <Link href={link.url}>{link.text}</Link>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}