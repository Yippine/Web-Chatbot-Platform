'use client';

import { MessageSquare, Navigation, ShoppingBag, Calendar, MapPin, Maximize2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppearanceConfig, generateColorStyle } from '@/lib/appearance';

type ChatMode = string;

interface ChatHeaderProps {
    mode?: ChatMode;
    appearance: AppearanceConfig;
}

export function ChatHeader({ mode = 'general', appearance }: ChatHeaderProps) {
    const [isInIframe, setIsInIframe] = useState(false);

    const modeIcons: Record<string, any> = {
        general: MessageSquare,
        route: Navigation,
        recommend: ShoppingBag,
        events: Calendar,
        event: Calendar,
        floors: MapPin,
        floor: MapPin
    };

    const Icon = modeIcons[mode] || MessageSquare;

    useEffect(() => {
        setIsInIframe(window.self !== window.top);
    }, []);

    const handleExpand = () => {
        window.parent.postMessage({ type: 'EXPAND_CHAT' }, '*');
    };

    const handleClose = () => {
        window.parent.postMessage({ type: 'CLOSE_CHAT' }, '*');
    };

    return (
        <div 
            className="p-4 shadow-md"
            style={{
                ...generateColorStyle(appearance.header),
                color: appearance.textColor === 'black' ? '#000000' : '#ffffff'
            }}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                    {appearance.chatIconUrl ? (
                        <img 
                            src={appearance.chatIconUrl} 
                            alt="Chat Icon" 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Icon className="h-6 w-6" />
                    )}
                </div>
                <div className="flex-1">
                    <h1 className="font-bold text-lg">{appearance.title}</h1>
                    <p className="text-xs opacity-90">{appearance.subtitle}</p>
                </div>
                {isInIframe && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleExpand}
                            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                            aria-label="展開"
                        >
                            <Maximize2 className="h-5 w-5" />
                        </button>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                            aria-label="關閉"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
