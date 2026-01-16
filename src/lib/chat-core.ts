export class ChatCore {
  private apiUrl: string;
  
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }
  
  async sendMessage(message: string, mode: string = 'general', history: string[] = []) {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode, history })
    });
    
    if (!res.ok) throw new Error('API 錯誤');
    return await res.json();
  }
  
  async detectIntent(message: string) {
    const res = await fetch(`${this.apiUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (!res.ok) throw new Error('API 錯誤');
    return await res.json();
  }
}

export const quickActions = [
  { icon: '🗺️', text: '路線導航', query: '從停車場到 Apple Store 怎麼去？' },
  { icon: '🎯', text: '商品推薦', query: '我想買相機，有什麼推薦？' },
  { icon: '📍', text: '樓層資訊', query: '樓層資訊' },
  { icon: '🎪', text: '最新活動', query: '最近有什麼展覽？' }
];

export class VoiceInput {
  private recognition: any;
  private onResultCallback: (text: string) => void;
  
  constructor(onResult: (text: string) => void) {
    this.onResultCallback = onResult;
    
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.lang = 'zh-TW';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.onResultCallback(transcript);
      };
      
      this.recognition.onerror = (event: any) => {
        console.error('語音識別錯誤:', event.error);
      };
    }
  }
  
  start() {
    if (this.recognition) {
      this.recognition.start();
    }
  }
  
  stop() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }
  
  isSupported() {
    return !!this.recognition;
  }
}

export const loadingTexts: { [key: string]: string } = {
  route: '路線查詢中',
  recommend: 'AI 推薦分析中',
  general: '思考中'
};
