'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    direction: 'ltr',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    direction: 'ltr',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    direction: 'ltr',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    direction: 'ltr',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    direction: 'ltr',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    direction: 'rtl',
  },
  he: {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    direction: 'rtl',
  },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Translation interface
interface Translation {
  [key: string]: string | Translation | string[];
}

interface Translations {
  [languageCode: string]: Translation;
}

// Pluralization rules
interface PluralRules {
  [languageCode: string]: (count: number) => number;
}

const pluralRules: PluralRules = {
  en: (count) => count === 1 ? 0 : 1,
  es: (count) => count === 1 ? 0 : 1,
  fr: (count) => count <= 1 ? 0 : 1,
  de: (count) => count === 1 ? 0 : 1,
  ja: () => 0, // Japanese doesn't have plural forms
  zh: () => 0, // Chinese doesn't have plural forms
  ar: (count) => {
    // Arabic has complex plural rules
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count >= 3 && count <= 10) return 3;
    if (count >= 11 && count <= 99) return 4;
    return 5;
  },
  he: (count) => count === 1 ? 0 : 1,
};

// Context type
interface I18nContextType {
  language: LanguageCode;
  languages: typeof SUPPORTED_LANGUAGES;
  translations: Translation;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, params?: Record<string, any>, count?: number) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Default translations - in a real app, these would be loaded from files
