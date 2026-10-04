import { CRENEAUX, EQUIPEMENTS, LANGUES, TYPE_LABELS } from './options';
import type { Demande } from './schema';

export interface Email {
  subject: string;
  text: string;
  html: string;
}

type Ligne = readonly [libelle: string, valeur: string | undefined];

/** Date longue en français : « samedi 14 novembre 2026 ». */
export function dateLongue(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function recapitulatif(demande: Demande): Ligne[] {
  const libellesDe = <T extends { id: string; label: string }>(
    liste: readonly T[],
    ids: string[],
  ) =>
    liste
      .filter((option) => ids.includes(option.id))
      .map((option) => option.label)
      .join(', ') || undefined;

  return [
    ['Type', TYPE_LABELS[demande.type]],
    ['Occasion', demande.occasion],
    ['Date', dateLongue(demande.date)],
    ['Ville ou lieu', demande.lieu],
    ["Nombre d'invités", String(demande.invites)],
    ['Nom', demande.nom],
    ['Téléphone', demande.tel],
    ['E-mail', demande.email],
    ['Société', demande.societe],
    ['Créneau', demande.creneau === CRENEAUX[0] ? undefined : demande.creneau],
    ['Groupes à mélanger', demande.groupes],
    ['Langues', libellesDe(LANGUES, demande.langues)],
    ['Équipement de la salle', libellesDe(EQUIPEMENTS, demande.equipement)],
    ['Message', demande.message],
  ];
}

const remplies = (lignes: Ligne[]) =>
  lignes.filter((ligne): ligne is readonly [string, string] => Boolean(ligne[1]));

function enTexte(lignes: Ligne[]): string {
  return remplies(lignes)
    .map(([libelle, valeur]) => `${libelle} : ${valeur}`)
    .join('\n');
}

function enHtml(lignes: Ligne[]): string {
  const rangees = remplies(lignes)
    .map(
      ([libelle, valeur]) =>
        `<tr><th align="left" valign="top">${echapper(libelle)}</th><td>${echapper(valeur).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');
  return `<table cellpadding="6">${rangees}</table>`;
}

export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pour Team Up! : tout le détail, prêt à être rappelé. On y répond directement au prospect. */
export function emailEquipe(demande: Demande): Email {
  const lignes = recapitulatif(demande);
  const qui = demande.societe ? `${demande.nom} (${demande.societe})` : demande.nom;
  const subject = `Devis : ${demande.occasion}, ${dateLongue(demande.date)}, ${demande.invites} invités — ${qui}`;

  return {
    // Une seule ligne : aucun retour à la ligne saisi ne doit atteindre les en-têtes.
    subject: subject.replace(/\s+/g, ' '),
    text: `Nouvelle demande de devis.\n\n${enTexte(lignes)}\n`,
    html: `<p>Nouvelle demande de devis.</p>${enHtml(lignes)}`,
  };
}

/** Pour le prospect : accusé de réception et rappel de ce qu'il a envoyé. */
export function emailAccuse(demande: Demande): Email {
  const lignes = recapitulatif(demande);
  const intro = [
    'Bonjour,',
    'Merci pour votre demande, elle est bien arrivée. On vous rappelle sous [DÉLAI] pour faire connaissance et parler de votre événement.',
    'Pour rappel, voici ce que vous nous avez indiqué :',
  ];
  const fin = "À très vite,\nL'équipe Team Up!";

  return {
    subject: 'Votre demande de devis Team Up!',
    text: `${intro.join('\n\n')}\n\n${enTexte(lignes)}\n\n${fin}\n`,
    html: `${intro.map((p) => `<p>${echapper(p)}</p>`).join('')}${enHtml(lignes)}<p>${echapper(fin).replace('\n', '<br>')}</p>`,
  };
}
