'use client';

import { useState } from 'react';
import { Send, Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { floors } from '@/data/floors';
import { useLanguage } from '@/contexts/LanguageContext';

type ChatMode = 'general' | 'route' | 'recommend' | 'events' | 'floors';

interface InputBarProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
    mode?: ChatMode;
    onModeChange?: (mode: ChatMode) => void;
}

export function InputBar({ onSendMessage, disabled, mode = 'general', onModeChange }: InputBarProps) {
    const { t } = useLanguage();
    const [input, setInput] = useState('');

    const placeholders = {
        general: t('input.placeholder'),
        route: t('input.placeholderRoute'),
        recommend: t('input.placeholderRecommend'),
        floors: t('input.placeholderFloors'),
        events: t('input.placeholderEvents')
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleExitMode = () => {
        if (onModeChange) {
            onModeChange('general');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
            {mode !== 'general' && (
                <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-sm text-gray-600">
                        {mode === 'route' && t('quickActions.route')}
                        {mode === 'recommend' && t('quickActions.recommend')}
                        {mode === 'floors' && t('quickActions.floors')}
                        {mode === 'events' && t('quickActions.events')}
                    </span>
                    <button
                        type="button"
                        onClick={handleExitMode}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                        <X className="h-3 w-3" />
                        {t('input.exitMode')}
                    </button>
                </div>
            )}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholders[mode]}
                    disabled={disabled}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {/* 語音功能暫時隱藏
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    disabled={disabled}
                >
                    <Mic className="h-5 w-5" />
                </Button>
                */}
                <Button
                    type="submit"
                    size="icon"
                    className="rounded-full"
                    disabled={disabled || !input.trim()}
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </form>
    );
}
