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

interface DayItem {
  day: string;
  screenshot_count: number;
  person_count: number;
}

type Tab = 'person' | 'day';

const PAGE_SIZE = 24;

export default function TenantScreenshotIndexPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tab, setTab] = useState<Tab>('person');
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [days, setDays] = useState<DayItem[]>([]);
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
  }, [tenantId, tab, page]);

  // 切換分頁模式時重置頁碼，避免帶著另一種模式的頁碼查詢
  useEffect(() => {
    setPage(1);
  }, [tab]);

  const loadData = async (apiKey: string) => {
    setLoading(true);
    try {
      const client = new AdminAPIClient(apiKey);
      if (tab === 'person') {
        const res = await client.getScreenshotPeople(tenantId, page, PAGE_SIZE);
        setPeople(res.items);
        setTotal(res.total);
      } else {
        const res = await client.getScreenshotDays(tenantId, page, PAGE_SIZE);
        setDays(res.items);
        setTotal(res.total);
      }
    } catch (e) {
      console.error('載入對話截圖記錄失敗:', e);
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
        <p className="text-sm text-gray-500 mt-1">
          {tab === 'person' ? `共 ${total} 位使用者留有對話紀錄` : `共 ${total} 天有對話紀錄`}
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('person')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === 'person' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
          }`}
        >
          依人
        </button>
        <button
          onClick={() => setTab('day')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            tab === 'day' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
          }`}
        >
          依天
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : tab === 'person' ? (
          people.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">尚無截圖記錄</p>
          ) : (
            <div className="divide-y">
              {people.map((item) => (
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
          )
        ) : days.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">尚無截圖記錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4 font-medium">日期</th>
                  <th className="py-2 pr-4 font-medium">問答則數</th>
                  <th className="py-2 pr-4 font-medium">使用人數</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {days.map((item) => (
                  <tr
                    key={item.day}
                    onClick={() => router.push(`/admin/tenants/${tenantId}/screenshots/by-day/${item.day}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900">{item.day}</td>
                    <td className="py-3 pr-4">
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                        {item.screenshot_count} 則
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{item.person_count} 人</td>
                    <td className="py-3 text-gray-300 text-right">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
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
      </div>
    </div>
  );
}
