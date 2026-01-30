'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function ServiceEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const serviceName = params.service as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [serviceClasses, setServiceClasses] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    icon: '⚙️',
    enabled: true,
    class: 'ChatService',
    prompt_file: '',
    temperature: 0.7,
    use_grounding: true,
    search_keyword: '',
    allowed_domains: '',
    prompt_content: '',
    mode_message: '',
    show_mode_message: false,
    loading_message: '處理中',
    query_loading_message: '查詢資料中'
  });

  useEffect(() => {
    loadServiceClasses();
    if (serviceName !== 'new') {
      loadService();
    } else {
      setLoading(false);
    }
  }, [serviceName]);

  const loadServiceClasses = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      const data = await client.getServiceClasses();
      setServiceClasses(data.classes);
    } catch (err: any) {
      console.error('載入服務類別失敗:', err);
    }
  };

  const loadService = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.getService(tenantId, serviceName);
      
      setFormData({
        name: data.service.name || '',
        icon: data.service.icon || '⚙️',
        enabled: data.service.enabled,
        class: data.service.class,
        prompt_file: data.service.prompt_file || '',
        temperature: data.service.temperature,
        use_grounding: data.service.use_grounding,
        search_keyword: data.service.search_keyword || '',
        allowed_domains: data.service.allowed_domains || '',
        prompt_content: data.prompt_content || '',
        mode_message: data.service.mode_message || '',
        show_mode_message: data.service.show_mode_message !== false,
        loading_message: data.service.loading_message,
        query_loading_message: data.service.query_loading_message
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
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      
      if (serviceName === 'new') {
        const newServiceId = (document.getElementById('service_id') as HTMLInputElement)?.value;
        if (!newServiceId) {
          setError('請輸入服務 ID');
          return;
        }
        
        // 自動生成 prompt_file 路徑
        const dataToSend = {
          service_id: newServiceId,
          ...formData,
          prompt_file: `prompts/${tenantId}/${newServiceId}.md`
        };
        
        await client.addService(tenantId, dataToSend);
        setSuccess('服務建立成功');
        setTimeout(() => router.push(`/admin/tenants/${tenantId}/services`), 1500);
      } else {
        // 更新時也確保路徑正確
        const dataToSend = {
          ...formData,
          prompt_file: `prompts/${tenantId}/${serviceName}.md`
        };
        
        await client.updateService(tenantId, serviceName, dataToSend);
        setSuccess('服務更新成功');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除此服務嗎？')) return;

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) return;

      const client = new AdminAPIClient(apiKey);
      await client.deleteService(tenantId, serviceName);
      router.push(`/admin/tenants/${tenantId}/services`);
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
    <div className="max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 mb-4"
        >
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {serviceName === 'new' ? '新增服務' : `編輯服務 - ${formData.name || serviceName}`}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本設定 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">基本設定</h2>
          
          {serviceName === 'new' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                服務 ID (英文) *
              </label>
              <input
                type="text"
                id="service_id"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例如: route, recommend, myService_01"
                pattern="[a-zA-Z0-9_]+"
                required
              />
              <p className="text-xs text-gray-500 mt-1">僅限英文字母、數字和底線，建立後無法修改</p>
            </div>
          )}

          <div className="flex gap-4 mb-4">
            <div className="w-20">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                圖示
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full h-[42px] px-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl"
                maxLength={2}
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                服務名稱 (同步更新UI) {serviceName === 'new' && '*'}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 路線導航、商品推薦"
                required={serviceName === 'new'}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              服務類別
            </label>
            <select
              value={formData.class}
              onChange={(e) => setFormData({ ...formData, class: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {serviceClasses.map((cls) => (
                <option key={cls.value} value={cls.value}>
                  {cls.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
              啟用服務
            </label>
          </div>
        </div>

        {/* 參數設定 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">參數設定</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature: {formData.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>精確 (0)</span>
              <span>創意 (1)</span>
            </div>
          </div>

          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="use_grounding"
              checked={formData.use_grounding}
              onChange={(e) => setFormData({ ...formData, use_grounding: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="use_grounding" className="ml-2 block text-sm text-gray-700">
              使用 Google Search Grounding
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜尋關鍵字
            </label>
            <input
              type="text"
              value={formData.search_keyword}
              onChange={(e) => setFormData({ ...formData, search_keyword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如: 三創"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              允許的網域
            </label>
            <input
              type="text"
              value={formData.allowed_domains}
              onChange={(e) => setFormData({ ...formData, allowed_domains: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如: leosys.com, syntrend.com.tw"
            />
            <p className="text-xs text-gray-500 mt-1">限制參考資料來源網域，多個用逗號分隔</p>
          </div>

          {/* ChatService 專用設定 */}
          {formData.class === 'ChatService' && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="show_mode_message"
                  checked={formData.show_mode_message}
                  onChange={(e) => setFormData({ ...formData, show_mode_message: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="show_mode_message" className="ml-2 block text-sm text-gray-700">
                  顯示模式招呼訊息
                </label>
              </div>

              {formData.show_mode_message && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    招呼訊息
                  </label>
                  <textarea
                    value={formData.mode_message}
                    onChange={(e) => setFormData({ ...formData, mode_message: e.target.value })}
                    className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如: 💬 對話模式\n請問有什麼可以幫您的？"
                  />
                </div>
              )}
            </>
          )}

          {/* 問答等待訊息 - 所有服務通用 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              問答等待訊息
            </label>
            <input
              type="text"
              value={formData.loading_message}
              onChange={(e) => setFormData({ ...formData, loading_message: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="例如: 處理中"
            />
            <p className="text-xs text-gray-500 mt-1">使用者發送問答訊息時顯示的等待文字</p>
          </div>

          {/* QueryService 專用設定 */}
          {formData.class === 'QueryService' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                查詢等待訊息
              </label>
              <input
                type="text"
                value={formData.query_loading_message}
                onChange={(e) => setFormData({ ...formData, query_loading_message: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例如: 查詢資料中"
              />
              <p className="text-xs text-gray-500 mt-1">點擊使用資料查詢服務時顯示的等待文字</p>
            </div>
          )}
        </div>

        {/* 提示詞編輯 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">提示詞設定</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              提示詞檔案路徑
            </label>
            <input
              type="text"
              value={formData.prompt_file}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 cursor-not-allowed"
              placeholder={`prompts/${tenantId}/${serviceName}.md`}
            />
            <p className="text-xs text-gray-500 mt-1">路徑自動生成：prompts/[品牌ID]/[服務ID].md</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              提示詞內容 (Markdown)
            </label>
            <textarea
              value={formData.prompt_content}
              onChange={(e) => setFormData({ ...formData, prompt_content: e.target.value })}
              className="w-full h-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="輸入提示詞內容"
            />
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-between">
          <div>
            {serviceName !== 'new' && (
              <button
                type="button"
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                刪除服務
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
    </div>
  );
}
