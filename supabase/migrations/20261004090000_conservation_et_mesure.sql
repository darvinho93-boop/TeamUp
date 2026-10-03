-- Conservation des photos et mesure (lot 10).
--
-- Conservation (tranché le 2026-10-03) : 30 jours après la soirée. Une photo expire le
-- 31e jour à minuit (UTC), quelle que soit l'heure de son envoi ; la purge quotidienne de
-- l'app (`/api/cron/purge-photos`) retire alors le fichier du bucket puis sa ligne.
--
-- Mesure (cahier des charges § 7, taux de connexion des invités) : le nombre d'invités
-- attendus, facultatif, saisi à la création de la soirée.

-- ---------------------------------------------------------------------------
-- Expiration des photos
-- ---------------------------------------------------------------------------

create function public.expiration_photo(p_evenement uuid) returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (e.date_evenement + 31)::timestamp at time zone 'UTC'
  from public.evenements e
  where e.id = p_evenement;
$$;

create function public.poser_expiration_photo() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.expire_le := public.expiration_photo(new.evenement_id);
  return new;
end;
$$;

create trigger photos_expiration
  before insert on public.photos
  for each row
  execute function public.poser_expiration_photo();

-- Une soirée déplacée déplace l'expiration de ses photos.
create function public.reporter_expiration_photos() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.photos ph
  set expire_le = public.expiration_photo(new.id)
  where ph.evenement_id = new.id;
  return null;
end;
$$;

create trigger evenements_expiration_photos
  after update of date_evenement on public.evenements
  for each row
  when (new.date_evenement is distinct from old.date_evenement)
  execute function public.reporter_expiration_photos();

update public.photos ph set expire_le = public.expiration_photo(ph.evenement_id);

alter table public.photos alter column expire_le set not null;

create index photos_expiration_idx on public.photos (expire_le);

comment on column public.photos.expire_le is
  'Conservation : 30 jours après la soirée (tranché le 2026-10-03), posée par déclencheur.';

-- ---------------------------------------------------------------------------
-- Invités attendus
-- ---------------------------------------------------------------------------

alter table public.evenements
  add column invites_attendus integer check (invites_attendus between 1 and 1000);

comment on column public.evenements.invites_attendus is
  'Facultatif : sert au taux de connexion des invités (joueurs inscrits ÷ attendus).';

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke execute on function
  public.poser_expiration_photo(),
  public.reporter_expiration_photos()
  from public, anon, authenticated;
