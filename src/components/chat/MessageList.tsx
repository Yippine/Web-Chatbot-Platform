'use client';

import { useEffect, useRef } from 'react';
import { Message as MessageType } from '@/types';
import { Message } from './Message';
import { LoadingMessage } from './LoadingMessage';

interface MessageListProps {
    messages: MessageType[];
    isProcessing?: boolean;
    loadingText?: string;
}

export function MessageList({ messages, isProcessing = false, loadingText = '思考中' }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isProcessing]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((message) => (
                <Message key={message.id} message={message} />
            ))}
            {isProcessing && <LoadingMessage text={loadingText} />}
            <div ref={bottomRef} />
        </div>
    );
}
