import { useTranslations } from 'next-intl';
import { IconeInstagram } from '@/marque/IconeInstagram';
import { INSTAGRAM } from '@/marque/instagram';
import { Fleche } from './decor';
import { DEVIS_DEPUIS_CARTE } from './liens';

/**
 * L'onglet « Qui sommes-nous » de la carte Team Up! (`/soirees/qui-sommes-nous`). Ses textes
 * reprennent la vidéo de présentation de Team Up! (« Notre histoire », 2026-11-02) : l'idée
 * née en famille, ce qu'on y fait, l'équipe ; puis Instagram, et le devis pour qui veut sa
 * propre soirée (provenance `carte`).
 */
export function QuiSommesNous() {
  const t = useTranslations('carte');

  return (
    <div className="tu-player__body tu-carte" data-testid="qui-sommes-nous">
      <section className="tu-carte-section" aria-labelledby="titre-nous">
        <h1 className="tu-carte-section__titre tu-carte-section__titre--page" id="titre-nous">
          {t('nousTitre')}
        </h1>
        <p className="tu-carte-texte">{t('nousHistoire')}</p>
        <p className="tu-carte-citation">{t('nousAnimation')}</p>
        <p className="tu-carte-texte">{t('nousEquipe')}</p>
      </section>

      <div className="tu-carte-encart tu-carte-encart--marine">
        <p className="tu-carte-encart__texte">{t('nousSuite')}</p>
        <a
          className="tu-carte-insta"
          href={INSTAGRAM.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconeInstagram className="tu-carte-insta__icone" />
          {INSTAGRAM.pseudo}
        </a>
      </div>

      <div className="tu-carte-encart">
        <p className="tu-carte-encart__titre">{t('nousOrganiser')}</p>
        <a className="tu-btn tu-btn--accent tu-btn--lg tu-btn--block" href={DEVIS_DEPUIS_CARTE}>
          {t('devis')}
          <Fleche />
        </a>
      </div>
    </div>
  );
}
