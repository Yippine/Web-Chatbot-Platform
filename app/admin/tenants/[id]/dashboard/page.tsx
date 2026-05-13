'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface DailyData {
  date: string;
  messages: number;
  sessions: number;
  avg_ms: number;
}

interface Stats {
  messages_today: number;
  sessions_today: number;
  active_sessions_now: number;
  daily: DailyData[];
  service_distribution: { service_name: string; count: number }[];
  hourly_distribution: { hour: number; count: number }[];
  lang_distribution: { lang: string; count: number }[];
}

export default function TenantDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [stats, setStats] = useState<Stats | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tenantId, days]);

  const loadData = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) { router.push('/admin/login'); return; }
      const client = new AdminAPIClient(apiKey);

      const [tenantRes, statsRes] = await Promise.all([
        client.getTenant(tenantId),
        client.getTenantStats(tenantId, days),
      ]);

      setTenantName(tenantRes.tenant.name || tenantId);
      // 建立 service_id → 中文名稱 的對應
      const svcMap: Record<string, string> = {};
      const services = tenantRes.tenant.services || {};
      for (const [sid, sconfig] of Object.entries(services)) {
        svcMap[sid] = (sconfig as any).name || sid;
      }
      setServiceNames(svcMap);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stats) return <div className="p-8 text-red-500">載入失敗</div>;

  const totalMessages = stats.daily.reduce((s, d) => s + d.messages, 0);
  const totalSessions = stats.daily.reduce((s, d) => s + d.sessions, 0);
  const avgResponseTime = stats.daily.length > 0
    ? Math.round(stats.daily.reduce((s, d) => s + d.avg_ms, 0) / stats.daily.filter(d => d.avg_ms > 0).length || 0)
    : 0;

  // 柱狀圖最大值
  const maxMessages = Math.max(...stats.daily.map(d => d.messages), 1);
  const maxHourly = Math.max(...stats.hourly_distribution.map(d => d.count), 1);

  // 服務分佈總數
  const serviceTotal = stats.service_distribution.reduce((s, d) => s + d.count, 0);

  // 顏色
  const serviceColors = ['#4F46E5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // 語言標籤對應
  const langLabels: Record<string, string> = {
    'zh-TW': '中文', 'en': '英文', 'ja': '日文',
    'ko': '韓文', 'vi': '越南文', 'id': '印尼文', 'th': '泰文',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => router.push(`/admin/tenants/${tenantId}`)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            ← 返回品牌設定
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{tenantName}</h1>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm border">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                days === d ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      {/* 即時指標卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          icon="💬"
          label="今日訊息"
          value={stats.messages_today}
          sub={`近 ${days} 天共 ${totalMessages} 則`}
        />
        <StatCard
          icon="👥"
          label="今日對話數"
          value={stats.sessions_today}
          sub={`近 ${days} 天共 ${totalSessions} 次`}
        />
        <StatCard
          icon="⚡"
          label="即時活躍"
          value={stats.active_sessions_now}
          sub="最近 5 分鐘"
          highlight
        />
        <StatCard
          icon="⏱️"
          label="平均回應時間"
          value={avgResponseTime > 0 ? `${(avgResponseTime / 1000).toFixed(1)}s` : '-'}
          sub={`近 ${days} 天平均`}
        />
      </div>

      {/* 每日趨勢 + 服務佔比 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* 每日訊息量柱狀圖 */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">每日訊息量</h3>
            <span className="text-xs text-[#6C6C6C]">近 {days} 天</span>
          </div>
          <div className="flex items-end gap-1 h-48">
            {stats.daily.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#6C6C6C]">
                  {d.messages > 0 ? d.messages : ''}
                </span>
                <div
                  className="w-full bg-blue-500 rounded-t-md transition-all hover:bg-blue-600"
                  style={{ height: `${(d.messages / maxMessages) * 100}%`, minHeight: d.messages > 0 ? '4px' : '0' }}
                />
                <span className="text-[10px] text-[#6C6C6C] mt-1">
                  {new Date(d.date).getMonth() + 1}/{new Date(d.date).getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 服務使用佔比 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-4">服務使用佔比</h3>
          {stats.service_distribution.length === 0 ? (
            <p className="text-[#6C6C6C] text-sm">尚無數據</p>
          ) : (
            <>
              {/* 簡易圓餅圖 */}
              <div className="flex justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    {(() => {
                      let offset = 0;
                      return stats.service_distribution.map((item, i) => {
                        const pct = (item.count / serviceTotal) * 100;
                        const el = (
                          <circle
                            key={i}
                            cx="18" cy="18" r="14"
                            fill="none"
                            stroke={serviceColors[i % serviceColors.length]}
                            strokeWidth="6"
                            strokeDasharray={`${pct} ${100 - pct}`}
                            strokeDashoffset={-offset}
                          />
                        );
                        offset += pct;
                        return el;
                      });
                    })()}
                  </svg>
                </div>
              </div>
              {/* 圖例 */}
              <div className="space-y-2">
                {stats.service_distribution.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: serviceColors[i % serviceColors.length] }}
                      />
                      <span className="text-gray-600">{serviceNames[item.service_name] || item.service_name}</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {Math.round((item.count / serviceTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 每小時分佈 + 語言分佈 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 每小時分佈 */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-4">每小時訊息分佈</h3>
          <div className="flex items-end gap-[2px] h-36">
            {Array.from({ length: 24 }, (_, h) => {
              const found = stats.hourly_distribution.find(d => d.hour === h);
              const count = found?.count || 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-amber-400 rounded-t-sm transition-all hover:bg-amber-500"
                    style={{ height: `${(count / maxHourly) * 100}%`, minHeight: count > 0 ? '3px' : '0' }}
                  />
                  {h % 3 === 0 && (
                    <span className="text-[9px] text-[#6C6C6C]">{h}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#6C6C6C]">0 時</span>
            <span className="text-[10px] text-[#6C6C6C]">23 時</span>
          </div>
          <div className="text-center mt-2 text-xs text-[#6C6C6C]">
            {new Date().getMonth() + 1}/{new Date().getDate()}
          </div>
        </div>

        {/* 語言分佈 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-4">語言分佈</h3>
          {stats.lang_distribution.length === 0 ? (
            <p className="text-[#6C6C6C] text-sm">尚無數據</p>
          ) : (
            <div className="space-y-3">
              {stats.lang_distribution.map((item, i) => {
                const langTotal = stats.lang_distribution.reduce((s, d) => s + d.count, 0);
                const pct = Math.round((item.count / langTotal) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{langLabels[item.lang] || item.lang}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, highlight }: {
  icon: string;
  label: string;
  value: number | string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-500 text-sm font-medium">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-3xl font-bold mb-1 ${highlight ? 'text-green-600' : 'text-gray-900'}`}>
        {value}
      </div>
      <p className="text-xs text-[#6C6C6C]">{sub}</p>
    </div>
  );
}
