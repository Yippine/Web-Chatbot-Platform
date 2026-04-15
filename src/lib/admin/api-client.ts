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
}

export default AdminAPIClient;
