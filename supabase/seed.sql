-- Données de démo — base locale et tests uniquement, jamais en production.
--
-- Deux soirées : FETE24 (un mariage, six équipes, en cours) sert de terrain aux lots 5 et 6 ;
-- BUREAU (un séminaire, autre animateur) sert à vérifier qu'un animateur ne voit pas les
-- événements des autres.
--
-- Les jetons de session des joueurs sont déterministes : le joueur n° N a pour jeton
-- « demo-joueur-N », et la base n'en stocke que le SHA-256. Les tests s'appuient dessus.

-- ---------------------------------------------------------------------------
-- Comptes (mot de passe : motdepasse)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'admin@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'anna@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'brahim@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u;

insert into public.animateurs (id, nom, role) values
  ('11111111-1111-4111-8111-111111111111', 'Admin Team Up!', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'Anna', 'animateur'),
  ('33333333-3333-4333-8333-333333333333', 'Brahim', 'animateur');

-- ---------------------------------------------------------------------------
-- Banques de contenus (fr / en / ta), avec leurs secrets
-- ---------------------------------------------------------------------------

insert into public.contenus (id, jeu, etiquette, cree_par) values
  ('aaaa0001-0000-4000-8000-000000000001', 'list2', 'b2c', '11111111-1111-4111-8111-111111111111'),
  ('aaaa0002-0000-4000-8000-000000000002', 'qcm2', 'tout_public', '11111111-1111-4111-8111-111111111111'),
  ('aaaa0003-0000-4000-8000-000000000003', 'enchere2', 'tout_public', '11111111-1111-4111-8111-111111111111'),
  ('aaaa0004-0000-4000-8000-000000000004', 'mime2', 'tout_public', '11111111-1111-4111-8111-111111111111'),
  ('aaaa0005-0000-4000-8000-000000000005', 'photo2', 'b2c', '11111111-1111-4111-8111-111111111111'),
  ('aaaa0006-0000-4000-8000-000000000006', 'photo2', 'b2c', '11111111-1111-4111-8111-111111111111');

insert into public.contenus_traductions (contenu_id, langue, valeur) values
  ('aaaa0001-0000-4000-8000-000000000001', 'fr', '{"consigne": "Levez-vous si ça vous concerne."}'),
  ('aaaa0001-0000-4000-8000-000000000001', 'en', '{"consigne": "Stand up if this is about you."}'),
  ('aaaa0001-0000-4000-8000-000000000001', 'ta', '{"consigne": "உங்களுக்குப் பொருந்தினால் எழுந்திருங்கள்."}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'fr',
   '{"question": "Quelle est la capitale du Sri Lanka ?", "propositions": ["Colombo", "Kandy", "Jaffna", "Sri Jayawardenepura Kotte"]}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'en',
   '{"question": "What is the capital of Sri Lanka?", "propositions": ["Colombo", "Kandy", "Jaffna", "Sri Jayawardenepura Kotte"]}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'ta',
   '{"question": "இலங்கையின் தலைநகரம் எது?", "propositions": ["கொழும்பு", "கண்டி", "யாழ்ப்பாணம்", "ஸ்ரீ ஜெயவர்தனபுர கோட்டே"]}'),
  ('aaaa0003-0000-4000-8000-000000000003', 'fr', '{"theme": "Les mariés"}'),
  ('aaaa0003-0000-4000-8000-000000000003', 'en', '{"theme": "The newlyweds"}'),
  ('aaaa0003-0000-4000-8000-000000000003', 'ta', '{"theme": "மணமக்கள்"}'),
  -- Le mime n'a aucune partie publique : le mot ne s'affiche nulle part.
  ('aaaa0004-0000-4000-8000-000000000004', 'fr', '{}'),
  ('aaaa0004-0000-4000-8000-000000000004', 'en', '{}'),
  ('aaaa0004-0000-4000-8000-000000000004', 'ta', '{}'),
  ('aaaa0005-0000-4000-8000-000000000005', 'fr', '{"theme": "La photo la plus mal cadrée"}'),
  ('aaaa0005-0000-4000-8000-000000000005', 'en', '{"theme": "The worst framed photo"}'),
  ('aaaa0005-0000-4000-8000-000000000005', 'ta', '{"theme": "மோசமான சட்டகப் புகைப்படம்"}'),
  ('aaaa0006-0000-4000-8000-000000000006', 'fr', '{"theme": "Toute l''équipe dans le cadre"}'),
  ('aaaa0006-0000-4000-8000-000000000006', 'en', '{"theme": "The whole team in frame"}'),
  ('aaaa0006-0000-4000-8000-000000000006', 'ta', '{"theme": "முழு அணியும் சட்டகத்தில்"}');

