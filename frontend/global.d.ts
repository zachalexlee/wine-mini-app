// Global type declarations for Telegram WebApp
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initDataUnsafe: {
    user?: { id: number; first_name?: string; last_name?: string };
    [key: string]: unknown;
  };
  themeParams: Record<string, string>;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
