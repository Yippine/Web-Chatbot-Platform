'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function PromptsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.listPrompts(tenantId);
      setPrompts(data.prompts);
      if (data.prompts.length > 0) {
        loadPrompt(data.prompts[0].service);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompt = async (serviceName: string) => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      const data = await client.getPrompt(tenantId, serviceName);
      setSelectedService(serviceName);
      setContent(data.content);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    if (!selectedService) return;
    
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      await client.updatePrompt(tenantId, selectedService, content);
      setSuccess('提示詞更新成功');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>;
  }

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-4">
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">提示詞管理 - {tenantId}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>}

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-4">服務列表</h3>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <button
                key={prompt.service}
                onClick={() => loadPrompt(prompt.service)}
                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                  selectedService === prompt.service
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100'
                }`}
              >
                {prompt.service}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-3 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">{selectedService}</h3>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="輸入提示詞內容..."
          />
        </div>
      </div>
    </div>
  );
}
