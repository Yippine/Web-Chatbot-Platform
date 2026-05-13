'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function StatsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const apiKey = localStorage.getItem('admin_api_key');
        if (!apiKey) { router.push('/admin/login'); return; }
        const client = new AdminAPIClient(apiKey);
        const data = await client.getDashboardStats();
        setTenants(data.tenant_stats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">品牌數據</h1>
      <p className="text-gray-500 mb-6">選擇品牌查看詳細數據分析</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <button
            key={t.id}
            onClick={() => router.push(`/admin/tenants/${t.id}/dashboard`)}
            className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md hover:border-blue-200 transition text-left"
          >
            <h3 className="font-semibold text-gray-900 mb-2">{t.name}</h3>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>今日訊息 <strong className="text-gray-900">{t.messages_today}</strong></span>
              <span>對話數 <strong className="text-gray-900">{t.sessions_today}</strong></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
