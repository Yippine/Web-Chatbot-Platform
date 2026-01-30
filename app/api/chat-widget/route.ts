export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenant_id') || 'demo';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  const script = `(function() {
  const FRONTEND_URL = '${frontendUrl}';
  const API_URL = '${apiUrl}';
  const TENANT_ID = '${tenantId}';
  
  // 載入租戶設定並建立按鈕
  fetch(API_URL + '/api/tenant/config', {
    headers: { 'X-Tenant-ID': TENANT_ID }
  })
  .then(res => res.json())
  .then(config => {
    const chatIconUrl = config.appearance?.chatIconUrl || '/chat-icon.png';
    const iconSrc = chatIconUrl.startsWith('http') ? chatIconUrl : FRONTEND_URL + chatIconUrl;
    
    // 建立切換按鈕
    const toggle = document.createElement('button');
    toggle.id = 'chatbot-toggle';
    toggle.innerHTML = '<img src="' + iconSrc + '" alt="聊天" style="width:100%;height:100%;object-fit:cover;" />';
    toggle.style.cssText = 'position:fixed;bottom:20px;right:20px;width:64px;height:64px;border-radius:50%;border:none;background:white;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;padding:0;transition:all 0.3s;overflow:hidden;';
    toggle.onmouseover = () => toggle.style.transform = 'scale(1.1)';
    toggle.onmouseout = () => toggle.style.transform = 'scale(1)';
    
    // 建立 iframe (帶上 tenant_id)
    const iframe = document.createElement('iframe');
    iframe.id = 'chatbot-iframe';
    iframe.src = FRONTEND_URL + '/chat?tenant_id=' + TENANT_ID;
    iframe.style.cssText = 'position:fixed;bottom:90px;right:20px;width:400px;height:600px;border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:9999;display:none;transition:all 0.3s;';
    iframe.allow = 'microphone';
    
    let isExpanded = false;
    
    // 切換顯示
    toggle.onclick = () => {
      if (iframe.style.display === 'none') {
        iframe.style.display = 'block';
      } else {
        iframe.style.display = 'none';
        if (isExpanded) {
          isExpanded = false;
          iframe.style.position = 'fixed';
          iframe.style.top = 'auto';
          iframe.style.bottom = '90px';
          iframe.style.right = '20px';
          iframe.style.left = 'auto';
          iframe.style.width = '400px';
          iframe.style.height = '600px';
          iframe.style.maxWidth = 'none';
          iframe.style.margin = '0';
        }
      }
    };
    
    // 監聽來自 iframe 的訊息
    window.addEventListener('message', (event) => {
      if (event.origin !== FRONTEND_URL) return;
      
      if (event.data.type === 'CLOSE_CHAT') {
        iframe.style.display = 'none';
        if (isExpanded) {
          isExpanded = false;
          iframe.style.cssText = 'position:fixed;bottom:90px;right:20px;width:400px;height:600px;border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:9999;display:none;transition:all 0.3s;';
        }
      } else if (event.data.type === 'EXPAND_CHAT') {
        isExpanded = !isExpanded;
        if (isExpanded) {
          iframe.style.position = 'fixed';
          iframe.style.top = '20px';
          iframe.style.right = '20px';
          iframe.style.bottom = '20px';
          iframe.style.left = '20px';
          iframe.style.width = 'calc(100vw - 40px)';
          iframe.style.height = 'calc(100vh - 40px)';
          iframe.style.maxWidth = '1200px';
          iframe.style.margin = '0 auto';
        } else {
          iframe.style.position = 'fixed';
          iframe.style.top = 'auto';
          iframe.style.bottom = '90px';
          iframe.style.right = '20px';
          iframe.style.left = 'auto';
          iframe.style.width = '400px';
          iframe.style.height = '600px';
          iframe.style.maxWidth = 'none';
          iframe.style.margin = '0';
        }
      }
    });
    
    document.body.appendChild(toggle);
    document.body.appendChild(iframe);
  })
  .catch(err => {
    console.error('載入聊天圖示失敗:', err);
    // Fallback: 使用預設圖示
    const toggle = document.createElement('button');
    toggle.id = 'chatbot-toggle';
    toggle.innerHTML = '<img src="' + FRONTEND_URL + '/chat-icon.png" alt="聊天" style="width:100%;height:100%;object-fit:cover;" />';
    toggle.style.cssText = 'position:fixed;bottom:20px;right:20px;width:64px;height:64px;border-radius:50%;border:none;background:white;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;padding:0;transition:all 0.3s;overflow:hidden;';
    document.body.appendChild(toggle);
  });
})();`;

  return new Response(script, {
    headers: { 
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache'
    }
  });
}
