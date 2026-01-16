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
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-4">
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">服務設定 - {tenantId}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="grid gap-4">
        {Object.entries(services).map(([name, config]: [string, any]) => (
          <div key={name} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                <p className="text-sm text-gray-500">{config.class}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p>溫度: {config.temperature}</p>
                  <p>Grounding: {config.use_grounding ? '啟用' : '停用'}</p>
                  {config.search_keyword && <p>關鍵字: {config.search_keyword}</p>}
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {config.enabled ? '啟用' : '停用'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
