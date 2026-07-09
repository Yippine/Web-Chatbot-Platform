'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function isSafeRedirect(path: string | null): path is string {
  return !!path && path.startsWith('/admin/') && !path.startsWith('//');
}

function LoginPage() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey) {
      setError('請輸入 API Key');
      return;
    }

    // 儲存 API Key 到 localStorage
    localStorage.setItem('admin_api_key', apiKey);

    // 重定向回原本要前往的頁面（例如帶 ?category= 的品牌管理連結），否則預設進品牌管理
    router.push(isSafeRedirect(redirect) ? redirect : '/admin/tenants');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          管理後台登入
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              Admin API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="輸入 API Key"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            登入
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-500 text-center">
          <p>預設 API Key: admin_secret_key</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
