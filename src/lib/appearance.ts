/**
 * 外觀工具函式
 */

export interface ColorConfig {
  type: 'solid' | 'gradient';
  color?: string;
  colors?: string[];
  direction?: string;
}

export interface AppearanceConfig {
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

export function generateColorStyle(config: ColorConfig): React.CSSProperties {
  if (config.type === 'solid') {
    return { background: config.color || '#f97316' };
  }
  
  const colors = config.colors || ['#f97316', '#eab308', '#a855f7'];
  const direction = config.direction || 'to right';
  
  return {
    background: `linear-gradient(${direction}, ${colors.join(', ')})`
  };
}
