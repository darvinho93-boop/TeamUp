-- Carte Team Up! : une soirée qui passe minuit reste sur la carte jusqu'à 6 h (heure de Paris),
-- tant qu'elle n'est pas close. Jusque-là, elle disparaissait à minuit, en pleine fête : un
-- invité qui scannait la carte ne trouvait plus la soirée qui se jouait sous ses yeux.

create or replace function public.soirees_du_jour() returns jsonb
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
    -- Le jour de la soirée, puis jusqu'à 6 h le lendemain.
    and e.date_evenement
      between ((now() at time zone 'Europe/Paris') - interval '6 hours')::date
          and (now() at time zone 'Europe/Paris')::date
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());
$$;

revoke execute on function public.soirees_du_jour() from public, anon, authenticated;
grant execute on function public.soirees_du_jour() to service_role;
