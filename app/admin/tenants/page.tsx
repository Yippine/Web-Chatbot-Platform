'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface Tenant {
  id: string;
  name: string;
  enabled: boolean;
  services_count: number;
}

function EmbedCodeBlock({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<'script' | 'gtm'>('script');
  const [copied, setCopied] = useState(false);
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;

  const scriptCode = `<script src="${frontendUrl}/api/chat-widget?tenant_id=${tenantId}"></script>`;
  const gtmCode = `<script>
(function() {
  var s = document.createElement('script');
  s.src = '${frontendUrl}/api/chat-widget?tenant_id=${tenantId}';
  s.async = true;
  document.head.appendChild(s);
})();
</script>`;

  const currentCode = tab === 'script' ? scriptCode : gtmCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab('script')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition ${
            tab === 'script' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          一般嵌入
        </button>
        <button
          onClick={() => setTab('gtm')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition ${
            tab === 'gtm' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          GTM 嵌入
        </button>
      </div>
      <div className="relative">
        <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
          {currentCode}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
        >
          {copied ? '✓ 已複製' : '複製'}
        </button>
      </div>
      {tab === 'gtm' && (
        <p className="mt-2 text-xs text-gray-500">
          在 GTM 中新增「自訂 HTML」標籤，貼上以上程式碼，觸發條件設為「All Pages」
        </p>
      )}
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.listTenants();
      setTenants(data.tenants);
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('未授權')) {
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">品牌管理</h1>
        <button
          onClick={() => router.push('/admin/tenants/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          新增品牌
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                品牌 ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                名稱
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                服務數量
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tenants.map((tenant) => (
              <React.Fragment key={tenant.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tenant.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {tenant.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        tenant.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tenant.enabled ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {tenant.services_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button
                      onClick={() => setExpandedTenant(expandedTenant === tenant.id ? null : tenant.id)}
                      className="text-orange-600 hover:text-orange-900"
                    >
                      嵌入碼
                    </button>
                    <a
                      href={`/chat?tenant_id=${tenant.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      開啟聊天
                    </a>
                    <button
                      onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => router.push(`/admin/tenants/${tenant.id}/services`)}
                      className="text-green-600 hover:text-green-900"
                    >
                      服務
                    </button>
                    <button
                      onClick={() => router.push(`/admin/tenants/${tenant.id}/appearance`)}
                      className="text-purple-600 hover:text-purple-900"
                    >
                      外觀
                    </button>
                    <button
                      onClick={() => router.push(`/admin/tenants/${tenant.id}/line`)}
                      className="text-green-700 hover:text-green-900"
                    >
                      LINE
                    </button>
                  </td>
                </tr>
                {expandedTenant === tenant.id && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmbedCodeBlock tenantId={tenant.id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {tenants.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            尚無品牌，請新增第一個品牌
          </div>
        )}
      </div>
    </div>
  );
}
