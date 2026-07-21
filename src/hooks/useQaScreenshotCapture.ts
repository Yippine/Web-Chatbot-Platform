'use client';

import { useEffect, useRef, RefObject } from 'react';
import { Message as MessageType } from '@/types';
import { captureQaPair } from '@/lib/screenshot';
import { apiClient } from '@/lib/api-client';

/**
 * 每當「使用者訊息 → 機器人訊息」這樣的一輪問答完成，
 * 自動截圖並上傳。截圖/上傳失敗絕不能影響聊天功能本身。
 */
export function useQaScreenshotCapture(
    messages: MessageType[],
    tenantId: string,
    isProcessing: boolean,
    containerRef: RefObject<HTMLDivElement | null>
) {
    const capturedBotIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        const last = messages[messages.length - 1];
        const secondLast = messages[messages.length - 2];
        console.warn('[useQaScreenshotCapture] effect 執行', {
            length: messages.length,
            isProcessing,
            lastSender: last?.sender,
            lastId: last?.id,
            secondLastSender: secondLast?.sender,
            secondLastId: secondLast?.id,
        });

        if (isProcessing) return;
        if (messages.length < 2) return;

        const botMessage = messages[messages.length - 1];
        const userMessage = messages[messages.length - 2];

        if (botMessage.sender !== 'bot') return;
        if (userMessage.sender !== 'user') return;
        if (capturedBotIds.current.has(botMessage.id)) {
            console.warn('[useQaScreenshotCapture] 這則 bot 訊息已經截過了', botMessage.id);
            return;
        }

        const container = containerRef.current;
        if (!container) {
            console.warn('[useQaScreenshotCapture] 找不到訊息容器 ref，略過這次截圖', botMessage.id);
            return;
        }

        const userEl = container.querySelector<HTMLElement>(`[data-message-id="${userMessage.id}"]`);
        const botEl = container.querySelector<HTMLElement>(`[data-message-id="${botMessage.id}"]`);
        if (!userEl || !botEl) {
            console.warn('[useQaScreenshotCapture] 找不到訊息 DOM 節點，略過這次截圖', {
                userMessageId: userMessage.id, botMessageId: botMessage.id, foundUserEl: !!userEl, foundBotEl: !!botEl,
            });
            return;
        }

        // 確認拿得到 DOM 節點後才標記為已截過，避免因一次性找不到節點就永久跳過
        capturedBotIds.current.add(botMessage.id);

        (async () => {
            try {
                console.debug('[useQaScreenshotCapture] 開始截圖', botMessage.id);
                const blob = await captureQaPair(userEl, botEl, container.clientWidth);
                if (!blob) {
                    console.warn('[useQaScreenshotCapture] html2canvas 沒有產生圖片', botMessage.id);
                    return;
                }
                const res = await apiClient.uploadScreenshot(tenantId, {
                    userMessageId: userMessage.id,
                    botMessageId: botMessage.id,
                    blob,
                });
                console.debug('[useQaScreenshotCapture] 上傳完成', res);
            } catch (error) {
                console.warn('[useQaScreenshotCapture] 截圖或上傳失敗:', error);
            }
        })();
    }, [messages, isProcessing, tenantId, containerRef]);
}