const defaultTranslations: Translations = {
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      clear: 'Clear',
      apply: 'Apply',
      reset: 'Reset',
    },
    navigation: {
      home: 'Home',
      explore: 'Explore',
      analytics: 'Analytics',
      account: 'Account',
      settings: 'Settings',
      help: 'Help',
      logout: 'Logout',
    },
    search: {
      placeholder: 'Search transactions, blocks, programs and tokens...',
      results: 'results',
      noResults: 'No results found',
      searchFor: 'Search for',
    },
    accessibility: {
      skipToContent: 'Skip to main content',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      toggleTheme: 'Toggle theme',
      changeLanguage: 'Change language',
    },
  },
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      back: 'Atrás',
      next: 'Siguiente',
      search: 'Buscar',
      filter: 'Filtrar',
      sort: 'Ordenar',
      clear: 'Limpiar',
      apply: 'Aplicar',
      reset: 'Restablecer',
    },
    navigation: {
      home: 'Inicio',
      explore: 'Explorar',
      analytics: 'Analíticas',
      account: 'Cuenta',
      settings: 'Configuración',
      help: 'Ayuda',
      logout: 'Cerrar sesión',
    },
    search: {
      placeholder: 'Buscar transacciones, bloques, programas y tokens...',
      results: 'resultados',
      noResults: 'No se encontraron resultados',
      searchFor: 'Buscar',
    },
    accessibility: {
      skipToContent: 'Saltar al contenido principal',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      toggleTheme: 'Cambiar tema',
      changeLanguage: 'Cambiar idioma',
    },
  },
  fr: {
    common: {
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      save: 'Enregistrer',
      delete: 'Supprimer',
      edit: 'Modifier',
      close: 'Fermer',
      back: 'Retour',
      next: 'Suivant',
      search: 'Rechercher',
      filter: 'Filtrer',
      sort: 'Trier',
      clear: 'Effacer',
      apply: 'Appliquer',
      reset: 'Réinitialiser',
    },
    navigation: {
      home: 'Accueil',
      explore: 'Explorer',
      analytics: 'Analytiques',
      account: 'Compte',
      settings: 'Paramètres',
      help: 'Aide',
      logout: 'Se déconnecter',
    },
    search: {
      placeholder: 'Rechercher des transactions, blocs, programmes et tokens...',
      results: 'résultats',
      noResults: 'Aucun résultat trouvé',
      searchFor: 'Rechercher',
    },
    accessibility: {
      skipToContent: 'Passer au contenu principal',
      openMenu: 'Ouvrir le menu',
      closeMenu: 'Fermer le menu',
      toggleTheme: 'Changer de thème',
      changeLanguage: 'Changer de langue',
    },
  },
  de: {
    common: {
      loading: 'Laden...',
      error: 'Fehler',
      success: 'Erfolg',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      save: 'Speichern',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      close: 'Schließen',
      back: 'Zurück',
      next: 'Weiter',
      search: 'Suchen',
      filter: 'Filter',
      sort: 'Sortieren',
      clear: 'Löschen',
      apply: 'Anwenden',
      reset: 'Zurücksetzen',
    },
    navigation: {
      home: 'Startseite',
      explore: 'Erkunden',
      analytics: 'Analytik',
      account: 'Konto',
      settings: 'Einstellungen',
      help: 'Hilfe',
      logout: 'Abmelden',
    },
    search: {
      placeholder: 'Transaktionen, Blöcke, Programme und Token suchen...',
      results: 'Ergebnisse',
      noResults: 'Keine Ergebnisse gefunden',
      searchFor: 'Suchen nach',
    },
    accessibility: {
      skipToContent: 'Zum Hauptinhalt springen',
      openMenu: 'Menü öffnen',
      closeMenu: 'Menü schließen',
      toggleTheme: 'Design wechseln',
      changeLanguage: 'Sprache ändern',
    },
  },
  ja: {
    common: {
      loading: '読み込み中...',
      error: 'エラー',
      success: '成功',
      cancel: 'キャンセル',
      confirm: '確認',
      save: '保存',
      delete: '削除',
      edit: '編集',
      close: '閉じる',
      back: '戻る',
      next: '次へ',
      search: '検索',
      filter: 'フィルター',
      sort: '並び替え',
      clear: 'クリア',
      apply: '適用',
      reset: 'リセット',
    },
    navigation: {
      home: 'ホーム',
      explore: '探索',
      analytics: '分析',
      account: 'アカウント',
      settings: '設定',
      help: 'ヘルプ',
      logout: 'ログアウト',
    },
    search: {
      placeholder: 'トランザクション、ブロック、プログラム、トークンを検索...',
      results: '件の結果',
      noResults: '結果が見つかりません',
      searchFor: '検索',
    },
    accessibility: {
      skipToContent: 'メインコンテンツにスキップ',
      openMenu: 'メニューを開く',
      closeMenu: 'メニューを閉じる',
      toggleTheme: 'テーマを切り替え',
      changeLanguage: '言語を変更',
    },
  },
  zh: {
    common: {
      loading: '加载中...',
      error: '错误',
      success: '成功',
      cancel: '取消',
      confirm: '确认',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      close: '关闭',
      back: '返回',
      next: '下一步',
      search: '搜索',
      filter: '筛选',
      sort: '排序',
      clear: '清除',
      apply: '应用',
      reset: '重置',
    },
    navigation: {
      home: '首页',
      explore: '探索',
      analytics: '分析',
      account: '账户',
      settings: '设置',
      help: '帮助',
      logout: '登出',
    },
    search: {
      placeholder: '搜索交易、区块、程序和代币...',
      results: '个结果',
      noResults: '未找到结果',
      searchFor: '搜索',
    },
    accessibility: {
      skipToContent: '跳转到主要内容',
      openMenu: '打开菜单',
      closeMenu: '关闭菜单',
      toggleTheme: '切换主题',
      changeLanguage: '更改语言',
    },
  },
  ar: {
    common: {
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجح',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      save: 'حفظ',
      delete: 'حذف',
      edit: 'تعديل',
      close: 'إغلاق',
      back: 'رجوع',
      next: 'التالي',
      search: 'بحث',
      filter: 'تصفية',
      sort: 'ترتيب',
      clear: 'مسح',
      apply: 'تطبيق',
      reset: 'إعادة تعيين',
    },
    navigation: {
      home: 'الرئيسية',
      explore: 'استكشاف',
      analytics: 'التحليلات',
      account: 'الحساب',
      settings: 'الإعدادات',
      help: 'المساعدة',
      logout: 'تسجيل الخروج',
    },
    search: {
      placeholder: 'البحث عن المعاملات والكتل والبرامج والرموز...',
      results: 'نتائج',
      noResults: 'لم يتم العثور على نتائج',
      searchFor: 'البحث عن',
    },
    accessibility: {
      skipToContent: 'انتقل إلى المحتوى الرئيسي',
      openMenu: 'فتح القائمة',
      closeMenu: 'إغلاق القائمة',
      toggleTheme: 'تغيير المظهر',
      changeLanguage: 'تغيير اللغة',
    },
  },
  he: {
    common: {
      loading: 'טוען...',
      error: 'שגיאה',
      success: 'הצלחה',
      cancel: 'בטל',
      confirm: 'אשר',
      save: 'שמור',
      delete: 'מחק',
      edit: 'ערוך',
      close: 'סגור',
      back: 'חזור',
      next: 'הבא',
      search: 'חיפוש',
      filter: 'סינון',
      sort: 'מיון',
      clear: 'נקה',
      apply: 'החל',
      reset: 'איפוס',
    },
    navigation: {
      home: 'בית',
      explore: 'חקור',
      analytics: 'אנליטיקה',
      account: 'חשבון',
      settings: 'הגדרות',
      help: 'עזרה',
      logout: 'התנתק',
    },
    search: {
      placeholder: 'חפש עסקאות, בלוקים, תוכניות ואסימונים...',
      results: 'תוצאות',
      noResults: 'לא נמצאו תוצאות',
      searchFor: 'חפש',
    },
    accessibility: {
      skipToContent: 'דלג לתוכן הראשי',
      openMenu: 'פתח תפריט',
      closeMenu: 'סגור תפריט',
      toggleTheme: 'החלף ערכת נושא',
      changeLanguage: 'שנה שפה',
    },
  },
};

