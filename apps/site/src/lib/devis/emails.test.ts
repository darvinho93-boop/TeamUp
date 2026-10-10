import { describe, expect, it } from 'vitest';
import { dateLongue, emailAccuse, emailEquipe } from './emails';
import type { Demande } from './schema';

const demande: Demande = {
  type: 'entreprise',
  occasion: 'Séminaire',
  date: '2026-11-14',
  lieu: 'Lyon',
  invites: 120,
  nom: 'Camille Martin',
  tel: '06 12 34 56 78',
  email: 'camille@exemple.fr',
  societe: 'ACME',
  creneau: '60 minutes',
  groupes: undefined,
  langues: ['fr', 'en'],
  equipement: [],
  message: undefined,
  consentement: true,
};

describe('dateLongue', () => {
  it('écrit la date en toutes lettres', () => {
    expect(dateLongue('2026-11-14')).toBe('samedi 14 novembre 2026');
  });
});

describe('emailEquipe', () => {
  it("résume la demande dans l'objet", () => {
    expect(emailEquipe(demande).subject).toBe(
      'Devis : Séminaire, samedi 14 novembre 2026, 120 invités — Camille Martin (ACME)',
    );
  });

  it('liste les champs remplis et omet les vides', () => {
    const { text } = emailEquipe(demande);
    expect(text).toContain('Société : ACME');
    expect(text).toContain('Langues : Français, English');
    expect(text).not.toContain('Groupes à mélanger');
    expect(text).not.toContain('Équipement');
    expect(text).not.toContain('Message');
  });

  it("n'affiche pas « Je ne sais pas encore » comme un créneau", () => {
    const { text } = emailEquipe({ ...demande, creneau: 'Je ne sais pas encore' });
    expect(text).not.toContain('Créneau');
  });

  it('échappe le HTML saisi et garde les retours à la ligne du message', () => {
    const { html } = emailEquipe({ ...demande, message: '<script>alert(1)</script>\nMerci' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>Merci');
  });

  it("garde l'objet sur une seule ligne", () => {
    expect(emailEquipe({ ...demande, nom: 'Camille\r\nBcc: x@y.z' }).subject).not.toMatch(/[\r\n]/);
  });
});

describe('emailAccuse', () => {
  it('remercie, annonce le rappel et reprend la demande', () => {
    const { subject, text } = emailAccuse(demande);
    expect(subject).toBe('Votre demande de devis Team Up!');
    expect(text).toContain('Nous vous rappelons sous 48 heures');
    expect(text).toContain('Occasion : Séminaire');
  });
});
