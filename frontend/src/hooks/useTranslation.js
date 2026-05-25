import { useAuth } from '../context/AuthContext';
import S from '../i18n/strings';

export function useTranslation() {
  const { dbUser } = useAuth();
  const lang = dbUser?.language ?? 'ES';
  const dict = S[lang] ?? S.ES;

  const t = (key, ...args) => {
    const val = dict[key] ?? S.ES[key] ?? key;
    return typeof val === 'function' ? val(...args) : val;
  };

  return { t, lang };
}