insert into public.contenus_secrets (contenu_id, langue, valeur) values
  ('aaaa0001-0000-4000-8000-000000000001', 'fr',
   '{"reponse": "les personnes qui ont dansé au mariage", "indices": ["C''était hier soir", "Il y avait de la musique"]}'),
  ('aaaa0001-0000-4000-8000-000000000001', 'en',
   '{"reponse": "people who danced at the wedding", "indices": ["It was last night", "There was music"]}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'fr', '{"bonne": 3}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'en', '{"bonne": 3}'),
  ('aaaa0002-0000-4000-8000-000000000002', 'ta', '{"bonne": 3}'),
  ('aaaa0003-0000-4000-8000-000000000003', 'fr', '{"sujet": "citer des chansons de mariage"}'),
  ('aaaa0003-0000-4000-8000-000000000003', 'en', '{"sujet": "name wedding songs"}'),
  ('aaaa0004-0000-4000-8000-000000000004', 'fr', '{"mot": "éléphant"}'),
  ('aaaa0004-0000-4000-8000-000000000004', 'en', '{"mot": "elephant"}'),
  ('aaaa0004-0000-4000-8000-000000000004', 'ta', '{"mot": "யானை"}');

-- ---------------------------------------------------------------------------
-- Soirée FETE24 — six équipes, en cours
-- ---------------------------------------------------------------------------

insert into public.evenements (
  id, code, animateur_id, client_nom, type_client, occasion, date_evenement, lieu,
  creneau_minutes, langues, statut, commence_le
) values (
  'eeee0001-0000-4000-8000-000000000001', 'FETE24',
  '22222222-2222-4222-8222-222222222222', 'Famille Rajan', 'particulier', 'Mariage',
  current_date, 'Strasbourg', 60, '{fr,en,ta}'::public.langue[], 'en_cours', now()
);

insert into public.equipes (id, evenement_id, numero, nom) values
  ('11100001-0000-4000-8000-000000000001', 'eeee0001-0000-4000-8000-000000000001', 1, 'Les Navy'),
  ('11100002-0000-4000-8000-000000000002', 'eeee0001-0000-4000-8000-000000000001', 2, 'Les Corail'),
  ('11100003-0000-4000-8000-000000000003', 'eeee0001-0000-4000-8000-000000000001', 3, 'Les Sauge'),
  ('11100004-0000-4000-8000-000000000004', 'eeee0001-0000-4000-8000-000000000001', 4, 'Les Ambre'),
  ('11100005-0000-4000-8000-000000000005', 'eeee0001-0000-4000-8000-000000000001', 5, 'Les Prune'),
  ('11100006-0000-4000-8000-000000000006', 'eeee0001-0000-4000-8000-000000000001', 6, 'Les Turquoise');

-- Dix-huit joueurs, trois par équipe. Jeton du joueur n° N : « demo-joueur-N ».
do $$
declare
  v_prenoms text[] := array[
    'Ravi', 'Léa', 'Sam', 'Nadia', 'Tom', 'Priya', 'Hugo', 'Mina', 'Karim',
    'Zoé', 'Ana', 'Yanis', 'Lina', 'Marc', 'Esha', 'Paul', 'Fatou', 'Jean'
  ];
  v_langues public.langue[] := array['fr', 'ta', 'en']::public.langue[];
  i integer;
begin
  for i in 1..18 loop
    insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash, capitaine)
    values (
      'eeee0001-0000-4000-8000-000000000001',
      ('1110000' || ((i - 1) / 3 + 1) || '-0000-4000-8000-00000000000' || ((i - 1) / 3 + 1))::uuid,
      v_prenoms[i],
      v_langues[((i - 1) % 3) + 1],
      encode(extensions.digest('demo-joueur-' || i, 'sha256'), 'hex'),
      -- Le premier de chaque équipe en est le capitaine.
      (i - 1) % 3 = 0
    );
  end loop;
end;
$$;

