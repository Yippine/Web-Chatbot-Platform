import translations from '@/locales/translations.json';

export type Language = 'zh-tw' | 'en' | 'ja' | 'ko' | 'vi' | 'id' | 'th';

export function getTranslation(lang: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) return key;
  }
  
  return value || key;
}

// 語言代碼映射 (後端回傳的語言名稱 -> 前端語言代碼)
export const languageMap: Record<string, Language> = {
  'Traditional Chinese': 'zh-tw',
  'English': 'en',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Vietnamese': 'vi',
  'Indonesian': 'id',
  'Thai': 'th',
  'zh-tw': 'zh-tw',
  'en': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'vi': 'vi',
  'id': 'id',
  'th': 'th'
};
