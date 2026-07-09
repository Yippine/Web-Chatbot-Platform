/**
 * 管理後台 API Client
 */

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5001';

class AdminAPIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${ADMIN_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API 請求失敗');
    }

    return response.json();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  // ==================== 分類管理 ====================

  async listCategories() {
    return this.request<{ categories: { id: string; name: string }[] }>('/api/admin/categories');
  }

  async createCategory(id: string, name: string) {
    return this.request<{ message: string; category: { id: string; name: string } }>(
      '/api/admin/categories',
      {
        method: 'POST',
        body: JSON.stringify({ id, name }),
      }
    );
  }

  async renameCategory(id: string, name: string) {
    return this.request<{ message: string; category: { id: string; name: string } }>(
      `/api/admin/categories/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }
    );
  }

  async deleteCategory(id: string) {
    return this.request<{ message: string }>(`/api/admin/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== 租戶管理 ====================

  async listTenants() {
    return this.request<{ tenants: any[] }>('/api/admin/tenants');
  }

  async getTenant(tenantId: string) {
    return this.request<{ tenant: any }>(`/api/admin/tenants/${tenantId}`);
  }

  async createTenant(data: any) {
    return this.request<{ message: string; tenant: any }>('/api/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(tenantId: string, data: any) {
    return this.request<{ message: string; tenant: any }>(`/api/admin/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTenant(tenantId: string) {
    return this.request<{ message: string }>(`/api/admin/tenants/${tenantId}`, {
      method: 'DELETE',
    });
  }

  // ==================== 服務設定管理 ====================

  async listServices(tenantId: string) {
    return this.request<{ services: any }>(`/api/admin/tenants/${tenantId}/services`);
  }

  async getService(tenantId: string, serviceName: string) {
    return this.request<{ service: any; prompt_content: string }>(
      `/api/admin/tenants/${tenantId}/services/${serviceName}`
    );
  }

  async updateService(tenantId: string, serviceName: string, data: any) {
    return this.request<{ message: string; service: any }>(
      `/api/admin/tenants/${tenantId}/services/${serviceName}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async addService(tenantId: string, data: any) {
    return this.request<{ message: string; service: any }>(`/api/admin/tenants/${tenantId}/services`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteService(tenantId: string, serviceName: string) {
    return this.request<{ message: string }>(`/api/admin/tenants/${tenantId}/services/${serviceName}`, {
      method: 'DELETE',
    });
  }

  // ==================== Quick Actions 管理 ====================

  async getQuickActions(tenantId: string) {
    return this.request<{ quick_actions: any[] }>(`/api/admin/tenants/${tenantId}/quick-actions`);
  }

  async updateQuickActions(tenantId: string, quickActions: any[]) {
    return this.request<{ message: string; quick_actions: any[] }>(
      `/api/admin/tenants/${tenantId}/quick-actions`,
      {
        method: 'PUT',
        body: JSON.stringify({ quick_actions: quickActions }),
      }
    );
  }

  // ==================== LINE 通路設定 ====================

  async getLineConfig(tenantId: string) {
    return this.request<{
      line: {
        enabled: boolean;
        has_token: boolean;
        has_secret: boolean;
      };
      webhook_url: string;
    }>(`/api/admin/tenants/${tenantId}/line`);
  }

  async updateLineConfig(
    tenantId: string,
    data: {
      enabled?: boolean;
      channel_access_token?: string;
      channel_secret?: string;
    }
  ) {
    return this.request<{ message: string; line: any }>(`/api/admin/tenants/${tenantId}/line`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ==================== 服務類別 ====================

  async getServiceClasses() {
    return this.request<{ classes: any[] }>('/api/admin/service-classes');
  }

  // ==================== 外觀設定管理 ====================

  async getAppearance(tenantId: string) {
    return this.request<{ appearance: any }>(`/api/admin/tenants/${tenantId}/appearance`);
  }

  async updateAppearance(tenantId: string, appearance: any) {
    return this.request<{ message: string; appearance: any }>(
      `/api/admin/tenants/${tenantId}/appearance`,
      {
        method: 'PUT',
        body: JSON.stringify(appearance),
      }
    );
  }

  async uploadChatIcon(tenantId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${ADMIN_API_URL}/api/admin/tenants/${tenantId}/appearance/upload-icon`, {
      method: 'POST',
      headers: {
        'X-Admin-Key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '上傳失敗');
    }

    return response.json();
  }

  async getTranslationStatus(tenantId: string) {
    return this.request<{ translations: Record<string, { exists: boolean; outdated?: boolean }> }>(
      `/api/admin/tenants/${tenantId}/translations`
    );
  }

  async generateTranslation(tenantId: string, lang: string) {
    return this.request<{ message: string }>(`/api/admin/tenants/${tenantId}/translations`, {
      method: 'POST',
      body: JSON.stringify({ language: lang }),
    });
  }

  // ==================== 數據統計 ====================

  async getDashboardStats() {
    return this.request<{ total_tenants: number; tenant_stats: any[] }>('/api/admin/stats/dashboard');
  }

  async getTenantStats(tenantId: string, days: number = 7) {
    return this.request<{
      messages_today: number;
      sessions_today: number;
      active_sessions_now: number;
      daily: any[];
      service_distribution: any[];
      hourly_distribution: any[];
      lang_distribution: any[];
    }>(`/api/admin/stats/${tenantId}/daily?days=${days}`);
  }

  // ==================== 驗收報表 ====================

  async getAcceptanceReport(tenantId: string, params?: {
    months?: number;
    pre_decision_min?: number;
    post_manual_min?: number;
    pre_service_per_hour?: number;
    daily_work_hours?: number;
    staff_count?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.set(k, String(v));
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{
      tenant_id: string;
      months: number;
      monthly_summary: any[];
      kpi: {
        decision_time: {
          pre_minutes: number;
          post_minutes: number;
          saved_minutes: number;
          ai_response_minutes: number;
          manual_minutes: number;
        };
        service_efficiency: {
          pre_per_hour: number;
          post_per_hour: number;
          improvement_percent: number;
          total_sessions: number;
          active_days: number;
          daily_work_hours: number;
          staff_count: number;
        };
        performance: {
          avg_response_ms: number;
        };
      };
      params: any;
    }>(`/api/admin/stats/${tenantId}/acceptance${qs}`);
  }

  getExportUrl(tenantId: string, startDate?: string, endDate?: string) {
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return `${ADMIN_API_URL}/api/admin/stats/${tenantId}/export${qs}`;
  }
}

export default AdminAPIClient;
