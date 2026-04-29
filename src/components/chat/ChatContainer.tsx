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

async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
    if (typeof window === 'undefined' || !navigator.geolocation) return null;
    try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        );
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
        return null;
    }
}

function formatReferences(refs: (string | { type: string; title: string; uri: string })[]): string {
    return refs.map(ref => {
        if (typeof ref === 'string') return ref;
        const icon = ref.type === 'maps' ? '📍' : '🔗';
        return ref.uri ? `${icon} ${ref.title}\n   ${ref.uri}` : `${icon} ${ref.title}`;
    }).join('\n');
}

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

    const isRouteService = (mode: string) => services[mode]?.class === 'SmartRouteService';

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
        
        // 只更新歡迎訊息內容，不清除對話歷史
        setMessages(prev => {
            const welcomeMessage: MessageType = {
                id: 'welcome',
                sender: 'bot',
                type: 'text',
                content: appearance.welcomeMessage,
                timestamp: new Date()
            };
            if (prev.length === 0) {
                return [welcomeMessage];
            }
            if (prev[0].id === 'welcome') {
                return [welcomeMessage, ...prev.slice(1)];
            }
            return prev;
        });
    }, [appearance]);

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
            // 第一步: 偵測語言
            setLoadingText(getTranslation(language, 'loading.detectingLanguage'));
            setIsProcessing(true);
            
            let currentLang: Language = 'zh-tw';
            try {
                const langResult = await apiClient.detectLanguage(content, tenantId);
                if (langResult?.detected_language) {
                    const langCode = languageMap[langResult.detected_language.language_name];
                    if (langCode && langCode !== 'zh-tw') {
                        currentLang = langCode;
                        setLanguage(langCode);
                        
                        if (langCode !== language) {
                            setLoadingText(getTranslation(langCode, 'loading.translatingUI'));
                            try {
                                const translatedConfig = await apiClient.getTenantConfig(tenantId, langCode);
                                if (translatedConfig.services) setServices(translatedConfig.services);
                                if (translatedConfig.appearance) setAppearance(translatedConfig.appearance);
                            } catch (e) {
                                console.error('載入翻譯 config 失敗:', e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('語言偵測失敗，使用預設語言:', e);
            }
            
            // 第二步: AI 意圖判斷（UI 翻譯完成後執行）
            let detectedIntent = currentMode;
            if (currentMode === 'general' && Object.keys(services).length > 0) {
                setLoadingText(getTranslation(currentLang, 'loading.analyzing'));
                setIsProcessing(true);
                try {
                    const intentResult = await apiClient.detectIntent(content, tenantId);
                    const validServices = Object.keys(services);
                    detectedIntent = (intentResult?.intent && intentResult.intent !== 'general' && validServices.includes(intentResult.intent))
                        ? intentResult.intent
                        : 'general';
                } catch {
                    detectedIntent = 'general';
                }
            }
            
            setCurrentMode(detectedIntent as ChatMode);
            
            // 第三步: 切換到服務的等待訊息
            const intentServiceConfig = services[detectedIntent];
            const loadingMsg = intentServiceConfig?.loading_message || getTranslation(currentLang, 'loading.general');
            setLoadingText(loadingMsg);
            setIsProcessing(true);
            
            // 取得 GPS（僅 route 服務）
            const latLng = isRouteService(detectedIntent) ? await getLocation() : null;
            
            const result = await apiClient.chat(content, tenantId, conversationHistory.slice(-5), detectedIntent, currentLang !== 'zh-tw' ? currentLang : undefined, latLng ?? undefined);
            
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
                    content: `${t('references')}\n${formatReferences(result.references)}`,
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
                        content: `${t('references')}\n${formatReferences(result.references)}`,
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
                    content: t('error.general'),
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
            
            // 取得 GPS（僅 route 服務）
            const latLng = isRouteService(mode) ? await getLocation() : null;
            
            // 直接使用傳入的 mode
            const result = await apiClient.chat(content, tenantId, conversationHistory.slice(-5), mode, language !== 'zh-tw' ? language : undefined, latLng ?? undefined);
            
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
                    content: `${t('references')}\n${formatReferences(result.references)}`,
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
