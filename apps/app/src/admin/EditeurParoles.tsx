'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { enregistrerParoles } from '@/app/admin/musiques/actions';
import {
  contientTamoul,
  debutCale,
  garderInstants,
  horodatage,
  lireParoles,
  parolesPretes,
  versLatin,
  versLrc,
  vueKaraoke,
  type LigneBrouillon,
  type LigneParoles,
} from '@/lib/paroles';
import { BoutonConfirme } from '@/regie/BoutonConfirme';

type Message =
  | { genre: 'ok'; cle: 'enregistrees' | 'retirees' }
  | {
      genre: 'erreur';
      cle: 'incompletes' | 'erreur.vide' | 'erreur.longue' | 'erreur.trop' | 'erreur.echec';
    }
  | { genre: 'erreur'; cle: 'erreur.latin'; valeurs: { texte: number; latin: number } };

const PAS_MS = 100;
const langueDe = (texte: string) => (contientTamoul(texte) ? 'ta' : 'und');

/**
 * Caler les paroles d'une chanson (2026-11-23) : coller le texte ou un `.lrc`, lancer la chanson,
 * taper Espace au début de chaque ligne, corriger au dixième de seconde, relire dans l'aperçu.
 * Depuis le 2026-11-26, un second champ prend la version en lettres latines, ligne pour ligne.
 */
