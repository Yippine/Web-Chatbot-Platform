'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminAPIClient from '@/lib/admin/api-client';

export default function LineSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);

  const [form, setForm] = useState({
    enabled: false,
    channel_access_token: '',
    channel_secret: '',
  });

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
      const data = await client.getLineConfig(tenantId);
      setWebhookUrl(data.webhook_url);
      setHasToken(data.line.has_token);
      setHasSecret(data.line.has_secret);
      setForm((f) => ({
        ...f,
        enabled: data.line.enabled,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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
      // 空字串不送出（視為不變更憑證）
      const payload: any = {
        enabled: form.enabled,
      };
      if (form.channel_access_token) payload.channel_access_token = form.channel_access_token;
      if (form.channel_secret) payload.channel_secret = form.channel_secret;
      await client.updateLineConfig(tenantId, payload);
      setSuccess('LINE 設定已儲存。可複製上方 Webhook URL，到 LINE 後台貼上並按 Verify。');
      setForm((f) => ({ ...f, channel_access_token: '', channel_secret: '' }));
      await load();
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

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 mb-4">
          ← 返回
        </button>
        <h1 className="text-3xl font-bold text-gray-900">LINE 設定 - {tenantId}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>
      )}

      {/* 設定順序提示 */}
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm">
        <p className="font-medium mb-1">設定順序</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>在 LINE Developers 建立 Messaging API channel，取得 Channel access token 與 Channel secret</li>
          <li>於下方填入並<strong>先儲存</strong>（寫入後台 .env）</li>
          <li>複製上方 Webhook URL，貼到 LINE 後台後按 <strong>Verify</strong>（須先儲存憑證才驗得過）</li>
          <li>於 LINE 後台開啟「Use webhook」</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Webhook URL */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Webhook URL</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">由品牌 ID 推導，貼到 LINE 後台的 Webhook URL 欄位。</p>
        </div>

        {/* 憑證 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">LINE 憑證</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel access token {hasToken && <span className="text-green-600">（已設定，留空則不變更）</span>}
            </label>
            <input
              type="password"
              value={form.channel_access_token}
              onChange={(e) => setForm({ ...form, channel_access_token: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={hasToken ? '••••••（已設定）' : '貼上 Channel access token'}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel secret {hasSecret && <span className="text-green-600">（已設定，留空則不變更）</span>}
            </label>
            <input
              type="password"
              value={form.channel_secret}
              onChange={(e) => setForm({ ...form, channel_secret: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={hasSecret ? '••••••（已設定）' : '貼上 Channel secret'}
            />
          </div>
          <p className="text-xs text-gray-500">憑證明文僅存於後台 .env，不會寫入設定檔。</p>
        </div>

        {/* 行為設定 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">行為設定</h2>

          <div className="flex items-center mb-1">
            <input
              type="checkbox"
              id="line_enabled_toggle"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="line_enabled_toggle" className="ml-2 block text-sm text-gray-700">
              啟用 LINE
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
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
      </form>
    </div>
  );
}
