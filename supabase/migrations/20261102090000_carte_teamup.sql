-- Carte Team Up! : un seul QR code, imprimé, qui liste les soirées du jour (2026-11-01).
--
-- Une soirée n'y paraît que si l'animateur l'a cochée et lui a donné un titre public, le jour
-- même (heure de Paris), tant qu'elle n'est pas clôturée. Rien d'autre ne sort : ni le client,
-- ni le lieu, ni l'animateur. Le code d'une soirée cochée devient visible de qui a la carte,
-- ce jour-là : écart assumé, la Salle permet de retirer un intrus.

alter table public.evenements
  add column carte_visible boolean not null default false,
  add column titre_public text,
  add constraint evenements_titre_public_check
    check (titre_public is null or char_length(btrim(titre_public)) between 1 and 60);

comment on column public.evenements.carte_visible is
  'La soirée paraît, le jour même, sur la page de la carte Team Up! (/soirees).';
comment on column public.evenements.titre_public is
  'Titre affiché sur la carte Team Up!, rédigé par l''animateur (jamais le nom du client).';

-- Appelée par le serveur de l'app (rôle de service) pour la page /soirees.
create function public.soirees_du_jour() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', e.code,
        'titre', btrim(e.titre_public),
        'langues', e.langues,
        'statut', e.statut,
        'programme', coalesce((
          select jsonb_agg(m.jeu order by m.ordre)
          from public.manches m
          where m.evenement_id = e.id and m.statut <> 'annulee'
        ), '[]'::jsonb)
      )
      order by (e.statut = 'en_cours') desc, btrim(e.titre_public)
    ),
    '[]'::jsonb
  )
  from public.evenements e
  where e.carte_visible
    and e.titre_public is not null
    and e.date_evenement = (now() at time zone 'Europe/Paris')::date
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());
$$;

revoke execute on function public.soirees_du_jour() from public, anon, authenticated;
grant execute on function public.soirees_du_jour() to service_role;
