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
  const [acceptance, setAcceptance] = useState<any>(null);
  const [acceptanceParams, setAcceptanceParams] = useState({
    pre_decision_min: 90,
    post_manual_min: 25,
    pre_service_per_hour: 1,
    daily_work_hours: 8,
    staff_count: 1,
    months: 4,
  });

  useEffect(() => {
    loadData();
    loadAcceptance();
  }, [tenantId, days]);

  useEffect(() => {
    loadAcceptance();
  }, [acceptanceParams]);

  const loadAcceptance = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;
      const client = new AdminAPIClient(apiKey);
      const res = await client.getAcceptanceReport(tenantId, acceptanceParams);
      setAcceptance(res);
    } catch (e) {
      console.error('驗收報表載入失敗:', e);
    }
  };

  const handleExportCSV = () => {
    const apiKey = localStorage.getItem('admin_api_key');
    if (!apiKey) return;
    const client = new AdminAPIClient(apiKey);
    const url = client.getExportUrl(tenantId);
    // 用 fetch 帶 header 下載
    fetch(url, { headers: { 'X-Admin-Key': apiKey } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${tenantId}_usage_report.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

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

      {/* ==================== 驗收報表區塊 ==================== */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">📋 專案驗收報表</h2>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
          >
            📥 匯出 CSV（近 4 個月）
          </button>
        </div>

        {!acceptance ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border text-center text-gray-400">
            <p className="text-lg mb-2">尚無使用數據</p>
            <p className="text-sm">開始使用聊天機器人後，驗收指標將自動計算</p>
          </div>
        ) : (
          <>
            {/* KPI 指標卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              {/* 縮短決策時間 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⏱️</span>
                  <h3 className="font-semibold text-gray-900">縮短決策時間</h3>
                </div>
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-blue-600">
                    {acceptance.kpi.decision_time.saved_minutes}
                  </span>
                  <span className="text-lg text-gray-500 ml-1">分鐘</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">導入前決策時間</span>
                    <span className="font-medium">{acceptance.kpi.decision_time.pre_minutes} 分鐘</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">導入後決策時間</span>
                    <span className="font-medium">{acceptance.kpi.decision_time.post_minutes} 分鐘</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 pt-1 border-t">
                    <span>其中 AI 回應</span>
                    <span>{acceptance.kpi.decision_time.ai_response_minutes} 分鐘</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>人工處理</span>
                    <span>{acceptance.kpi.decision_time.manual_minutes} 分鐘</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  公式：{acceptance.kpi.decision_time.pre_minutes}min − {acceptance.kpi.decision_time.post_minutes}min = {acceptance.kpi.decision_time.saved_minutes}min
                </p>
              </div>

              {/* 服務效率提升 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📈</span>
                  <h3 className="font-semibold text-gray-900">服務效率提升</h3>
                </div>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${acceptance.kpi.service_efficiency.improvement_percent > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {acceptance.kpi.service_efficiency.improvement_percent > 0 ? '+' : ''}
                    {acceptance.kpi.service_efficiency.improvement_percent}%
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">導入前（每小時服務人數）</span>
                    <span className="font-medium">{acceptance.kpi.service_efficiency.pre_per_hour} 位</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">導入後（每小時服務人數）</span>
                    <span className="font-medium">{acceptance.kpi.service_efficiency.post_per_hour} 位</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 pt-1 border-t">
                    <span>總對話數</span>
                    <span>{acceptance.kpi.service_efficiency.total_sessions} 次</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>活躍天數</span>
                    <span>{acceptance.kpi.service_efficiency.active_days} 天</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  公式：({acceptance.kpi.service_efficiency.post_per_hour} − {acceptance.kpi.service_efficiency.pre_per_hour}) / {acceptance.kpi.service_efficiency.pre_per_hour} × 100%
                </p>
              </div>
            </div>

            {/* 月度彙總表格 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">月度使用彙總</h3>
              {acceptance.monthly_summary.length === 0 ? (
                <p className="text-gray-400 text-sm">尚無月度數據</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 pr-4">月份</th>
                        <th className="pb-2 pr-4">AI 回覆數</th>
                        <th className="pb-2 pr-4">使用者訊息</th>
                        <th className="pb-2 pr-4">對話數</th>
                        <th className="pb-2 pr-4">平均回應(ms)</th>
                        <th className="pb-2 pr-4">P95 回應(ms)</th>
                        <th className="pb-2">活躍天數</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acceptance.monthly_summary.map((m: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{m.month}</td>
                          <td className="py-2 pr-4">{m.bot_messages}</td>
                          <td className="py-2 pr-4">{m.user_messages}</td>
                          <td className="py-2 pr-4">{m.sessions}</td>
                          <td className="py-2 pr-4">{m.avg_response_ms}</td>
                          <td className="py-2 pr-4">{m.p95_response_ms}</td>
                          <td className="py-2">{m.active_days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* 參數設定（永遠顯示） */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="font-semibold text-gray-900 mb-4">⚙️ 驗收參數設定</h3>
          <p className="text-xs text-gray-400 mb-4">調整基準值後 KPI 會即時重新計算</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">導入前決策時間(分)</label>
              <input
                type="number"
                value={acceptanceParams.pre_decision_min}
                onChange={e => setAcceptanceParams(p => ({ ...p, pre_decision_min: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">導入後人工處理(分)</label>
              <input
                type="number"
                value={acceptanceParams.post_manual_min}
                onChange={e => setAcceptanceParams(p => ({ ...p, post_manual_min: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">導入前服務人數/hr</label>
              <input
                type="number"
                value={acceptanceParams.pre_service_per_hour}
                onChange={e => setAcceptanceParams(p => ({ ...p, pre_service_per_hour: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">每日營業時數</label>
              <input
                type="number"
                value={acceptanceParams.daily_work_hours}
                onChange={e => setAcceptanceParams(p => ({ ...p, daily_work_hours: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">服務人員數</label>
              <input
                type="number"
                value={acceptanceParams.staff_count}
                onChange={e => setAcceptanceParams(p => ({ ...p, staff_count: +e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
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
