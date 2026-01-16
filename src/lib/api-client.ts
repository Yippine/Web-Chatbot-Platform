const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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

  async analyzeIntent(conversation: string[]) {
    const res = await fetch(`${API_BASE_URL}/api/analyze/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation })
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
      body: JSON.stringify({ message, history, mode })
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

  // 快速判斷意圖
  async detectIntent(message: string) {
    const res = await fetch(`${API_BASE_URL}/api/chat/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return res.json();
  }
};
