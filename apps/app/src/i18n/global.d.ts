import type messages from '../../messages/fr.json';
import type { Langue } from '@/lib/partie';

// Le français fait référence : une clé absente ou mal orthographiée casse le typecheck.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Langue;
    Messages: typeof messages;
  }
}
