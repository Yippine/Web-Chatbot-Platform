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
            // TODO: 語言偵測功能待開發
            // 第一步: 偵測語言 (不顯示 loading)
            // const languageResult = await apiClient.detectLanguage(content);
            
            // 第二步: 切換語言
            // let currentLang: Language = 'zh-tw';
            // if (languageResult.detected_language) {
            //     const langCode = languageMap[languageResult.detected_language.language_name];
            //     if (langCode) {
            //         currentLang = langCode;
            //         setLanguage(langCode);
            //     }
            // }
            
            // 暫時使用預設語言
            const currentLang: Language = 'zh-tw';
            
            // AI 意圖判斷：僅在 general 模式時執行，已指定模式直接使用
            let detectedIntent = currentMode;
            if (currentMode === 'general' && Object.keys(services).length > 0) {
                setLoadingText('問題智慧分析中');
                setIsProcessing(true);
                try {
                    const intentResult = await apiClient.detectIntent(content, tenantId);
                    const validServices = Object.keys(services);
                    detectedIntent = (intentResult.intent && intentResult.intent !== 'general' && validServices.includes(intentResult.intent))
                        ? intentResult.intent
                        : validServices[0];
                } catch {
                    detectedIntent = Object.keys(services)[0];
                }
            }
            
            setCurrentMode(detectedIntent as ChatMode);
            
            // 切換到服務的等待訊息
            const intentServiceConfig = services[detectedIntent];
            const loadingMsg = intentServiceConfig?.loading_message || '處理中...';
            setLoadingText(loadingMsg);
            setIsProcessing(true);
            
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
            const loadingMsg = serviceConfig.query_loading_message;
            setLoadingText(loadingMsg);
            
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
                
                // 顯示參考資料
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
        
        // 如果有 query，發送訊息 (直接傳入 serviceId 而不依賴 currentMode)
        if (action.query) {
            handleSendMessageWithMode(action.query, serviceId);
        }
    };

    // 新增: 帶有指定模式的發送訊息函式
    const handleSendMessageWithMode = async (content: string, mode: string) => {
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
            // 使用服務的自訂等待訊息
            const serviceConfig = services[mode];
            const loadingMsg = serviceConfig?.loading_message;
            console.log('使用等待訊息:', loadingMsg, 'from service:', mode, 'config:', serviceConfig);
            setLoadingText(loadingMsg);
            setIsProcessing(true);
            
            // 直接使用傳入的 mode
            const result = await apiClient.chat(content, tenantId, conversationHistory.slice(-5), mode);
            
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
