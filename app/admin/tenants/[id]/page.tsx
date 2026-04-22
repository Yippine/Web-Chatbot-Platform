'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    gemini_api_key: '',
    enabled: true,
  });

  // 翻譯設定
  const AVAILABLE_LANGUAGES = [
    { code: 'en', label: '英文' },
    { code: 'ja', label: '日文' },
    { code: 'ko', label: '韓文' },
    { code: 'vi', label: '越南文' },
    { code: 'id', label: '印尼文' },
    { code: 'th', label: '泰文' },
  ];
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);
  const [translateLog, setTranslateLog] = useState<string[]>([]);
  const [translatedLangs, setTranslatedLangs] = useState<Record<string, { exists: boolean; outdated?: boolean }>>({});

  const loadTranslationStatus = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey || tenantId === 'new') return;
      const client = new AdminAPIClient(apiKey);
      const result = await client.getTranslationStatus(tenantId);
      if (result.translations) setTranslatedLangs(result.translations);
    } catch (e) {
      console.error('載入翻譯狀態失敗:', e);
    }
  };

  const toggleLang = (code: string) => {
    setSelectedLangs(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const getLangButtonStyle = (code: string) => {
    if (selectedLangs.includes(code)) return 'bg-blue-600 text-white';
    const status = translatedLangs[code];
    if (status?.exists && !status?.outdated) return 'bg-green-600 text-white';
    if (status?.exists && status?.outdated) return 'bg-yellow-500 text-white';
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  };

  const getLangBadge = (code: string) => {
    const status = translatedLangs[code];
    if (selectedLangs.includes(code)) return '';
    if (status?.exists && !status?.outdated) return ' ✓';
    if (status?.exists && status?.outdated) return ' ⚠';
    return '';
  };

  const handleGenerateTranslations = async () => {
    if (selectedLangs.length === 0) return;
    setTranslating(true);
    setTranslateProgress(0);
    setTranslateLog([]);

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;
      const client = new AdminAPIClient(apiKey);

      for (let i = 0; i < selectedLangs.length; i++) {
        const lang = selectedLangs[i];
        const langLabel = AVAILABLE_LANGUAGES.find(l => l.code === lang)?.label || lang;
        setTranslateLog(prev => [...prev, `正在生成 ${langLabel} 翻譯...`]);
        
        await client.generateTranslation(tenantId, lang);
        
        const progress = Math.round(((i + 1) / selectedLangs.length) * 100);
        setTranslateProgress(progress);
        setTranslateLog(prev => [...prev, `✅ ${langLabel} 翻譯完成`]);
      }
      setTranslateLog(prev => [...prev, '🎉 所有翻譯生成完成']);
      setSelectedLangs([]);
      await loadTranslationStatus();
    } catch (err: any) {
      setTranslateLog(prev => [...prev, `❌ 翻譯失敗: ${err.message}`]);
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (tenantId !== 'new') {
      loadTenant();
      loadTranslationStatus();
    } else {
      setLoading(false);
    }
  }, [tenantId]);

  const loadTenant = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.getTenant(tenantId);
      setFormData({
        name: data.tenant.name,
        gemini_api_key: data.tenant.gemini_api_key,
        enabled: data.tenant.enabled,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      
      if (tenantId === 'new') {
        // 從表單讀取品牌 ID
        const tenantIdInput = document.getElementById('tenant_id') as HTMLInputElement;
        const newId = tenantIdInput?.value;
        
        if (!newId) {
          setError('請輸入品牌 ID');
          return;
        }
        
        await client.createTenant({
          id: newId,
          ...formData,
          services: {},
          quick_actions: [],
        });
        setSuccess('品牌建立成功');
        setTimeout(() => router.push('/admin/tenants'), 1500);
      } else {
        await client.updateTenant(tenantId, formData);
        setSuccess('品牌更新成功');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除此品牌嗎？此操作無法復原。')) {
      return;
    }

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      await client.deleteTenant(tenantId);
      router.push('/admin/tenants');
    } catch (err: any) {
      setError(err.message);
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
    <div className="max-w-2xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 mb-4"
        >
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {tenantId === 'new' ? '新增品牌' : '編輯品牌'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">基本設定</h2>

        {tenantId === 'new' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              品牌 ID (英文) *
            </label>
            <input
              type="text"
              id="tenant_id"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如: demo, client01, myBrand_01"
              pattern="[a-zA-Z0-9_]+"
              required
            />
            <p className="text-xs text-gray-500 mt-1">僅限英文字母、數字和底線，建立後無法修改</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            品牌名稱
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={formData.gemini_api_key}
              onChange={(e) => setFormData({ ...formData, gemini_api_key: e.target.value })}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
            啟用品牌
          </label>
        </div>

        <div className="flex justify-between pt-4">
          <div>
            {tenantId !== 'new' && (
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                刪除品牌
              </button>
            )}
          </div>
          <div className="space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? '儲存中' : '儲存'}
            </button>
          </div>
        </div>
      </form>

      {/* 翻譯設定 */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-900">翻譯設定</h2>
        <p className="text-sm text-gray-500">選擇要生成的聊天介面翻譯語言<br />（綠底白字，表示已翻譯；黃底白字，表示原始文字有異動，需要重新生成）</p>          
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2 flex-1">
            {AVAILABLE_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLang(lang.code)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${getLangButtonStyle(lang.code)}`}
              >
                {lang.label}{getLangBadge(lang.code)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGenerateTranslations}
            disabled={tenantId === 'new' || translating || selectedLangs.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
          >
            {translating ? '翻譯生成中...' : '生成翻譯'}
          </button>
        </div>
        {tenantId === 'new' && (
          <p className="text-xs text-gray-400 mt-1">請先建立品牌後再生成翻譯</p>
        )}

        {/* 進度條 */}
        {translating && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${translateProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">{translateProgress}%</p>
          </div>
        )}

        {/* 翻譯進度 log */}
        {translateLog.length > 0 && (
          <div className="mt-3 space-y-1">
            {translateLog.map((log, i) => (
              <p key={i} className="text-xs text-gray-400">{log}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
