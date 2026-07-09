'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface QuickAction {
  service_id: string;
  query: string;
}

export default function QuickActionsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [services, setServices] = useState<Record<string, any>>({});
  const [newServiceId, setNewServiceId] = useState('');
  const [newQuery, setNewQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
  }, [tenantId]);

  const load = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }
      const client = new AdminAPIClient(apiKey);
      const [qaData, servicesData] = await Promise.all([
        client.getQuickActions(tenantId),
        client.listServices(tenantId),
      ]);
      setQuickActions(qaData.quick_actions || []);
      setServices(servicesData.services || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const serviceLabel = (serviceId: string) => {
    const svc = services[serviceId];
    if (!svc) return `⚠️ ${serviceId}（服務已刪除）`;
    return `${svc.icon || '⚙️'} ${svc.name || serviceId}`;
  };

  const handleAdd = () => {
    setError('');
    if (!newServiceId) {
      setError('請選擇要新增的服務');
      return;
    }
    setQuickActions((prev) => [...prev, { service_id: newServiceId, query: newQuery }]);
    setNewServiceId('');
    setNewQuery('');
  };

  const handleRemove = (index: number) => {
    if (!confirm('確定要刪除這顆快速按鈕嗎？')) return;
    setQuickActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    setQuickActions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleQueryChange = (index: number, value: string) => {
    setQuickActions((prev) => prev.map((qa, i) => (i === index ? { ...qa, query: value } : qa)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;
      const client = new AdminAPIClient(apiKey);
      await client.updateQuickActions(tenantId, quickActions);
      setSuccess('快速按鈕已儲存');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const serviceEntries = Object.entries(services);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-4">
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">快速按鈕管理 - {tenantId}</h1>
        <p className="text-gray-600 mt-2">
          設定前台聊天視窗下方出現的快捷按鈕，點擊後可切換服務、顯示招呼訊息，並可選擇自動送出一句預設提問。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>
      )}

      {/* 現有清單 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">目前的快速按鈕</h2>

        {quickActions.length === 0 && (
          <p className="text-gray-500 text-sm">尚無快速按鈕，前台聊天視窗不會顯示按鈕列。</p>
        )}

        <div className="space-y-3">
          {quickActions.map((qa, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{serviceLabel(qa.service_id)}</span>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↑ 上移
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === quickActions.length - 1}
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↓ 下移
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    刪除
                  </button>
                </div>
              </div>
              <label className="block text-xs text-gray-500 mb-1">
                自動送出的預設提問（留空＝只顯示招呼訊息，等使用者自己打字）
              </label>
              <input
                type="text"
                value={qa.query}
                onChange={(e) => handleQueryChange(index, e.target.value)}
                placeholder="例如：我想了解你們的工業相機"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 新增 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">新增快速按鈕</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={newServiceId}
            onChange={(e) => setNewServiceId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">請選擇服務</option>
            {serviceEntries.map(([id, svc]) => (
              <option key={id} value={id}>
                {svc.icon || '⚙️'} {svc.name || id}（{id}）{!svc.enabled ? '－已停用' : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            placeholder="自動提問文字（可留空）"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
          >
            + 加入清單
          </button>
        </div>
        {serviceEntries.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">這個品牌還沒有任何服務，請先到「服務」頁面新增服務。</p>
        )}
        <p className="text-xs text-gray-400 mt-2">同一個服務可以重複加入多次，各自帶不同的預設提問。已停用的服務仍可加入按鈕，且該按鈕在前台一樣會顯示並可點擊——若不希望使用者看到，請先到「服務」頁面關閉啟用，或直接刪除這裡的按鈕。</p>
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? '儲存中' : '儲存'}
        </button>
      </div>
    </div>
  );
}
