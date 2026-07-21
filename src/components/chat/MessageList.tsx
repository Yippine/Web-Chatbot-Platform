'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { Message as MessageType } from '@/types';
import { Message } from './Message';
import { LoadingMessage } from './LoadingMessage';
import { ColorConfig } from '@/lib/appearance';

interface MessageListProps {
    messages: MessageType[];
    isProcessing?: boolean;
    loadingText?: string;
    buttonColor?: ColorConfig;
    textColor?: 'white' | 'black';
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList({
    messages,
    isProcessing = false,
    loadingText = '思考中',
    buttonColor,
    textColor = 'white'
}, ref) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isProcessing]);

    return (
        <div ref={ref} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.map((message) => (
                <Message
                    key={message.id}
                    message={message}
                    buttonColor={buttonColor}
                    textColor={textColor}
                />
            ))}
            {isProcessing && <LoadingMessage text={loadingText} />}
            <div ref={bottomRef} />
        </div>
    );
});
