'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

interface ColorConfig {
  type: 'solid' | 'gradient';
  color?: string;
  colors?: string[];
  direction?: string;
}

interface AppearanceData {
  pageTitle: string;
  title: string;
  subtitle: string;
  welcomeMessage: string;
  placeholder: string;
  header: ColorConfig;
  button: ColorConfig;
  chatIconUrl: string;
  textColor?: 'white' | 'black';
}

const EMPTY_APPEARANCE: AppearanceData = {
  pageTitle: '',
  title: '',
  subtitle: '',
  welcomeMessage: '',
  placeholder: '',
  header: {
    type: 'solid',
    color: '#000000'
  },
  button: {
    type: 'solid',
    color: '#000000'
  },
  chatIconUrl: '',
  textColor: 'white'
};

export default function AppearanceEditPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<AppearanceData>(EMPTY_APPEARANCE);

  useEffect(() => {
    loadAppearance();
  }, [tenantId]);

  const loadAppearance = async () => {
    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const data = await client.getAppearance(tenantId);
      
      // 直接使用 API 回傳的資料,缺失值顯示為空
      const appearance = data.appearance;
      setFormData({
        pageTitle: appearance.pageTitle || '',
        title: appearance.title || '',
        subtitle: appearance.subtitle || '',
        welcomeMessage: appearance.welcomeMessage || '',
        placeholder: appearance.placeholder || '',
        header: appearance.header || { type: 'solid', color: '#000000' },
        button: appearance.button || { type: 'solid', color: '#000000' },
        chatIconUrl: appearance.chatIconUrl || '',
        textColor: appearance.textColor || 'white'
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
      await client.updateAppearance(tenantId, formData);
      setSuccess('外觀設定更新成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const apiKey = localStorage.getItem('admin_api_key');
      if (!apiKey) {
        router.push('/admin/login');
        return;
      }

      const client = new AdminAPIClient(apiKey);
      const result = await client.uploadChatIcon(tenantId, file);
      
      setFormData(prev => ({
        ...prev,
        chatIconUrl: result.url
      }));
      
      setSuccess('圖示上傳成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleHeaderColorChange = (index: number, color: string) => {
    setFormData(prev => ({
      ...prev,
      header: {
        ...prev.header,
        colors: prev.header.colors?.map((c, i) => i === index ? color : c) || []
      }
    }));
  };

  const addHeaderColor = () => {
    if ((formData.header.colors?.length || 0) < 5) {
      setFormData(prev => ({
        ...prev,
        header: {
          ...prev.header,
          colors: [...(prev.header.colors || []), '#000000']
        }
      }));
    }
  };

  const removeHeaderColor = (index: number) => {
    if ((formData.header.colors?.length || 0) > 2) {
      setFormData(prev => ({
        ...prev,
        header: {
          ...prev.header,
          colors: prev.header.colors?.filter((_, i) => i !== index) || []
        }
      }));
    }
  };

  const generateGradientStyle = (config: ColorConfig) => {
    if (config.type === 'solid') {
      return { background: config.color };
    }
    return {
      background: `linear-gradient(${config.direction || 'to right'}, ${config.colors?.join(', ')})`
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/tenants')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← 返回品牌列表
        </button>
        <h1 className="text-3xl font-bold text-gray-900">外觀設定</h1>
        <p className="text-gray-600 mt-2">客製化聊天視窗的外觀與樣式</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 表單區 */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 標題設定 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">標題設定</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    網頁標題 (網頁分頁標籤)
                  </label>
                  <input
                    type="text"
                    value={formData.pageTitle}
                    onChange={(e) => setFormData({ ...formData, pageTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    主標題 (聊天標題列)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    副標題
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 訊息設定 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">訊息設定</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    歡迎訊息
                  </label>
                  <textarea
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    輸入框提示文字
                  </label>
                  <input
                    type="text"
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Header 顏色 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">標題列顏色</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.header.type === 'solid'}
                      onChange={() => setFormData({
                        ...formData,
                        header: { type: 'solid', color: '#f97316' }
                      })}
                      className="mr-2"
                    />
                    單色
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.header.type === 'gradient'}
                      onChange={() => setFormData({
                        ...formData,
                        header: { type: 'gradient', colors: ['#f97316', '#eab308', '#a855f7'], direction: 'to right' }
                      })}
                      className="mr-2"
                    />
                    漸層
                  </label>
                </div>

                {formData.header.type === 'solid' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
                    <input
                      type="color"
                      value={formData.header.color}
                      onChange={(e) => setFormData({
                        ...formData,
                        header: { ...formData.header, color: e.target.value }
                      })}
                      className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {formData.header.colors?.map((color, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <label className="text-sm text-gray-600 w-16">顏色 {index + 1}</label>
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => handleHeaderColorChange(index, e.target.value)}
                            className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
                          />
                          {(formData.header.colors?.length || 0) > 2 && (
                            <button
                              type="button"
                              onClick={() => removeHeaderColor(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {(formData.header.colors?.length || 0) < 5 && (
                      <button
                        type="button"
                        onClick={addHeaderColor}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        + 新增顏色
                      </button>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">方向</label>
                      <select
                        value={formData.header.direction}
                        onChange={(e) => setFormData({
                          ...formData,
                          header: { ...formData.header, direction: e.target.value }
                        })}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="to right">向右</option>
                        <option value="to bottom">向下</option>
                        <option value="135deg">對角</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 按鈕顏色 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">按鈕顏色</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.button.type === 'solid'}
                      onChange={() => setFormData({
                        ...formData,
                        button: { type: 'solid', color: '#f97316' }
                      })}
                      className="mr-2"
                    />
                    單色
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={formData.button.type === 'gradient'}
                      onChange={() => setFormData({
                        ...formData,
                        button: { type: 'gradient', colors: ['#f97316', '#a855f7'], direction: 'to right' }
                      })}
                      className="mr-2"
                    />
                    漸層
                  </label>
                </div>

                {formData.button.type === 'solid' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
                    <input
                      type="color"
                      value={formData.button.color}
                      onChange={(e) => setFormData({
                        ...formData,
                        button: { ...formData.button, color: e.target.value }
                      })}
                      className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {formData.button.colors?.map((color, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 w-16">顏色 {index + 1}</label>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...(formData.button.colors || [])];
                            newColors[index] = e.target.value;
                            setFormData({
                              ...formData,
                              button: { ...formData.button, colors: newColors }
                            });
                          }}
                          className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 文字顏色 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">文字顏色</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    套用於標籤列標題、送出按鈕箭頭、使用者訊息
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.textColor === 'white'}
                        onChange={() => setFormData({ ...formData, textColor: 'white' })}
                        className="mr-2"
                      />
                      白色
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={formData.textColor === 'black'}
                        onChange={() => setFormData({ ...formData, textColor: 'black' })}
                        className="mr-2"
                      />
                      黑色
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 圖示上傳 */}
            <div>
              <h2 className="text-lg font-semibold mb-4">聊天圖示</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    上傳圖示 (&lt; 5MB, 建議 128x128px)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploading && <p className="text-sm text-gray-500 mt-2">上傳中</p>}
                </div>
                {formData.chatIconUrl && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">目前圖示:</p>
                    <img
                      src={formData.chatIconUrl}
                      alt="Chat Icon"
                      className="w-16 h-16 border border-gray-300 rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '儲存中' : '儲存設定'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin/tenants')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </form>
        </div>

        {/* 預覽區 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">即時預覽</h2>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            {/* Header 預覽 */}
            <div
              style={generateGradientStyle(formData.header)}
              className={`p-4 ${formData.textColor === 'black' ? 'text-black' : 'text-white'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                  {formData.chatIconUrl ? (
                    <img 
                      src={formData.chatIconUrl} 
                      alt="Chat Icon" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>💬</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold">{formData.title}</h3>
                  <p className="text-xs opacity-90">{formData.subtitle}</p>
                </div>
              </div>
            </div>

            {/* 訊息預覽 */}
            <div className="p-4 bg-gray-50 space-y-3">
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%]">
                  {formData.welcomeMessage}
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  style={generateGradientStyle(formData.button)}
                  className={`px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%] ${
                    formData.textColor === 'black' ? 'text-black' : 'text-white'
                  }`}
                >
                  這是使用者訊息範例
                </div>
              </div>
            </div>

            {/* 輸入框預覽 */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={formData.placeholder}
                  disabled
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full bg-gray-50"
                />
                <button
                  style={generateGradientStyle(formData.button)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    formData.textColor === 'black' ? 'text-black' : 'text-white'
                  }`}
                  disabled
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
