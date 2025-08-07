'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils'

export default function CatchAllRoute({ params }: { params: { slug: string[] } }) {
  const router = useRouter()
  const input = params.slug.join('/')

  useEffect(() => {
    async function handleRedirect() {
      try {
        // Check if it's a numeric value (potential block number)
        if (/^\d+$/.test(input)) {
          router.push(`/block/${input}`)
          return
        }

        // Check if it's a transaction signature (64-88 character base58 string)
        if (isValidTransactionSignature(input)) {
          router.push(`/tx/${input}`)
          return
        }

        // Check if it's a valid Solana address (44 character base58 string)
        if (isValidSolanaAddress(input)) {
          router.push(`/account/${input}`)
          return
        }

        // For everything else that doesn't match any pattern, redirect to search
        router.push(`/search?q=${encodeURIComponent(input)}`)
      } catch (error) {
        console.error('Error in catch-all route:', error)
        // Fallback to search page on any error
        router.push(`/search?q=${encodeURIComponent(input)}`)
      }
    }

    handleRedirect()
  }, [input, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">
        <p className="text-lg">Analyzing input...</p>
      </div>
    </div>
  )
}