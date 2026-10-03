-- Back-office (lot 9).
--
-- Les tables et leurs policies existent depuis le lot 3 : l'admin écrit les banques de
-- contenus et les fiches animateurs, sous sa propre session. Ce lot ajoute :
--   * `enregistrer_contenu` : un contenu, ses traductions et ses secrets en une transaction,
--     avec la forme de chaque charge utile vérifiée en base ;
--   * `annuaire_animateurs` : les comptes avec leur e-mail (qui vit dans auth.users) ;
--   * un garde-fou : il reste toujours au moins un admin actif.
--
-- Langues (tranché le 2026-10-03) : le français est obligatoire, l'anglais et le tamoul
-- facultatifs. La préparation ne propose un contenu que s'il est complet dans toutes les
-- langues de la soirée.

-- ---------------------------------------------------------------------------
-- Forme d'un contenu, par jeu
-- ---------------------------------------------------------------------------

create function public.texte_rempli(p_valeur jsonb) returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_valeur) = 'string' and char_length(btrim(p_valeur #>> '{}')) between 1 and 300;
$$;

-- La forme documentée en tête de 20260922092000_contenus_et_secrets.sql, pour une langue.
-- Pour le quiz, `bonne` est vérifiée à part : elle doit être la même dans chaque langue.
create function public.contenu_bien_forme(p_jeu public.jeu, p_public jsonb, p_secret jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_jeu
    when 'list2' then
      public.texte_rempli(p_public -> 'consigne')
      and public.texte_rempli(p_secret -> 'reponse')
      and jsonb_typeof(p_secret -> 'indices') = 'array'
      and jsonb_array_length(p_secret -> 'indices') = 2
      and public.texte_rempli(p_secret -> 'indices' -> 0)
      and public.texte_rempli(p_secret -> 'indices' -> 1)
    when 'qcm2' then
      public.texte_rempli(p_public -> 'question')
      and jsonb_typeof(p_public -> 'propositions') = 'array'
      and jsonb_array_length(p_public -> 'propositions') = 4
      and public.texte_rempli(p_public -> 'propositions' -> 0)
      and public.texte_rempli(p_public -> 'propositions' -> 1)
      and public.texte_rempli(p_public -> 'propositions' -> 2)
      and public.texte_rempli(p_public -> 'propositions' -> 3)
      and jsonb_typeof(p_secret -> 'bonne') = 'number'
      and (p_secret ->> 'bonne') in ('0', '1', '2', '3')
    when 'enchere2' then
      public.texte_rempli(p_public -> 'theme') and public.texte_rempli(p_secret -> 'sujet')
    when 'mime2' then
      p_public = '{}'::jsonb and public.texte_rempli(p_secret -> 'mot')
    when 'photo2' then
      public.texte_rempli(p_public -> 'theme') and p_secret is null
    else false
  end
  -- Rien d'autre que les clés attendues : un secret ne se glisse pas dans la partie publique.
  and not exists (
    select 1 from jsonb_object_keys(p_public) k
    where k <> all (case p_jeu
      when 'list2' then array['consigne']
      when 'qcm2' then array['question', 'propositions']
      when 'enchere2' then array['theme']
      when 'photo2' then array['theme']
      else array[]::text[] end)
  );
$$;

-- ---------------------------------------------------------------------------
-- Enregistrer un contenu
-- ---------------------------------------------------------------------------

-- `p_langues` : {"fr": {"public": {...}, "secret": {...}}, "en": {...}}. Le français est
-- obligatoire ; une langue absente est retirée du contenu. `p_id` null crée le contenu.
-- `security invoker` : la RLS du lot 3 s'applique, seul un admin écrit les banques.
create function public.enregistrer_contenu(
  p_id uuid,
  p_jeu public.jeu,
  p_etiquette public.etiquette,
  p_langues jsonb
) returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_langue text;
  v_bloc jsonb;
  v_bonne text;
begin
  if not public.est_admin() then
    raise exception 'réservé aux admins' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_langues) is distinct from 'object' or not p_langues ? 'fr' then
    raise exception 'le français est obligatoire' using errcode = 'check_violation';
  end if;

  for v_langue, v_bloc in select * from jsonb_each(p_langues) loop
    if v_langue not in ('fr', 'en', 'ta') then
      raise exception 'langue inconnue : %', v_langue using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v_bloc -> 'public') is distinct from 'object'
      or not public.contenu_bien_forme(p_jeu, v_bloc -> 'public', v_bloc -> 'secret') then
      raise exception 'contenu mal formé (%)', v_langue using errcode = 'check_violation';
    end if;
    if p_jeu = 'qcm2' then
      if v_bonne is not null and v_bonne <> (v_bloc -> 'secret' ->> 'bonne') then
        raise exception 'la bonne réponse diffère selon la langue' using errcode = 'check_violation';
      end if;
      v_bonne := v_bloc -> 'secret' ->> 'bonne';
    end if;
  end loop;

  if v_id is null then
    insert into public.contenus (jeu, etiquette, cree_par)
    values (p_jeu, p_etiquette, (select auth.uid()))
    returning id into v_id;
  else
    -- Le jeu d'un contenu ne change pas : ses passages en dépendent.
    update public.contenus c set etiquette = p_etiquette
    where c.id = v_id and c.jeu = p_jeu;
    if not found then
      raise exception 'contenu introuvable' using errcode = 'no_data_found';
    end if;
  end if;

  delete from public.contenus_traductions t
  where t.contenu_id = v_id and not p_langues ? t.langue::text;
  delete from public.contenus_secrets s
  where s.contenu_id = v_id and not p_langues ? s.langue::text;

  insert into public.contenus_traductions (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'public'
  from jsonb_each(p_langues) l
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  insert into public.contenus_secrets (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'secret'
  from jsonb_each(p_langues) l
  where p_jeu <> 'photo2'
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Annuaire des animateurs
-- ---------------------------------------------------------------------------

-- L'e-mail vit dans auth.users, qu'aucune session ne lit : `security definer`, réservé à
-- l'admin. Un animateur qui l'appelle ne reçoit rien.
create function public.annuaire_animateurs()
returns table (
  id uuid,
  nom text,
  email text,
  role public.role_animateur,
  actif boolean,
  cree_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.nom, u.email::text, a.role, a.actif, a.cree_le
  from public.animateurs a
  join auth.users u on u.id = a.id
  where public.est_admin()
  order by a.actif desc, a.nom;
$$;

-- ---------------------------------------------------------------------------
-- Toujours un admin actif
-- ---------------------------------------------------------------------------

-- Sans lui, plus personne ne pourrait créer de compte ni réactiver qui que ce soit.
create function public.garder_un_admin() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.animateurs a where a.role = 'admin' and a.actif
  ) then
    raise exception 'il faut au moins un admin actif' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger animateurs_garder_un_admin
  after update of role, actif on public.animateurs
  deferrable initially immediate
  for each row
  when (old.role = 'admin' and old.actif and (new.role <> 'admin' or not new.actif))
  execute function public.garder_un_admin();

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke execute on function
  public.enregistrer_contenu(uuid, public.jeu, public.etiquette, jsonb),
  public.annuaire_animateurs()
  from public, anon;

grant execute on function
  public.enregistrer_contenu(uuid, public.jeu, public.etiquette, jsonb),
  public.annuaire_animateurs()
  to authenticated;

revoke execute on function public.garder_un_admin() from public, anon, authenticated;
