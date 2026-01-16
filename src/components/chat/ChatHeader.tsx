'use client';

import { MessageSquare, Navigation, ShoppingBag, Calendar, MapPin, Maximize2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ChatMode = 'general' | 'route' | 'recommend' | 'events' | 'floors';

interface ChatHeaderProps {
    mode?: ChatMode;
}

export function ChatHeader({ mode = 'general' }: ChatHeaderProps) {
    const [isInIframe, setIsInIframe] = useState(false);

    const modeIcons = {
        general: MessageSquare,
        route: Navigation,
        recommend: ShoppingBag,
        events: Calendar,
        floors: MapPin
    };

    const Icon = modeIcons[mode];

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
        <div className="bg-gradient-to-r from-orange-500 via-yellow-500 to-purple-500 text-white p-4 shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h1 className="font-bold text-lg">Wi帶你逛 - 智慧導購</h1>
                    <p className="text-xs opacity-90">Syntrend AI Assistant</p>
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
