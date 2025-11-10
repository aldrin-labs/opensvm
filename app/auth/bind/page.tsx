'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { sign } from 'tweetnacl';

function BindWalletContent() {
  const searchParams = useSearchParams();
  const { publicKey, signMessage } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('No auth token provided in URL');
      setStatus('error');
    }
  }, [searchParams]);

  const handleBindWallet = async () => {
    if (!publicKey || !signMessage || !token) {
      setError('Wallet not connected or token missing');
      setStatus('error');
      return;
    }

    try {
      setStatus('signing');
      setError('');

      // Create message to sign
      const authMessage = `Bind wallet to OpenSVM API key\nToken: ${token}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(authMessage);

      // Request signature from wallet
      const signature = await signMessage(messageBytes);
      const signatureBase64 = Buffer.from(signature).toString('base64');

      // Send to backend
      const response = await fetch('/api/auth/bind-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          walletAddress: publicKey.toString(),
          signature: signatureBase64,
          message: authMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to bind wallet');
      }

      setStatus('success');
      setMessage(`Successfully bound wallet ${publicKey.toString()} to API key ${data.apiKeyId}`);
    } catch (err) {
      console.error('Error binding wallet:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to bind wallet');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Bind Wallet to API Key</h1>
          <p className="text-gray-400">
            Connect your Solana wallet to authorize this API key
          </p>
        </div>

        {!token && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">
              ⚠️ No auth token found in URL. Please use the link provided when creating the API key.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-green-400 font-medium mb-1">Success!</p>
                <p className="text-green-300 text-sm break-words overflow-wrap-anywhere">{message}</p>
                <p className="text-gray-400 text-xs mt-2">
                  You can now use your API key in CLI tools and bots.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-400 font-medium mb-1">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
          </div>

          {publicKey && token && status !== 'success' && (
            <button
              onClick={handleBindWallet}
              disabled={status === 'signing'}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {status === 'signing' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Authorize API Key
                </>
              )}
            </button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-gray-400 text-xs text-center">
            By authorizing, you're binding your wallet to an API key for use in CLI tools and bots.
            This does not grant access to your funds.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BindWalletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <BindWalletContent />
    </Suspense>
  );
}
