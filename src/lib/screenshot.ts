async function loadHtml2Canvas() {
    // html2canvas 官方版不支援 Tailwind v4 預設的 oklch()/lab() 色彩函式，
    // 用維護中的 fork html2canvas-pro（API 相容）避免 "unsupported color function" 錯誤
    const mod = await import('html2canvas-pro');
    return mod.default;
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * 把使用者訊息與機器人訊息兩個泡泡 clone 到畫面外的暫時容器再截圖，
 * 避免每輪都要重繪整個對話捲動容器（成本會隨對話輪數增加）。
 */
export async function captureQaPair(
    userEl: HTMLElement,
    botEl: HTMLElement,
    containerWidth: number
): Promise<Blob | null> {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-99999px';
    wrapper.style.top = '0';
    wrapper.style.width = `${containerWidth}px`;
    wrapper.className = 'bg-white p-4 space-y-4';

    wrapper.appendChild(userEl.cloneNode(true) as HTMLElement);
    wrapper.appendChild(botEl.cloneNode(true) as HTMLElement);
    document.body.appendChild(wrapper);

    try {
        await nextFrame();
        await nextFrame();

        const html2canvas = await loadHtml2Canvas();
        const canvas = await html2canvas(wrapper, {
            backgroundColor: '#ffffff',
            useCORS: true,
            scale: Math.min(window.devicePixelRatio || 1, 2),
            logging: false,
        });

        return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    } finally {
        document.body.removeChild(wrapper);
    }
}