// Utility function to get nested translation
function getNestedTranslation(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Utility function to replace parameters in translation
function replaceParams(text: string, params: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

// I18n Provider
interface I18nProviderProps {
  children: React.ReactNode;
  defaultLanguage?: LanguageCode;
  translations?: Translations;
}

export function I18nProvider({ 
  children, 
  defaultLanguage = 'en',
  translations = defaultTranslations 
}: I18nProviderProps) {
  const [language, setLanguage] = useState<LanguageCode>(defaultLanguage);
  const [loadedTranslations, setLoadedTranslations] = useState<Translations>(translations);

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('opensvm-language') as LanguageCode;
      if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
        setLanguage(savedLanguage);
      } else {
        // Try to detect browser language
        const browserLanguage = navigator.language.split('-')[0] as LanguageCode;
        if (SUPPORTED_LANGUAGES[browserLanguage]) {
          setLanguage(browserLanguage);
        }
      }
    }
  }, []);

  // Save language to localStorage and update document attributes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('opensvm-language', language);
      document.documentElement.lang = language;
      document.documentElement.dir = SUPPORTED_LANGUAGES[language].direction;
    }
  }, [language]);

  const t = (key: string, params?: Record<string, any>, count?: number): string => {
    const currentTranslations = loadedTranslations[language] || loadedTranslations.en;
    let translation = getNestedTranslation(currentTranslations, key);

    if (!translation) {
      // Fallback to English
      translation = getNestedTranslation(loadedTranslations.en, key);
    }

    if (!translation) {
      // Return key if no translation found
      return key;
    }

    // Handle pluralization
    if (count !== undefined && Array.isArray(translation)) {
      const pluralRule = pluralRules[language] || pluralRules.en;
      const index = pluralRule(count);
      translation = translation[index] || translation[0] || key;
    } else if (Array.isArray(translation)) {
      translation = translation[0] || key;
    }

    if (typeof translation !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      translation = replaceParams(translation, params);
    }

    return translation;
  };

  const formatNumber = (number: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(language, options).format(number);
    } catch (error) {
      return number.toString();
    }
  };

  const formatDate = (date: Date | number, options?: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat(language, options).format(date);
    } catch (error) {
      return new Date(date).toString();
    }
  };

  const formatCurrency = (amount: number, currency = 'USD'): string => {
    try {
      return new Intl.NumberFormat(language, {
        style: 'currency',
        currency,
      }).format(amount);
    } catch (error) {
      return `${currency} ${amount}`;
    }
  };

  const direction = SUPPORTED_LANGUAGES[language].direction;
  const isRTL = direction === 'rtl';

  const contextValue: I18nContextType = {
    language,
    languages: SUPPORTED_LANGUAGES,
    translations: loadedTranslations[language] || loadedTranslations.en,
    setLanguage,
    t,
    formatNumber,
    formatDate,
    formatCurrency,
    direction,
    isRTL,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Translation hook
export function useTranslation() {
  const { t, language, formatNumber, formatDate, formatCurrency } = useI18n();
  return {
    t,
    language,
    formatNumber,
    formatDate,
    formatCurrency,
  };
}

// Language switcher component
export function LanguageSwitcher({ 
  className = '',
  showFlags = true,
  showNativeName = true 
}: {
  className?: string;
  showFlags?: boolean;
  showNativeName?: boolean;
}) {
  const { language, languages, setLanguage, t } = useI18n();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as LanguageCode)}
      className={`bg-background border border-input rounded-md px-3 py-2 text-sm ${className}`}
      aria-label={t('accessibility.changeLanguage')}
    >
      {Object.entries(languages).map(([code, lang]) => (
        <option key={code} value={code}>
          {showFlags && `${lang.flag} `}
          {showNativeName ? lang.nativeName : lang.name}
        </option>
      ))}
    </select>
  );
}

export default I18nProvider;