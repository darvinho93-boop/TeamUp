'use client';

import { createContext, useEffect, useMemo, useState } from 'react';
import { imagesDuTheme, sonsDuTheme, themeDe, type ThemeFairePart } from '@/lib/faire-part';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { useFichiersLocaux } from '../useFichiersLocaux';
import { illustrationDe } from './illustration';

/** Un thème prêt à habiller l'écran : ses fichiers sont tous là, en adresses locales. */
export interface ThemeCharge {
  theme: ThemeFairePart;
  /** L'adresse locale (`blob:`) d'un fichier du thème. */
  url: (chemin: string) => string;
  /** L'illustration nettoyée, prête à se dessiner (`illustrationDe`). */
  illustration: string;
  /** Les musiques du thème, une fois téléchargées ; `null` dans l'aperçu de la régie, muet. */
  sons: { musique: string | null; ambiance: string | null } | null;
}

/** Le thème de la soirée, pour les scènes qui s'en habillent ; `null` sans thème. */
export const ThemeContexte = createContext<ThemeCharge | null>(null);

/**
 * L'entrée à thème en cours (l'ouverture se change en accueil), avec l'instant de la passe finale
 * où elle a repris la boucle ; `null` le reste du temps : l'accueil s'affiche alors déjà formé.
 */
export const EntreeContexte = createContext<{ depuisMs: number } | null>(null);

/**
 * Le thème de la soirée (2026-11-27), lu sous la session de l'animateur, puis ses fichiers
 * téléchargés dès l'ouverture de l'écran : `null` tant qu'il en manque un, et pour toujours sans
 * thème (ou sans la migration du 2026-11-27). L'écran reste alors l'écran Team Up! habituel.
 */
export function useThemeSoiree(
  evenementId: string,
  { sons }: { sons: boolean },
): ThemeCharge | null {
  const [theme, setTheme] = useState<ThemeFairePart | null>(null);
  useEffect(() => {
    let actif = true;
    void supabaseNavigateur()
      .from('themes_soiree')
      .select('theme, fichiers, reglages')
      .eq('evenement_id', evenementId)
      .maybeSingle()
      .then(({ data }) => {
        if (actif) setTheme(themeDe(data));
      });
    return () => {
      actif = false;
    };
  }, [evenementId]);

  const chemins = theme ? [...imagesDuTheme(theme), ...(sons ? sonsDuTheme(theme) : [])] : [];
  const fichiers = useFichiersLocaux('themes', chemins);

  const adresseIllustration = theme ? fichiers.get(theme.fichiers.illustration) : undefined;
  const [illustration, setIllustration] = useState<string | null>(null);
  useEffect(() => {
    if (!adresseIllustration) return;
    let actif = true;
    void fetch(adresseIllustration)
      .then((reponse) => reponse.text())
      .then((texte) => {
        if (actif) setIllustration(illustrationDe(texte));
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [adresseIllustration]);

  const pret = !!theme && !!illustration && imagesDuTheme(theme).every((c) => fichiers.has(c));
  const musique = theme && sons ? (fichiers.get(theme.fichiers.musique) ?? null) : null;
  const ambianceChemin = theme?.fichiers.ambiance;
  const ambiance = ambianceChemin && sons ? (fichiers.get(ambianceChemin) ?? null) : null;
  return useMemo(
    () =>
      pret && theme && illustration
        ? {
            theme,
            url: (chemin: string) => fichiers.get(chemin) ?? '',
            illustration,
            sons: sons ? { musique, ambiance } : null,
          }
        : null,
    [pret, theme, illustration, fichiers, sons, musique, ambiance],
  );
}
