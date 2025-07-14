'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FloatingAIButton() {
  const router = useRouter();

  return (
    <Button
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#00DC82] hover:bg-[#00DC82]/90 text-black shadow-lg z-50 transition-all hover:scale-110"
      onClick={() => router.push('/chat')}
      aria-label="Open AI Assistant"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}
