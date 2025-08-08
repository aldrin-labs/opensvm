"use client";

import React from 'react';
import Link from 'next/link';

interface Network {
  id: string;
  name: string;
  description: string;
  links: {
    github?: string;
    website?: string;
    whitepaper?: string;
    telegram?: string;
    twitter?: string;
    discord?: string;
    youtube?: string;
    mirror?: string;
    feedback?: string;
  };
  endpoints: {
    mainnet?: string;
    testnet?: string;
    devnet?: string;
  };
}

export const networks: Network[] = [
  {
    id: 'solana',
    name: 'Solana',
    description: 'Solana is a high-performance blockchain platform designed for decentralized applications and marketplaces.',
    links: {
      github: 'https://github.com/solana-labs/solana',
      website: 'https://solana.com',
      whitepaper: 'https://solana.com/solana-whitepaper.pdf',
      telegram: 'https://t.me/solana',
      twitter: 'https://twitter.com/solana',
      discord: 'https://discord.com/invite/solana',
    },
    endpoints: {
      mainnet: 'https://api.mainnet-beta.solana.com',
      testnet: 'https://api.testnet.solana.com',
      devnet: 'https://api.devnet.solana.com',
    },
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    description: 'Eclipse is building Solana on Ethereum, using the SVM to scale Ethereum. It combines Solana\'s performance with Ethereum\'s network effects.',
    links: {
      github: 'https://github.com/Eclipse-Laboratories-Inc',
      website: 'https://eclipse.builders',
      whitepaper: 'https://docs.eclipse.builders',
      telegram: 'https://t.me/eclipsebuilders',
      twitter: 'https://twitter.com/EclipseFND',
      discord: 'https://discord.gg/eclipse-labs',
      youtube: 'https://www.youtube.com/@EclipseBuilders',
      mirror: 'https://mirror.xyz/eclipsefnd.eth',
      feedback: 'https://feedback.eclipse.builders',
    },
    endpoints: {
      mainnet: 'https://mainnetbeta-rpc.eclipse.xyz',
      testnet: 'https://testnet.dev2.eclipsenetwork.xyz',
      devnet: 'https://staging-rpc.dev2.eclipsenetwork.xyz',
    },
  },
];

export function NetworksTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Project
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Description
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Links
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {networks.map((network) => (
            <tr key={network.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {network.name}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                {network.description}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(network.links).map(([key, url]) => (
                    <Link
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-600 hover:text-pink-700 capitalize"
                    >
                      {key}
                    </Link>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="text-xs">
                    <span className="font-semibold">Mainnet:</span> {network.endpoints.mainnet}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold">Testnet:</span> {network.endpoints.testnet}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold">Devnet:</span> {network.endpoints.devnet}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
