import { Zip, ZipPassThrough } from 'fflate';
import { cheminDansLeZip } from '@/lib/export';
import { evenementDeLaRegie } from '@/serveur/regie';

/**
 * Les photos de la soirée en ZIP (lot 10) : un dossier par thème, la gagnante marquée. Lues
 * dans le bucket sous la session de l'animateur (policy du lot 3). Le ZIP part en flux, photo
 * par photo, sans recompression (un JPEG ne gagne rien à l'être) : la mémoire reste basse
 * quelle que soit la taille de la soirée. Passé 30 jours, les photos sont purgées et le ZIP
 * est vide.
 */
export async function GET(_: Request, { params }: RouteContext<'/regie/[code]/export/photos.zip'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const langue = evenement.langues[0] ?? 'fr';

  const [{ data: photos }, { data: equipes }, { data: themes }] = await Promise.all([
    supabase
      .from('photos')
      .select('chemin, gagnante, equipe_id, theme_id')
      .eq('evenement_id', evenement.id),
    supabase.from('equipes').select('id, numero, nom').eq('evenement_id', evenement.id),
    supabase
      .from('passages')
      .select(
        'ordre, contenu_id, manches!inner(jeu), contenus(contenus_traductions(langue, valeur))',
      )
      .eq('evenement_id', evenement.id)
      .eq('manches.jeu', 'photo2')
      .order('ordre'),
  ]);

  const equipe = new Map((equipes ?? []).map((e) => [e.id, e]));
  const theme = new Map(
    (themes ?? []).map((p) => {
      const traductions = p.contenus?.contenus_traductions ?? [];
      const valeur = (
        traductions.find((x) => x.langue === langue) ?? traductions.find((x) => x.langue === 'fr')
      )?.valeur as { theme?: string } | undefined;
      return [p.contenu_id, { ordre: p.ordre, texte: valeur?.theme ?? '' }];
    }),
  );

  const flux = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((erreur, morceau, fini) => {
        if (erreur) return controller.error(erreur);
        controller.enqueue(morceau);
        if (fini) controller.close();
      });
      for (const ph of photos ?? []) {
        const eq = equipe.get(ph.equipe_id);
        const th = theme.get(ph.theme_id);
        const { data: fichier } = await supabase.storage.from('photos').download(ph.chemin);
        if (!eq || !th || !fichier) continue;
        const entree = new ZipPassThrough(
          cheminDansLeZip({
            ordreTheme: th.ordre,
            theme: th.texte,
            equipeNumero: eq.numero,
            equipeNom: eq.nom,
            gagnante: ph.gagnante,
          }),
        );
        zip.add(entree);
        entree.push(new Uint8Array(await fichier.arrayBuffer()), true);
      }
      zip.end();
    },
  });

  return new Response(flux, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="photos-${evenement.code}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
