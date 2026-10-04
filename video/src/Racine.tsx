import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import { Composition } from 'remotion';
import { DUREE_TOTALE, Presentation } from './Presentation';
import { FORMAT } from './theme';

export function Racine() {
  return (
    <Composition
      id="Presentation"
      component={Presentation}
      durationInFrames={DUREE_TOTALE}
      fps={FORMAT.ips}
      width={FORMAT.largeur}
      height={FORMAT.hauteur}
    />
  );
}
