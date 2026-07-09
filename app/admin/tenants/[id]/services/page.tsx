'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function ServicesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  
  const [services, setServices] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.listServices(tenantId);
      setServices(data.services);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-4">
            ← 返回
          </button>
          <h1 className="text-3xl font-bold text-gray-900">服務設定 - {tenantId}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/admin/tenants/${tenantId}/quick-actions`)}
            className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-50 transition"
          >
            快速按鈕管理
          </button>
          <button
            onClick={() => router.push(`/admin/tenants/${tenantId}/services/new`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            新增服務
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="grid gap-4">
        {Object.entries(services).map(([name, config]: [string, any]) => (
          <div key={name} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {config.name || name}
                  </h3>
                  <span className="text-xs text-gray-500 font-mono">({name})</span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {config.enabled ? '啟用' : '停用'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{config.class}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Temperature:</span>
                    <span className="ml-2 font-medium">{config.temperature}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Grounding:</span>
                    <span className="ml-2 font-medium">{config.use_grounding ? '啟用' : '停用'}</span>
                  </div>
                  {config.search_keyword && (
                    <div>
                      <span className="text-gray-600">關鍵字:</span>
                      <span className="ml-2 font-medium">{config.search_keyword}</span>
                    </div>
                  )}
                  {config.prompt_file && (
                    <div className="col-span-2">
                      <span className="text-gray-600">提示詞:</span>
                      <span className="ml-2 font-medium text-xs">{config.prompt_file}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => router.push(`/admin/tenants/${tenantId}/services/${name}`)}
                className="ml-4 text-blue-600 hover:text-blue-900 font-medium"
              >
                編輯
              </button>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(services).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          尚無服務，請新增第一個服務
        </div>
      )}
    </div>
  );
}
