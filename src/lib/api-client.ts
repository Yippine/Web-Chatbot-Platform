const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// crypto.randomUUID() 只在瀏覽器認定的安全環境（HTTPS 或 localhost）下才存在，
// 嵌入到非 HTTPS 網站或某些內嵌 webview 時會是 undefined，需要備用產生方式
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getUserId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('chatbot_user_id');
  if (!id) {
    id = generateUUID();
    sessionStorage.setItem('chatbot_user_id', id);
  }
  return id;
}

export const apiClient = {
  // 路線規劃
  async planRoute(start?: string, end?: string, context?: string) {
    const res = await fetch(`${API_BASE_URL}/api/route/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end, context })
    });
    return res.json();
  },

  async planMultiRoute(destinations: string[]) {
    const res = await fetch(`${API_BASE_URL}/api/route/multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinations })
    });
    return res.json();
  },

  // 個人化推薦
  async getRecommendations(query: string, history?: string[], profile?: any) {
    const res = await fetch(`${API_BASE_URL}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, history, profile })
    });
    return res.json();
  },

  async getRelatedProducts(product: string) {
    const res = await fetch(`${API_BASE_URL}/api/recommend/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product })
    });
    return res.json();
  },

  async detectLanguage(message: string, tenantId: string) {
    const res = await fetch(`${API_BASE_URL}/api/detect-language`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify({ message })
    });
    return res.json();
  },

  async detectIntent(message: string, tenantId: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat/intent`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify({ message })
    });
    return res.json();
  },

  // 統一聊天接口（多租戶版）
  async chat(message: string, tenantId: string, history?: string[], mode?: string, lang?: string, latLng?: { latitude: number; longitude: number }) {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify({ message, history, mode, user_id: getUserId(), lang, lat_lng: latLng })
    });
    const data = await res.json();
    // 空白訊息調查 log
    if (!res.ok) {
      console.warn('[api-client] 🚨 空白訊息調查: HTTP 非 200', { status: res.status, data });
    }
    if (!data.response || !data.response.trim()) {
      console.warn('[api-client] 🚨 空白訊息調查: response 為空或空白', { status: res.status, data, message, mode });
    }
    return data;
  },

  // 上傳一輪問答的截圖
  async uploadScreenshot(tenantId: string, params: { userMessageId: string; botMessageId: string; blob: Blob }) {
    const formData = new FormData();
    formData.append('file', params.blob, 'screenshot.png');
    formData.append('session_id', getUserId());
    formData.append('user_message_id', params.userMessageId);
    formData.append('bot_message_id', params.botMessageId);

    const res = await fetch(`${API_BASE_URL}/api/screenshots`, {
      method: 'POST',
      headers: {
        'X-Tenant-ID': tenantId
      },
      body: formData
    });
    return res.json();
  },

  // 取得租戶設定
  async getTenantConfig(tenantId: string, lang?: string) {
    const params = lang ? `?lang=${lang}` : '';
    const res = await fetch(`${API_BASE_URL}/api/tenant/config${params}`, {
      method: 'GET',
      headers: {
        'X-Tenant-ID': tenantId
      }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || '租戶設定載入失敗');
    }
    return data;
  },

  // 查詢資料 (QueryService 專用)
  async queryData(tenantId: string, serviceName: string, lang?: string) {
    const params = new URLSearchParams({ service: serviceName });
    if (lang) params.append('lang', lang);
    
    const res = await fetch(`${API_BASE_URL}/api/query/data?${params}`, {
      method: 'GET',
      headers: { 
        'X-Tenant-ID': tenantId
      }
    });
    return res.json();
  }
};
