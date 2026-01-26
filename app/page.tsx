'use client';

import { ChatContainer } from '@/components/chat/ChatContainer';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ChatPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenant_id') || 'demo';

  return <ChatContainer tenantId={tenantId} />;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatPage />
    </Suspense>
  );
}