-- Programme : les cinq jeux socles, dans l'ordre de la spec v3.
insert into public.manches (id, evenement_id, jeu, ordre, options, statut) values
  ('ba000001-0000-4000-8000-000000000001', 'eeee0001-0000-4000-8000-000000000001', 'list2', 1,
   '{"passages_par_equipe": 1}', 'terminee'),
  ('ba000002-0000-4000-8000-000000000002', 'eeee0001-0000-4000-8000-000000000001', 'qcm2', 2,
   '{"mode": "croix", "questions": 4}', 'terminee'),
  ('ba000003-0000-4000-8000-000000000003', 'eeee0001-0000-4000-8000-000000000001', 'enchere2', 3,
   '{"themes": 3}', 'a_venir'),
  ('ba000004-0000-4000-8000-000000000004', 'eeee0001-0000-4000-8000-000000000001', 'mime2', 4,
   '{"maillons_max": 6}', 'en_cours'),
  ('ba000005-0000-4000-8000-000000000005', 'eeee0001-0000-4000-8000-000000000001', 'photo2', 5,
   '{"themes": 2}', 'a_venir');

-- Le passage de mime en cours : seul Ravi (joueur n° 1, jeton « demo-joueur-1 ») voit le mot.
insert into public.passages (
  id, manche_id, evenement_id, equipe_id, ordre, contenu_id, joueur_designe_id, statut, commence_le
)
select
  'a5000001-0000-4000-8000-000000000001', 'ba000004-0000-4000-8000-000000000004',
  'eeee0001-0000-4000-8000-000000000001', '11100001-0000-4000-8000-000000000001', 1,
  'aaaa0004-0000-4000-8000-000000000004', j.id, 'en_cours', now()
from public.joueurs j
where j.evenement_id = 'eeee0001-0000-4000-8000-000000000001'
  and j.jeton_hash = encode(extensions.digest('demo-joueur-1', 'sha256'), 'hex');

-- Le passage suivant attend son tour : son secret ne doit sortir pour personne.
insert into public.passages (
  id, manche_id, evenement_id, equipe_id, ordre, contenu_id, joueur_designe_id, statut
)
select
  'a5000002-0000-4000-8000-000000000002', 'ba000004-0000-4000-8000-000000000004',
  'eeee0001-0000-4000-8000-000000000001', '11100002-0000-4000-8000-000000000002', 2,
  'aaaa0004-0000-4000-8000-000000000004', j.id, 'a_venir'
from public.joueurs j
where j.evenement_id = 'eeee0001-0000-4000-8000-000000000001'
  and j.jeton_hash = encode(extensions.digest('demo-joueur-4', 'sha256'), 'hex');

insert into public.scores (evenement_id, equipe_id, manche_id, points, motif, saisi_par) values
  ('eeee0001-0000-4000-8000-000000000001', '11100001-0000-4000-8000-000000000001',
   'ba000001-0000-4000-8000-000000000001', 285, 'Points communs, premier palier',
   '22222222-2222-4222-8222-222222222222'),
  ('eeee0001-0000-4000-8000-000000000001', '11100002-0000-4000-8000-000000000002',
   'ba000001-0000-4000-8000-000000000001', 140, 'Points communs, deuxième palier',
   '22222222-2222-4222-8222-222222222222'),
  ('eeee0001-0000-4000-8000-000000000001', '11100001-0000-4000-8000-000000000001',
   'ba000002-0000-4000-8000-000000000002', 300, 'Quiz, 3 survivants',
   '22222222-2222-4222-8222-222222222222'),
  ('eeee0001-0000-4000-8000-000000000001', '11100003-0000-4000-8000-000000000003',
   'ba000002-0000-4000-8000-000000000002', 200, 'Quiz, 2 survivants',
   '22222222-2222-4222-8222-222222222222');

-- ---------------------------------------------------------------------------
-- Soirée BUREAU — autre animateur, sert aux tests d'isolation
-- ---------------------------------------------------------------------------

insert into public.evenements (
  id, code, animateur_id, client_nom, type_client, occasion, date_evenement, lieu,
  creneau_minutes, langues, statut
) values (
  'eeee0002-0000-4000-8000-000000000002', 'BUREAU',
  '33333333-3333-4333-8333-333333333333', 'ACME', 'entreprise', 'Séminaire',
  current_date + 7, 'Lyon', 40, '{fr,en}'::public.langue[], 'preparation'
);

insert into public.equipes (id, evenement_id, numero, nom) values
  ('11200001-0000-4000-8000-000000000101', 'eeee0002-0000-4000-8000-000000000002', 1, 'Produit'),
  ('11200002-0000-4000-8000-000000000102', 'eeee0002-0000-4000-8000-000000000002', 2, 'Support');

insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash) values
  ('eeee0002-0000-4000-8000-000000000002', '11200001-0000-4000-8000-000000000101',
   'Claire', 'fr', encode(extensions.digest('demo-autre-evenement', 'sha256'), 'hex'));
