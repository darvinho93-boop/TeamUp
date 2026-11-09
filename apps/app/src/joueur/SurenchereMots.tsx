'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField, cx } from '@teamup/ui/react';
import { cleMot, LONGUEUR_MOT_MAX, MOTS_MAX } from '@teamup/game';
import { useMaintenant } from '@/ecran/Chrono';
import type { EtatJoueur, RefusMot, SurenchereJoueur } from '@/lib/partie';
import { ChronoQuestion } from './quizCommun';

/** La base accepte un mot jusqu'à une seconde après la fin du chrono. */
const GRACE_MS = 1000;
/** Un envoi tombé faute de réseau repart à ce rythme, tant que le chrono court. */
const NOUVEL_ESSAI_MS = 1500;

interface EnAttente {
  /** Le thème pour lequel le mot a été tapé : il ne part jamais sur un autre. */
  passage: string;
  mot: string;
}

type Message = Exclude<RefusMot, 'session'> | 'vide';

/**
 * Surenchère en mode téléphones (2026-11-08) : pendant le chrono, le capitaine tape le plus de
 * mots possible sur le sujet ; ses coéquipiers voient la liste et lui soufflent des idées. Chaque
 * mot part aussitôt (l'écran compte en direct) ; ceux qui attendent le réseau repartent seuls tant
 * que le chrono court. Toutes les règles vivent dans la base ; cet écran affiche ce qu'elle renvoie.
 */
export function SurenchereMots({
  code,
  surenchere: s,
  decalageMs,
  remplacer,
  relire,
}: {
  code: string;
  surenchere: SurenchereJoueur;
  decalageMs: number;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  const t = useTranslations('surenchere');
  const [saisie, setSaisie] = useState('');
  const [attente, setAttente] = useState<EnAttente[]>([]);
  const [message, setMessage] = useState<{ passage: string | null; cle: Message } | null>(null);
  // Les mots que la base a refusés parce que le chrono était fini (le réseau les avait retenus).
  const [tardifs, setTardifs] = useState<{ passage: string; n: number } | null>(null);
  const attenteRef = useRef<EnAttente[]>([]);
  const formulaire = useRef<HTMLFormElement>(null);
  const envoiEnCours = useRef(false);
  const essai = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finMs =
    s.chrono_depart_ms !== null && s.chrono_duree_s !== null
      ? s.chrono_depart_ms + s.chrono_duree_s * 1000
      : null;
  const maintenant = useMaintenant(s.etape === 'chrono');
  const enCours = s.etape === 'chrono' && finMs !== null && maintenant + decalageMs < finMs;
  const ouvert =
    s.etape === 'chrono' && finMs !== null && maintenant + decalageMs < finMs + GRACE_MS;
  const peutTaper = enCours && s.capitaine;
  const passage = s.passage_id;
  // Le thème en cours, lu par la file d'envoi : un mot tapé pour un thème ne part jamais sur un
  // autre (réseau revenu après le changement de thème).
  const passageRef = useRef(passage);
  useEffect(() => {
    passageRef.current = passage;
  }, [passage]);

  const poserAttente = (suivante: EnAttente[]) => {
    attenteRef.current = suivante;
    setAttente(suivante);
  };

  useEffect(
    () => () => {
      if (essai.current) clearTimeout(essai.current);
    },
    [],
  );

  // Le chrono part : le champ prend la main, le clavier s'ouvre, le capitaine tape aussitôt.
  useEffect(() => {
    if (peutTaper) formulaire.current?.querySelector('input')?.focus();
  }, [peutTaper, passage]);

  /** Envoie les mots en attente, un par un, dans l'ordre où ils ont été tapés. */
  const vider = async () => {
    if (envoiEnCours.current) return;
    envoiEnCours.current = true;
    try {
      while (attenteRef.current.length > 0) {
        const premier = attenteRef.current[0]!;
        // Retiré de la file telle qu'elle est maintenant : d'autres mots ont pu s'y ajouter
        // pendant l'envoi (un mot tapé pendant que le précédent partait se perdait).
        const sortir = () => poserAttente(attenteRef.current.filter((m) => m !== premier));
        if (premier.passage !== passageRef.current) {
          sortir();
          continue;
        }
        let corps: EtatJoueur | { erreur: RefusMot };
        try {
          const reponse = await fetch(`/api/partie/${code}/mot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ajouter', mot: premier.mot, passage: premier.passage }),
          });
          if (reponse.status >= 500) throw new Error(String(reponse.status));
          corps = (await reponse.json()) as EtatJoueur | { erreur: RefusMot };
        } catch {
          // Réseau tombé ou serveur en panne : le mot attend, on réessaie un peu plus tard.
          if (essai.current) clearTimeout(essai.current);
          essai.current = setTimeout(() => void vider(), NOUVEL_ESSAI_MS);
          return;
        }
        if ('erreur' in corps) {
          if (corps.erreur === 'fermee' || corps.erreur === 'session') {
            // Trop tard : plus rien ne partira pour ce thème ; le téléphone le dira.
            const perdus = attenteRef.current.filter((m) => m.passage === premier.passage);
            poserAttente(attenteRef.current.filter((m) => m.passage !== premier.passage));
            setTardifs((avant) => ({
              passage: premier.passage,
              n: (avant?.passage === premier.passage ? avant.n : 0) + perdus.length,
            }));
            relire();
            return;
          }
          setMessage({ passage: premier.passage, cle: corps.erreur });
          sortir();
        } else {
          sortir();
          remplacer(corps);
        }
      }
    } finally {
      envoiEnCours.current = false;
    }
  };

  const retirer = async (id: string) => {
    try {
      const reponse = await fetch(`/api/partie/${code}/mot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'retirer', id }),
      });
      const corps = (await reponse.json()) as EtatJoueur | { erreur: RefusMot };
      if ('erreur' in corps) relire();
      else remplacer(corps);
    } catch {
      relire();
    }
  };

  const ajouter = (e: FormEvent) => {
    e.preventDefault();
    if (!passage || !peutTaper) return;
    const mot = saisie.trim().replace(/\s+/gu, ' ');
    if (!mot) return setMessage({ passage, cle: 'vide' });
    const cle = cleMot(mot);
    const dejaLa =
      s.mots.some((m) => cleMot(m.mot) === cle) ||
      attenteRef.current.some((m) => m.passage === passage && cleMot(m.mot) === cle);
    if (dejaLa) return setMessage({ passage, cle: 'doublon' });
    if (s.mots.length + attenteRef.current.length >= MOTS_MAX) {
      return setMessage({ passage, cle: 'trop' });
    }
    setSaisie('');
    setMessage(null);
    poserAttente([...attenteRef.current, { passage, mot }]);
    void vider();
  };

  if (!s.equipe) {
    return <p className="tu-quiz__statut">{t('sansEquipe')}</p>;
  }

  const enAttente = attente.filter((m) => m.passage === passage);
  const perdus =
    (tardifs?.passage === passage ? tardifs.n : 0) +
    (!ouvert && s.etape === 'chrono' ? enAttente.length : 0);
  const messageCourant = message?.passage === passage ? message.cle : null;
  const liste = (
    <ListeMots
      mots={s.mots}
      attente={enAttente.map((m) => m.mot)}
      retirer={peutTaper ? (id) => void retirer(id) : null}
    />
  );

  if (s.etape === 'themes' || !passage) {
    return (
      <div className="tu-quiz__fin">
        <p className="tu-quiz__titre">{t('titre')}</p>
        <p className="tu-player__lead">{s.capitaine ? t('themesCapitaine') : t('themes')}</p>
      </div>
    );
  }

  if (s.etape === 'podium') {
    return (
      <div className="tu-quiz">
        <Sujet surenchere={s} />
        <p
          className={cx('tu-quiz__statut', s.rang ? 'tu-quiz__statut--in' : null)}
          role="status"
          data-testid="statut-surenchere"
        >
          {s.rang && s.points ? t('podium', { rang: s.rang, points: s.points }) : t('horsPodium')}
        </p>
        {liste}
      </div>
    );
  }

  return (
    <div className="tu-quiz">
      <div className="tu-quiz__tete">
        <span className="tu-quiz__numero">
          {t('compte', { n: s.mots.filter((m) => !m.refuse).length })}
        </span>
        {s.etape === 'chrono' && s.chrono_depart_ms !== null && s.chrono_duree_s !== null && (
          <ChronoQuestion
            departMs={s.chrono_depart_ms}
            dureeS={s.chrono_duree_s}
            decalageMs={decalageMs}
          />
        )}
      </div>
      <Sujet surenchere={s} />

      {peutTaper && (
        <form ref={formulaire} className="tu-mots__saisie" onSubmit={ajouter} noValidate>
          <TextField
            label={t('champ')}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            maxLength={LONGUEUR_MOT_MAX}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            {...(messageCourant ? { error: t(`refus.${messageCourant}`) } : {})}
          />
          {/* Le clavier reste ouvert : le bouton ne prend pas le focus au champ. */}
          <Button
            type="submit"
            variant="accent"
            size="lg"
            onMouseDown={(e) => e.preventDefault()}
            data-testid="ajouter-mot"
          >
            {t('ajouter')}
          </Button>
        </form>
      )}

      <p className="tu-quiz__statut" role="status" data-testid="statut-surenchere">
        {s.etape === 'sujet'
          ? s.capitaine
            ? t('pretCapitaine')
            : t('pret')
          : enCours
            ? s.capitaine
              ? null
              : t('coequipier')
            : perdus > 0
              ? t('perdus', { n: perdus })
              : t('fini')}
      </p>
      {s.etape === 'chrono' && liste}
    </div>
  );
}

