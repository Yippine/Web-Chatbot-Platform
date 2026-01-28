'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    gemini_api_key: '',
    enabled: true,
  });

  useEffect(() => {
    if (tenantId !== 'new') {
      loadTenant();
    } else {
      setLoading(false);
    }
  }, [tenantId]);

  const loadTenant = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.getTenant(tenantId);
      setFormData({
        name: data.tenant.name,
        gemini_api_key: data.tenant.gemini_api_key,
        enabled: data.tenant.enabled,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      
      if (tenantId === 'new') {
        const newId = formData.name.toLowerCase().replace(/\s+/g, '_');
        await client.createTenant({
          id: newId,
          ...formData,
          services: {},
          quick_actions: [],
        });
        setSuccess('租戶建立成功');
        setTimeout(() => router.push('/admin/tenants'), 1500);
      } else {
        await client.updateTenant(tenantId, formData);
        setSuccess('租戶更新成功');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除此租戶嗎？此操作無法復原。')) {
      return;
    }

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      await client.deleteTenant(tenantId);
      router.push('/admin/tenants');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 mb-4"
        >
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {tenantId === 'new' ? '新增租戶' : '編輯租戶'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            租戶名稱
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key
          </label>
          <input
            type="password"
            value={formData.gemini_api_key}
            onChange={(e) => setFormData({ ...formData, gemini_api_key: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
            啟用租戶
          </label>
        </div>

        <div className="flex justify-between pt-4">
          <div>
            {tenantId !== 'new' && (
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                刪除租戶
              </button>
            )}
          </div>
          <div className="space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? '儲存中' : '儲存'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
