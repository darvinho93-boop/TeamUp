import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Demande } from './schema';

const send = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const { envoyerDevis } = await import('./send');

const demande: Demande = {
  type: 'particulier',
  occasion: 'Mariage',
  date: '2026-11-14',
  lieu: 'Strasbourg',
  invites: 80,
  nom: 'Camille Martin',
  tel: '06 12 34 56 78',
  email: 'camille@exemple.fr',
  societe: undefined,
  creneau: undefined,
  groupes: undefined,
  langues: ['fr'],
  equipement: [],
  message: undefined,
  consentement: true,
};

const config = {
  apiKey: 're_test',
  destinataire: 'equipe@exemple.fr',
  expediteur: 'Team Up! <devis@exemple.fr>',
};

beforeEach(() => {
  send.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('envoyerDevis', () => {
  it("envoie la demande à l'équipe, puis l'accusé au prospect", async () => {
    send.mockResolvedValue({ data: { id: '1' }, error: null });

    expect(await envoyerDevis(demande, config)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      from: config.expediteur,
      to: 'equipe@exemple.fr',
      replyTo: 'camille@exemple.fr',
    });
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      to: 'camille@exemple.fr',
      replyTo: 'equipe@exemple.fr',
      subject: 'Votre demande de devis Team Up!',
    });
  });

  it("échoue si la demande n'arrive pas à l'équipe, sans envoyer d'accusé", async () => {
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'x' } });

    expect(await envoyerDevis(demande, config)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("réussit même si seul l'accusé de réception échoue", async () => {
    send
      .mockResolvedValueOnce({ data: { id: '1' }, error: null })
      .mockRejectedValueOnce(new Error('réseau'));

    expect(await envoyerDevis(demande, config)).toBe(true);
  });

  it("n'appelle pas Resend sans clé et écrit les e-mails dans la console", async () => {
    expect(await envoyerDevis(demande, {})).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(2);
  });

  it('échoue si la clé est là mais pas les adresses', async () => {
    expect(await envoyerDevis(demande, { apiKey: 're_test' })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
