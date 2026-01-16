'use client';

import { ChatContainer } from '@/components/chat/ChatContainer';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ChatPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenant_id') || 'demo';

  return <ChatContainer tenantId={tenantId} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div>載入中...</div>}>
      <ChatPage />
    </Suspense>
  );
}
