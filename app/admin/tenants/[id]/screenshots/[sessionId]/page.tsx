'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface ScreenshotItem {
  id: number;
  session_id: string;
  file_size: number;
  created_at: string;
}

const PAGE_SIZE = 24;

export default function TenantPersonScreenshotsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const sessionId = decodeURIComponent(params.sessionId as string);

  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ id: number; createdAt: string } | null>(null);

  useEffect(() => {
    const apiKey = localStorage.getItem('admin_api_key');
    if (!apiKey) {
      router.push('/admin/login');
      return;
    }
    loadData(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, sessionId, page]);

  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (apiKey: string) => {
    setLoading(true);
    try {
      const client = new AdminAPIClient(apiKey);
      const res = await client.getScreenshotsForPerson(tenantId, sessionId, page, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);

      const entries = await Promise.all(
        res.items.map(async (item) => {
          const url = client.getScreenshotFileUrl(tenantId, sessionId, item.id);
          const response = await fetch(url, { headers: { 'X-Admin-Key': apiKey } });
          if (!response.ok) return null;
          const blob = await response.blob();
          return [item.id, URL.createObjectURL(blob)] as const;
        })
      );

      setThumbUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        const next: Record<number, string> = {};
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    } catch (e) {
      console.error('載入截圖失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mb-8">
        <button
          onClick={() => router.push(`/admin/tenants/${tenantId}/screenshots`)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1"
        >
          ← 返回名單
        </button>
        <h1 className="text-2xl font-bold text-gray-900 font-mono break-all">{sessionId}</h1>
        <p className="text-sm text-gray-500 mt-1">共 {total} 則問答（依對話發生順序排列）</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPreview({ id: item.id, createdAt: item.created_at })}
                  className="text-left group"
                >
                  <div className="aspect-video rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center">
                    {thumbUrls[item.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrls[item.id]}
                        alt={`screenshot-${item.id}`}
                        className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">無法載入</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {new Date(item.created_at).toLocaleString('zh-TW')}
                  </p>
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

      {preview && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-3xl w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrls[preview.id]}
              alt={`screenshot-${preview.id}`}
              className="w-full rounded-xl border bg-white"
            />
            <p className="text-center text-white text-sm mt-3">
              {new Date(preview.createdAt).toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
