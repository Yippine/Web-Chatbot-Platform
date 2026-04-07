import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Leo AI Genie</h1>
          <p className="text-sm text-gray-500 mt-1">AI 網頁精靈管理平台</p>
        </div>
        
        <nav className="px-4 space-y-1">
          <Link
            href="/admin/tenants"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            品牌管理
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
