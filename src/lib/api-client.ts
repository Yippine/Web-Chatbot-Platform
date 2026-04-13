const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function getUserId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('chatbot_user_id');
  if (!id) {
    id = crypto.randomUUID();
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
  async chat(message: string, tenantId: string, history?: string[], mode?: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify({ message, history, mode, user_id: getUserId() })
    });
    return res.json();
  },

  // 偵測語言
  async detectLanguage(message: string) {
    const res = await fetch(`${API_BASE_URL}/api/detect-language`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return res.json();
  },

  // 取得租戶設定
  async getTenantConfig(tenantId: string) {
    const res = await fetch(`${API_BASE_URL}/api/tenant/config`, {
      method: 'GET',
      headers: { 
        'X-Tenant-ID': tenantId
      }
    });
    return res.json();
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