/** Le thème en petit, le sujet en grand, dans la langue du téléphone. */
function Sujet({ surenchere: s }: { surenchere: SurenchereJoueur }) {
  return (
    <div className="tu-mots__sujet">
      {s.theme && <p className="tu-mots__theme">{s.theme}</p>}
      {s.sujet && (
        <h1 className="tu-quiz__question tu-quiz__question--compacte" data-testid="sujet">
          {s.sujet}
        </h1>
      )}
    </div>
  );
}

/**
 * Les mots de l'équipe, le dernier tapé en tête : ceux qui partent encore, puis ceux que la base a
 * gardés. Un mot rayé par l'animateur reste barré ; le capitaine peut retirer une faute de frappe.
 */
function ListeMots({
  mots,
  attente,
  retirer,
}: {
  mots: SurenchereJoueur['mots'];
  attente: string[];
  retirer: ((id: string) => void) | null;
}) {
  const t = useTranslations('surenchere');
  if (mots.length === 0 && attente.length === 0) return null;
  return (
    <ul className="tu-mots" aria-label={t('liste')} data-testid="mots-equipe">
      {[...attente].reverse().map((mot) => (
        <li key={`attente-${mot}`} className="tu-mots__mot tu-mots__mot--attente">
          {mot}
        </li>
      ))}
      {[...mots].reverse().map((m) => (
        <li key={m.id} className={cx('tu-mots__mot', m.refuse && 'tu-mots__mot--refuse')}>
          <span>{m.mot}</span>
          {retirer && !m.refuse && (
            <button
              type="button"
              className="tu-mots__retirer"
              aria-label={t('retirer', { mot: m.mot })}
              onClick={() => retirer(m.id)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
