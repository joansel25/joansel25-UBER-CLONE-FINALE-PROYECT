import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import S from '../i18n/strings';

export function useTranslation() {
  const { dbUser } = useAuth();
  const lang = dbUser?.language ?? 'ES';
  const dict = S[lang] ?? S.ES;

  const t = useCallback((key, ...args) => {
    const val = dict[key] ?? S.ES[key] ?? key;
    return typeof val === 'function' ? val(...args) : val;
  }, [dict]);

  return { t, lang };
}
