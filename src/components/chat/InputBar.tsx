'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';

interface InputBarProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
    mode?: string;
    onModeChange?: (mode: string) => void;
    services?: any;
}

export function InputBar({ onSendMessage, disabled, mode = 'general', onModeChange, services = {} }: InputBarProps) {
    const { t } = useLanguage();
    const [input, setInput] = useState('');

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

    const currentService = services[mode];
    const placeholder = currentService?.name 
        ? `請輸入${currentService.name}相關問題...` 
        : t('input.placeholder');

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
            {mode !== 'general' && currentService && (
                <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-sm text-gray-600">
                        {currentService.name || mode}
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
                    placeholder={placeholder}
                    disabled={disabled}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
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
