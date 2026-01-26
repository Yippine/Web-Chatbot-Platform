'use client';

import { useState, useEffect } from 'react';
import { Message as MessageType } from '@/types';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { QuickActions } from './QuickActions';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/LanguageContext';
import { languageMap, getTranslation, Language } from '@/lib/i18n';
import { AppearanceConfig } from '@/lib/appearance';

type ChatMode = string;

interface ChatContainerProps {
    tenantId: string;
}

export function ChatContainer({ tenantId }: ChatContainerProps) {
    const { t, setLanguage, language } = useLanguage();
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingText, setLoadingText] = useState(t('loading.general'));
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const [currentMode, setCurrentMode] = useState<ChatMode>('general');
    const [quickActions, setQuickActions] = useState<any[]>([]);
    const [services, setServices] = useState<any>({});
    const [appearance, setAppearance] = useState<AppearanceConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 載入租戶設定
    useEffect(() => {
        const loadTenantConfig = async () => {
            try {
                const config = await apiClient.getTenantConfig(tenantId);
                if (config.quick_actions) {
                    setQuickActions(config.quick_actions);
                }
                if (config.services) {
                    setServices(config.services);
                }
                if (config.appearance) {
                    setAppearance(config.appearance);
                    // 同時設定頁面標題
                    if (config.appearance.pageTitle) {
                        document.title = config.appearance.pageTitle;
                    }
                } else {
                    console.error('租戶缺少外觀設定');
                }
            } catch (error) {
                console.error('載入租戶設定失敗:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadTenantConfig();
    }, [tenantId]);

    useEffect(() => {
        if (!appearance) return;
        
        const welcomeMessage: MessageType = {
            id: 'welcome',
            sender: 'bot',
            type: 'text',
            content: appearance.welcomeMessage,
            timestamp: new Date()
        };
        setMessages([welcomeMessage]);
    }, [appearance]);

    // 當語言切換時,更新 welcome message
    useEffect(() => {
        setMessages(prev => {
            if (prev.length > 0 && prev[0].id === 'welcome') {
                return [{
                    ...prev[0],
                    content: t('welcome.message')
                }, ...prev.slice(1)];
            }
            return prev;
        });
    }, [t]);

    const handleSendMessage = async (content: string) => {
        const userMessage: MessageType = {
            id: `user_${Date.now()}`,
            sender: 'user',
            type: 'text',
            content,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setConversationHistory(prev => [...prev, content]);

        try {
            // 第一步: 偵測語言 (不顯示 loading)
            const languageResult = await apiClient.detectLanguage(content);
            
            // 第二步: 切換語言
            let currentLang: Language = 'zh-tw';
            if (languageResult.detected_language) {
                const langCode = languageMap[languageResult.detected_language.language_name];
                if (langCode) {
                    currentLang = langCode;
                    setLanguage(langCode);
                }
            }
            
            // 第三步: 顯示分析中 (已切換語言)
            setLoadingText(getTranslation(currentLang, 'loading.analyzing'));
            setIsProcessing(true);
            
            // 第四步: 呼叫意圖判斷
            const intentResult = await apiClient.detectIntent(content);
            const detectedIntent = intentResult.intent;
            
            // 第五步: 根據意圖更新等待文字
            const loadingTexts: { [key: string]: string } = {
                route: getTranslation(currentLang, 'loading.route'),
                recommend: getTranslation(currentLang, 'loading.recommend'),
                events: getTranslation(currentLang, 'loading.events'),
                floors: getTranslation(currentLang, 'loading.floors'),
                general: getTranslation(currentLang, 'loading.general')
            };
            
            setCurrentMode(detectedIntent as ChatMode);
            setLoadingText(loadingTexts[detectedIntent] || getTranslation(currentLang, 'loading.general'));
            
            const result = await apiClient.chat(content, tenantId, conversationHistory.slice(-5), detectedIntent);
            
            const botMessage: MessageType = {
                id: `bot_${Date.now()}`,
                sender: 'bot',
                type: 'text',
                content: result.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);

            if (result.references && result.references.length > 0) {
                const refMessage: MessageType = {
                    id: `ref_${Date.now()}`,
                    sender: 'bot',
                    type: 'text',
                    content: `${t('references')}\n${result.references.slice(0, 3).join('\n')}`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, refMessage]);
            }
        } catch (error) {
            console.error('處理訊息失敗:', error);
            const errorMessage: MessageType = {
                id: `error_${Date.now()}`,
                sender: 'bot',
                type: 'text',
                content: t('error.general'),
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleQuickAction = async (action: any) => {
        const serviceId = action.service_id;
        const serviceConfig = services[serviceId];
        
        if (!serviceConfig) return;
        
        // 如果是 QueryService，直接執行查詢
        if (serviceConfig.class === 'QueryService') {
            setCurrentMode(serviceId as ChatMode);
            setIsProcessing(true);
            setLoadingText('查詢資料中...');
            
            try {
                const result = await apiClient.queryData(tenantId, serviceId, language);
                
                const botMessage: MessageType = {
                    id: `bot_${Date.now()}`,
                    sender: 'bot',
                    type: 'text',
                    content: result.response,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, botMessage]);
                
            } catch (error) {
                console.error('查詢失敗:', error);
                const errorMessage: MessageType = {
                    id: `error_${Date.now()}`,
                    sender: 'bot',
                    type: 'text',
                    content: '抱歉，查詢資料時發生錯誤',
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsProcessing(false);
            }
            return;
        }
        
        // 其他服務：檢查是否要顯示模式提示訊息
        if (serviceConfig.show_mode_message !== false && serviceConfig.mode_message) {
            const botMessage: MessageType = {
                id: `mode_${Date.now()}`,
                sender: 'bot',
                type: 'text',
                content: serviceConfig.mode_message,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMessage]);
        }
        
        setCurrentMode(serviceId as ChatMode);
        
        // 如果有 query，發送訊息
        if (action.query) {
            handleSendMessage(action.query);
        }
    };

    // 載入中顯示
    if (isLoading || !appearance) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <ChatHeader 
                mode={currentMode} 
                appearance={appearance}
            />
            <MessageList 
                messages={messages} 
                isProcessing={isProcessing} 
                loadingText={loadingText}
                buttonColor={appearance.button}
                textColor={appearance.textColor}
            />
            {quickActions.length > 0 && <QuickActions actions={quickActions} services={services} onActionClick={handleQuickAction} />}
            <InputBar 
                onSendMessage={handleSendMessage} 
                disabled={isProcessing}
                mode={currentMode}
                onModeChange={setCurrentMode}
                services={services}
                appearance={appearance}
            />
        </div>
    );
}
