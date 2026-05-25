import enMessages from '../../_locales/en/messages.json';
import zhMessages from '../../_locales/zh_CN/messages.json';

type ChromeMessageMap = Record<string, { message: string }>;
type SupportedLanguage = 'zh-CN' | 'en';

const FALLBACK_MESSAGES: Record<SupportedLanguage, ChromeMessageMap> = {
  'zh-CN': zhMessages as ChromeMessageMap,
  en: enMessages as ChromeMessageMap,
};

function isZhLanguage(language?: string): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('zh');
}

export function tryGetUiLanguage(): string | undefined {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage();
  }

  if (typeof navigator !== 'undefined') {
    return navigator.language;
  }

  return undefined;
}

export function getUiLanguage(): SupportedLanguage {
  return isZhLanguage(tryGetUiLanguage()) ? 'zh-CN' : 'en';
}

export function getRuntimeLocaleTag(): string {
  return getUiLanguage() === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function applySubstitutions(
  template: string,
  substitutions?: string | string[]
): string {
  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions !== undefined
      ? [substitutions]
      : [];

  return values.reduce(
    (result, value, index) => result.split(`$${index + 1}`).join(value),
    template
  );
}

export function t(key: string, substitutions?: string | string[]): string {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const translated = chrome.i18n.getMessage(key, substitutions as string | string[] | undefined);
    if (translated) {
      return translated;
    }
  }

  const language = getUiLanguage();
  const fallback = FALLBACK_MESSAGES[language]?.[key]?.message;
  if (fallback) {
    return applySubstitutions(fallback, substitutions);
  }

  return key;
}

export function applyDocumentLocale(titleKey?: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = getRuntimeLocaleTag();
  if (titleKey) {
    document.title = t(titleKey);
  }
}