export function EditeurParoles({
  id,
  titre,
  url,
  initiales,
}: {
  id: string;
  titre: string;
  url: string | null;
  initiales: readonly LigneParoles[];
}) {
  const t = useTranslations('admin.musiques.edition');
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const apercu = useRef<HTMLDivElement>(null);
  const aMarquer = useRef<HTMLLIElement>(null);
  const [texte, setTexte] = useState(() => versLrc(initiales));
  const [latin, setLatin] = useState(() => versLatin(initiales));
  const [lignes, setLignes] = useState<LigneBrouillon[]>(() => [...initiales]);
  /** La ligne qui attend son instant ; `null` hors du calage. */
  const [rang, setRang] = useState<number | null>(null);
  const [indexApercu, setIndexApercu] = useState(-1);
  const [message, setMessage] = useState<Message | null>(null);
  const [enCours, demarrer] = useTransition();

  const calees = useMemo(
    () =>
      lignes
        .flatMap((l) => (l.t_ms === null ? [] : [{ t_ms: l.t_ms, texte: l.texte, latin: l.latin }]))
        .sort((a, b) => a.t_ms - b.t_ms),
    [lignes],
  );

  /** Seulement le début calé (les lignes suivantes attendent encore) : on peut l'enregistrer seul. */
  const debut = useMemo(() => (parolesPretes(lignes) ? null : debutCale(lignes)), [lignes]);

  const marquer = useCallback(() => {
    const lecteur = audio.current;
    if (rang === null || !lecteur) return;
    const tMs = Math.round(lecteur.currentTime * 1000);
    setLignes((avant) => avant.map((l, i) => (i === rang ? { ...l, t_ms: tMs } : l)));
    setRang(rang + 1 < lignes.length ? rang + 1 : null);
  }, [rang, lignes.length]);

  // Pendant le calage, Espace marque la ligne, où que soit le focus (sauf dans le champ de texte).
  useEffect(() => {
    if (rang === null) return;
    const horsChamp = (e: KeyboardEvent) =>
      e.code === 'Space' &&
      !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement);
    const bas = (e: KeyboardEvent) => {
      if (!horsChamp(e)) return;
      e.preventDefault();
      if (!e.repeat) marquer();
    };
    // Sans cela, relâcher Espace « cliquerait » le bouton qui a le focus.
    const haut = (e: KeyboardEvent) => {
      if (horsChamp(e)) e.preventDefault();
    };
    window.addEventListener('keydown', bas, true);
    window.addEventListener('keyup', haut, true);
    return () => {
      window.removeEventListener('keydown', bas, true);
      window.removeEventListener('keyup', haut, true);
    };
  }, [rang, marquer]);

  useEffect(() => {
    aMarquer.current?.scrollIntoView({ block: 'nearest' });
  }, [rang]);

  // L'aperçu suit la chanson, image par image, sans rendu pour le remplissage.
  useEffect(() => {
    let image = 0;
    const suivre = () => {
      if (audio.current) {
        const vue = vueKaraoke(calees, audio.current.currentTime * 1000);
        apercu.current?.style.setProperty('--tu-paroles-avance', String(vue.avancement));
        setIndexApercu(vue.index);
      }
      image = requestAnimationFrame(suivre);
    };
    image = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(image);
  }, [calees]);

  function preparer() {
    setMessage(null);
    const lu = lireParoles(texte, latin);
    if (lu.refus === 'latin') {
      setMessage({
        genre: 'erreur',
        cle: 'erreur.latin',
        valeurs: { texte: lu.lignes.length, latin: lu.latines },
      });
      return;
    }
    if (lu.refus) {
      setMessage({ genre: 'erreur', cle: `erreur.${lu.refus}` });
      return;
    }
    audio.current?.pause();
    setRang(null);
    // Le calage déjà fait reste : ajouter la version latine ne le défait pas.
    setLignes((avant) => garderInstants(lu.lignes, avant));
  }

  /** Reprend le calage à la ligne `depuis`, un peu avant elle : la ligne d'avant sert d'élan. */
  function caler(depuis: number) {
    const lecteur = audio.current;
    if (!lecteur) return;
    setMessage(null);
    const elan = depuis > 0 ? (lignes[depuis - 1]?.t_ms ?? 0) : 0;
    setLignes((avant) => avant.map((l, i) => (i >= depuis ? { ...l, t_ms: null } : l)));
    setRang(depuis);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    lecteur.currentTime = elan / 1000;
    void lecteur.play();
  }

  function arreter() {
    audio.current?.pause();
    setRang(null);
  }

  function ecouter(tMs: number) {
    const lecteur = audio.current;
    if (!lecteur) return;
    lecteur.currentTime = tMs / 1000;
    void lecteur.play();
  }

  const decaler = (index: number, ecart: number) =>
    setLignes((avant) =>
      avant.map((l, i) =>
        i === index && l.t_ms !== null ? { ...l, t_ms: Math.max(0, l.t_ms + ecart) } : l,
      ),
    );

  function enregistrer() {
    // Tout calé, ou seulement le début : les lignes suivantes, pas calées, sont laissées de côté.
    const pretes = parolesPretes(lignes) ?? debut;
    if (!pretes) {
      setMessage({ genre: 'erreur', cle: 'incompletes' });
      return;
    }
    demarrer(async () => {
      const ok = await enregistrerParoles(id, pretes);
      setMessage(
        ok ? { genre: 'ok', cle: 'enregistrees' } : { genre: 'erreur', cle: 'erreur.echec' },
      );
      if (ok) {
        setTexte(versLrc(pretes));
        setLatin(versLatin(pretes));
        router.refresh();
      }
    });
  }

  function retirer() {
    demarrer(async () => {
      const ok = await enregistrerParoles(id, null);
      setMessage(ok ? { genre: 'ok', cle: 'retirees' } : { genre: 'erreur', cle: 'erreur.echec' });
      if (ok) {
        audio.current?.pause();
        setRang(null);
        setLignes([]);
        setTexte('');
        setLatin('');
        router.refresh();
      }
    });
  }

  const precedente = calees[indexApercu - 1]?.texte;
  const courante = calees[indexApercu]?.texte;
  const latinCourant = calees[indexApercu]?.latin;
  const suivante = calees[indexApercu + 1]?.texte;
  const tCourant = calees[indexApercu]?.t_ms;

  return (
    <div className="tu-paroles">
      <section className="tu-regie__section">
        <label className="tu-field">
          <span className="tu-field__label">{t('texte')}</span>
          <textarea
            className="tu-field__control tu-paroles__texte"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            spellCheck={false}
            data-testid="paroles-texte"
          />
        </label>
        <label className="tu-field">
          <span className="tu-field__label">{t('latin')}</span>
          <span className="tu-field__hint">{t('aideLatin')}</span>
          <textarea
            className="tu-field__control tu-paroles__texte"
            value={latin}
            onChange={(e) => setLatin(e.target.value)}
            spellCheck={false}
            data-testid="paroles-latin"
          />
        </label>
        <div>
          <Button onClick={preparer}>{t('preparer')}</Button>
        </div>
      </section>

      {lignes.length > 0 && (
        <section className="tu-regie__section">
          {url && (
            // Une chanson à écouter pour caler ses paroles : c'est son texte qu'on saisit ici.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              ref={audio}
              className="tu-regie-ecoute"
              controls
              preload="auto"
              src={url}
              aria-label={titre}
            />
          )}
          <p className="tu-regie__muted" data-testid="paroles-etat">
            {t('etat', { calees: calees.length, total: lignes.length })}
          </p>

          <div ref={apercu} className="tu-paroles__apercu" aria-label={t('apercu')} role="group">
            <p className="tu-paroles__voisine" lang={langueDe(precedente ?? '')}>
              {precedente ?? ' '}
            </p>
            <p
              key={indexApercu}
              className="tu-paroles__courante"
              lang={langueDe(courante ?? '')}
              data-testid="paroles-apercu"
            >
              <span>{courante ?? '♪'}</span>
              {courante && (
                <span className="tu-paroles__rempli" aria-hidden="true">
                  {courante}
                </span>
              )}
            </p>
            {latinCourant && (
              <p className="tu-paroles__latin" data-testid="paroles-apercu-latin">
                {latinCourant}
              </p>
            )}
            <p className="tu-paroles__voisine" lang={langueDe(suivante ?? '')}>
              {suivante ?? ' '}
            </p>
          </div>

          <div className="tu-regie-keys">
            {rang === null ? (
              <Button variant="accent" size="lg" onClick={() => caler(0)} disabled={!url}>
                {t('caler')}
              </Button>
            ) : (
              <>
                <Button variant="accent" size="lg" onClick={marquer}>
                  {t('marquer')}
                </Button>
                <Button size="lg" onClick={arreter}>
                  {t('arreter')}
                </Button>
              </>
            )}
          </div>
          {rang !== null && <p className="tu-regie__muted">{t('aideCaler')}</p>}
          {debut && (
            <p className="tu-regie__muted" data-testid="paroles-debut">
              {t('aideDebut', { n: debut.length })}
            </p>
          )}

          <ol className="tu-paroles__liste">
            {lignes.map((l, i) => (
              <li
                key={`${i}-${l.texte}`}
                ref={i === rang ? aMarquer : undefined}
                className="tu-paroles__ligne"
                data-actif={l.t_ms !== null && l.t_ms === tCourant}
                data-a-marquer={i === rang}
                data-testid="paroles-ligne"
              >
                <span className="tu-paroles__instant">
                  {l.t_ms === null ? '—' : horodatage(l.t_ms)}
                </span>
                <span className="tu-paroles__textes">
                  <span lang={langueDe(l.texte)}>{l.texte}</span>
                  {l.latin && <span className="tu-paroles__latin-ligne">{l.latin}</span>}
                </span>
                <span className="tu-paroles__outils">
                  {l.t_ms !== null && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('reculer')}
                        title={t('reculer')}
                        onClick={() => decaler(i, -PAS_MS)}
                      >
                        −
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('avancer')}
                        title={t('avancer')}
                        onClick={() => decaler(i, PAS_MS)}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('ecouter')}
                        title={t('ecouter')}
                        onClick={() => ecouter(l.t_ms!)}
                      >
                        ▶
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => caler(i)} disabled={!url}>
                    {t('recaler')}
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {message && (
        <p
          className={message.genre === 'ok' ? 'tu-regie__muted' : 'tu-regie__alert'}
          role={message.genre === 'ok' ? 'status' : 'alert'}
          data-testid="paroles-message"
        >
          {message.cle === 'erreur.latin' ? t(message.cle, message.valeurs) : t(message.cle)}
        </p>
      )}
      <div className="tu-regie-keys">
        <Button
          variant="accent"
          size="lg"
          onClick={enregistrer}
          disabled={enCours || !lignes.length}
        >
          {debut ? t('enregistrerDebut', { n: debut.length }) : t('enregistrer')}
        </Button>
        {initiales.length > 0 && (
          <BoutonConfirme
            variant="ghost"
            confirmation={t('confirmerRetirer')}
            onConfirm={retirer}
            disabled={enCours}
          >
            {t('retirer')}
          </BoutonConfirme>
        )}
      </div>
    </div>
  );
}
