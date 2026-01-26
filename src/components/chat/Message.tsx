'use client';

import { Message as MessageType } from '@/types';
import { cn } from '@/lib/utils';

interface MessageProps {
    message: MessageType;
}

function formatMessageContent(content: string): string {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline hover:text-orange-600">$1</a>')
        .replace(/\n/g, '<br />');
}

export function Message({ message }: MessageProps) {
    const isBot = message.sender === 'bot';

    return (
        <div className={cn('flex', isBot ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[85%]', isBot ? 'items-start' : 'items-end')}>
                <div
                    className={cn(
                        'px-4 py-3 rounded-2xl whitespace-pre-wrap',
                        isBot
                            ? 'bg-gray-100 text-gray-900 rounded-tl-none'
                            : 'bg-gradient-to-r from-orange-500 to-purple-500 text-white rounded-tr-none'
                    )}
                >
                    {typeof message.content === 'string' && (
                        <div
                            dangerouslySetInnerHTML={{
                                __html: formatMessageContent(message.content)
                            }}
                        />
                    )}
                </div>

                <div className={cn('text-xs text-gray-500 mt-1 px-2', isBot ? 'text-left' : 'text-right')}>
                    {message.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
}
