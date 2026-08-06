'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface PersonItem {
  session_id: string;
  screenshot_count: number;
  first_seen: string;
  last_seen: string;
}

const PAGE_SIZE = 24;

export default function TenantScreenshotPeoplePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [items, setItems] = useState<PersonItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiKey = localStorage.getItem('admin_api_key');
    if (!apiKey) {
      router.push('/admin/login');
      return;
    }
    loadData(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, page]);

  const loadData = async (apiKey: string) => {
    setLoading(true);
    try {
      const client = new AdminAPIClient(apiKey);
      const res = await client.getScreenshotPeople(tenantId, page, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error('載入對話截圖名單失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/admin/tenants/${tenantId}`)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1"
        >
          ← 返回品牌設定
        </button>
        <h1 className="text-2xl font-bold text-gray-900">對話截圖記錄</h1>
        <p className="text-sm text-gray-500 mt-1">共 {total} 位使用者留有對話紀錄</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">尚無截圖記錄</p>
        ) : (
          <>
            <div className="divide-y">
              {items.map((item) => (
                <button
                  key={item.session_id}
                  onClick={() =>
                    router.push(
                      `/admin/tenants/${tenantId}/screenshots/${encodeURIComponent(item.session_id)}`
                    )
                  }
                  className="w-full flex items-center justify-between gap-4 py-4 text-left hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate font-mono">
                      {item.session_id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      最後對話：{new Date(item.last_seen).toLocaleString('zh-TW')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                      {item.screenshot_count} 則問答
                    </span>
                    <span className="text-gray-300">→</span>
                  </div>
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-full text-sm font-medium border disabled:opacity-40 hover:bg-gray-100"
                >
                  上一頁
                </button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded-full text-sm font-medium border disabled:opacity-40 hover:bg-gray-100"
                >
                  下一頁
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
