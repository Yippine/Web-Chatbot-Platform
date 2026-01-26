'use client';

import { Message as MessageType } from '@/types';
import { cn } from '@/lib/utils';
import { ColorConfig, generateColorStyle } from '@/lib/appearance';

interface MessageProps {
    message: MessageType;
    buttonColor?: ColorConfig;
    textColor?: 'white' | 'black';
}

function formatMessageContent(content: string): string {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline hover:text-orange-600">$1</a>')
        .replace(/\n/g, '<br />');
}

export function Message({ message, buttonColor, textColor = 'white' }: MessageProps) {
    const isBot = message.sender === 'bot';

    const userMessageStyle = buttonColor 
        ? generateColorStyle(buttonColor)
        : { background: 'linear-gradient(to right, #f97316, #a855f7)' };

    return (
        <div className={cn('flex', isBot ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[85%]', isBot ? 'items-start' : 'items-end')}>
                <div
                    className={cn(
                        'px-4 py-3 rounded-2xl whitespace-pre-wrap',
                        isBot
                            ? 'bg-gray-100 text-gray-900 rounded-tl-none'
                            : `rounded-tr-none ${textColor === 'black' ? 'text-black' : 'text-white'}`
                    )}
                    style={isBot ? undefined : userMessageStyle}
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
