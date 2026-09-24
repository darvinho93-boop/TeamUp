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

-- Les colonnes de jetons doivent être vides plutôt que nulles : GoTrue les lit comme des
-- chaînes et refuse la connexion sur un NULL (« converting NULL to string is unsupported »).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'admin@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'anna@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'brahim@teamup.test',
   extensions.crypt('motdepasse', extensions.gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');

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

-- Assez de contenus pour jouer une partie complète de démo (lot 6) : un point commun par
-- équipe de FETE24, et quatre thèmes de surenchère. Tamoul : premier jet, à faire relire.
insert into public.contenus (id, jeu, etiquette, cree_par)
select v.id::uuid, v.jeu::public.jeu, 'tout_public', '11111111-1111-4111-8111-111111111111'
from (values
  ('aaaa0101-0000-4000-8000-000000000101', 'list2'),
  ('aaaa0102-0000-4000-8000-000000000102', 'list2'),
  ('aaaa0103-0000-4000-8000-000000000103', 'list2'),
  ('aaaa0104-0000-4000-8000-000000000104', 'list2'),
  ('aaaa0105-0000-4000-8000-000000000105', 'list2'),
  ('aaaa0201-0000-4000-8000-000000000201', 'enchere2'),
  ('aaaa0202-0000-4000-8000-000000000202', 'enchere2'),
  ('aaaa0203-0000-4000-8000-000000000203', 'enchere2')
) as v (id, jeu);

insert into public.contenus_traductions (contenu_id, langue, valeur)
select c.id, l.langue::public.langue, case c.jeu
  when 'list2' then jsonb_build_object('consigne', case l.langue
    when 'fr' then 'Levez-vous si ça vous concerne.'
    when 'en' then 'Stand up if this is about you.'
    else 'உங்களுக்குப் பொருந்தினால் எழுந்திருங்கள்.' end)
  else '{}'::jsonb end
from public.contenus c
cross join (values ('fr'), ('en'), ('ta')) as l (langue)
where c.id::text like 'aaaa01%' or c.id::text like 'aaaa02%';

-- Thèmes de surenchère : la partie publique.
update public.contenus_traductions t set valeur = jsonb_build_object('theme', v.theme)
from (values
  ('aaaa0201-0000-4000-8000-000000000201', 'fr', 'La cuisine'),
  ('aaaa0201-0000-4000-8000-000000000201', 'en', 'Cooking'),
  ('aaaa0201-0000-4000-8000-000000000201', 'ta', 'சமையல்'),
  ('aaaa0202-0000-4000-8000-000000000202', 'fr', 'Les voyages'),
  ('aaaa0202-0000-4000-8000-000000000202', 'en', 'Travel'),
  ('aaaa0202-0000-4000-8000-000000000202', 'ta', 'பயணங்கள்'),
  ('aaaa0203-0000-4000-8000-000000000203', 'fr', 'Le cinéma'),
  ('aaaa0203-0000-4000-8000-000000000203', 'en', 'Movies'),
  ('aaaa0203-0000-4000-8000-000000000203', 'ta', 'திரைப்படங்கள்')
) as v (id, langue, theme)
where t.contenu_id = v.id::uuid and t.langue = v.langue::public.langue;

insert into public.contenus_secrets (contenu_id, langue, valeur)
select v.id::uuid, v.langue::public.langue, v.valeur::jsonb
from (values
  ('aaaa0101-0000-4000-8000-000000000101', 'fr', '{"reponse": "les personnes qui portent des lunettes", "indices": ["Regardez les visages", "Ça aide à voir"]}'),
  ('aaaa0101-0000-4000-8000-000000000101', 'en', '{"reponse": "people wearing glasses", "indices": ["Look at their faces", "It helps them see"]}'),
  ('aaaa0101-0000-4000-8000-000000000101', 'ta', '{"reponse": "கண்ணாடி அணிந்தவர்கள்", "indices": ["முகங்களைப் பாருங்கள்", "பார்க்க உதவும்"]}'),
  ('aaaa0102-0000-4000-8000-000000000102', 'fr', '{"reponse": "les personnes nées en été", "indices": ["C''est une question de date", "Il faisait chaud"]}'),
  ('aaaa0102-0000-4000-8000-000000000102', 'en', '{"reponse": "people born in summer", "indices": ["It is about a date", "It was hot"]}'),
  ('aaaa0102-0000-4000-8000-000000000102', 'ta', '{"reponse": "கோடையில் பிறந்தவர்கள்", "indices": ["இது ஒரு தேதி பற்றியது", "வெயிலாக இருந்தது"]}'),
  ('aaaa0103-0000-4000-8000-000000000103', 'fr', '{"reponse": "les personnes qui ont un animal", "indices": ["À la maison, ils ne sont pas seuls", "Il faut le nourrir"]}'),
  ('aaaa0103-0000-4000-8000-000000000103', 'en', '{"reponse": "people who have a pet", "indices": ["They are not alone at home", "It needs feeding"]}'),
  ('aaaa0103-0000-4000-8000-000000000103', 'ta', '{"reponse": "செல்லப் பிராணி வைத்திருப்பவர்கள்", "indices": ["வீட்டில் அவர்கள் தனியாக இல்லை", "அதற்கு உணவு தர வேண்டும்"]}'),
  ('aaaa0104-0000-4000-8000-000000000104', 'fr', '{"reponse": "les personnes qui parlent trois langues", "indices": ["Écoutez-les bien", "Plus que deux"]}'),
  ('aaaa0104-0000-4000-8000-000000000104', 'en', '{"reponse": "people who speak three languages", "indices": ["Listen to them", "More than two"]}'),
  ('aaaa0104-0000-4000-8000-000000000104', 'ta', '{"reponse": "மூன்று மொழிகள் பேசுபவர்கள்", "indices": ["அவர்களைக் கவனியுங்கள்", "இரண்டுக்கு மேல்"]}'),
  ('aaaa0105-0000-4000-8000-000000000105', 'fr', '{"reponse": "les personnes venues en train", "indices": ["Pensez au trajet", "Il y a des rails"]}'),
  ('aaaa0105-0000-4000-8000-000000000105', 'en', '{"reponse": "people who came by train", "indices": ["Think about the journey", "There are rails"]}'),
  ('aaaa0105-0000-4000-8000-000000000105', 'ta', '{"reponse": "ரயிலில் வந்தவர்கள்", "indices": ["பயணத்தை நினைத்துப் பாருங்கள்", "தண்டவாளங்கள் உள்ளன"]}'),
  ('aaaa0201-0000-4000-8000-000000000201', 'fr', '{"sujet": "citer des épices"}'),
  ('aaaa0201-0000-4000-8000-000000000201', 'en', '{"sujet": "name spices"}'),
  ('aaaa0201-0000-4000-8000-000000000201', 'ta', '{"sujet": "மசாலாப் பொருட்களைச் சொல்லுங்கள்"}'),
  ('aaaa0202-0000-4000-8000-000000000202', 'fr', '{"sujet": "citer des capitales"}'),
  ('aaaa0202-0000-4000-8000-000000000202', 'en', '{"sujet": "name capital cities"}'),
  ('aaaa0202-0000-4000-8000-000000000202', 'ta', '{"sujet": "தலைநகரங்களைச் சொல்லுங்கள்"}'),
  ('aaaa0203-0000-4000-8000-000000000203', 'fr', '{"sujet": "citer des films de Noël"}'),
  ('aaaa0203-0000-4000-8000-000000000203', 'en', '{"sujet": "name Christmas movies"}'),
  ('aaaa0203-0000-4000-8000-000000000203', 'ta', '{"sujet": "கிறிஸ்துமஸ் திரைப்படங்களைச் சொல்லுங்கள்"}')
) as v (id, langue, valeur);

-- Quiz et mime (lot 7) : six questions et huit mots, de quoi jouer une manche de chaque.
-- Mots de mime : un seul mot, concret, qui se traduit sans détour (spec v3, jeu 04).
-- Tamoul : premier jet, à faire relire.
insert into public.contenus (id, jeu, etiquette, cree_par)
select v.id::uuid, v.jeu::public.jeu, 'tout_public', '11111111-1111-4111-8111-111111111111'
from (values
  ('aaaa0301-0000-4000-8000-000000000301', 'qcm2'),
  ('aaaa0302-0000-4000-8000-000000000302', 'qcm2'),
  ('aaaa0303-0000-4000-8000-000000000303', 'qcm2'),
  ('aaaa0304-0000-4000-8000-000000000304', 'qcm2'),
  ('aaaa0305-0000-4000-8000-000000000305', 'qcm2'),
  ('aaaa0306-0000-4000-8000-000000000306', 'qcm2'),
  ('aaaa0401-0000-4000-8000-000000000401', 'mime2'),
  ('aaaa0402-0000-4000-8000-000000000402', 'mime2'),
  ('aaaa0403-0000-4000-8000-000000000403', 'mime2'),
  ('aaaa0404-0000-4000-8000-000000000404', 'mime2'),
  ('aaaa0405-0000-4000-8000-000000000405', 'mime2'),
  ('aaaa0406-0000-4000-8000-000000000406', 'mime2'),
  ('aaaa0407-0000-4000-8000-000000000407', 'mime2'),
  ('aaaa0408-0000-4000-8000-000000000408', 'mime2')
) as v (id, jeu);

insert into public.contenus_traductions (contenu_id, langue, valeur)
select v.id::uuid, v.langue::public.langue, v.valeur::jsonb
from (values
  ('aaaa0301-0000-4000-8000-000000000301', 'fr', '{"question": "Combien de pattes a une araignée ?", "propositions": ["6", "8", "10", "12"]}'),
  ('aaaa0301-0000-4000-8000-000000000301', 'en', '{"question": "How many legs does a spider have?", "propositions": ["6", "8", "10", "12"]}'),
  ('aaaa0301-0000-4000-8000-000000000301', 'ta', '{"question": "சிலந்திக்கு எத்தனை கால்கள்?", "propositions": ["6", "8", "10", "12"]}'),
  ('aaaa0302-0000-4000-8000-000000000302', 'fr', '{"question": "Quelle planète est la plus proche du Soleil ?", "propositions": ["Vénus", "Mars", "Mercure", "La Terre"]}'),
  ('aaaa0302-0000-4000-8000-000000000302', 'en', '{"question": "Which planet is closest to the Sun?", "propositions": ["Venus", "Mars", "Mercury", "Earth"]}'),
  ('aaaa0302-0000-4000-8000-000000000302', 'ta', '{"question": "சூரியனுக்கு மிக அருகில் உள்ள கோள் எது?", "propositions": ["வெள்ளி", "செவ்வாய்", "புதன்", "பூமி"]}'),
  ('aaaa0303-0000-4000-8000-000000000303', 'fr', '{"question": "Combien de minutes dans une heure et demie ?", "propositions": ["90", "60", "80", "120"]}'),
  ('aaaa0303-0000-4000-8000-000000000303', 'en', '{"question": "How many minutes are there in an hour and a half?", "propositions": ["90", "60", "80", "120"]}'),
  ('aaaa0303-0000-4000-8000-000000000303', 'ta', '{"question": "ஒன்றரை மணி நேரத்தில் எத்தனை நிமிடங்கள்?", "propositions": ["90", "60", "80", "120"]}'),
  ('aaaa0304-0000-4000-8000-000000000304', 'fr', '{"question": "Quel est le plus grand animal ?", "propositions": ["L''éléphant", "La baleine bleue", "La girafe", "L''hippopotame"]}'),
  ('aaaa0304-0000-4000-8000-000000000304', 'en', '{"question": "Which is the largest animal?", "propositions": ["Elephant", "Blue whale", "Giraffe", "Hippopotamus"]}'),
  ('aaaa0304-0000-4000-8000-000000000304', 'ta', '{"question": "மிகப் பெரிய விலங்கு எது?", "propositions": ["யானை", "நீலத் திமிங்கிலம்", "ஒட்டகச்சிவிங்கி", "நீர்யானை"]}'),
  ('aaaa0305-0000-4000-8000-000000000305', 'fr', '{"question": "Combien de joueurs d''une équipe de football sont sur le terrain ?", "propositions": ["11", "9", "10", "12"]}'),
  ('aaaa0305-0000-4000-8000-000000000305', 'en', '{"question": "How many players from one football team are on the pitch?", "propositions": ["11", "9", "10", "12"]}'),
  ('aaaa0305-0000-4000-8000-000000000305', 'ta', '{"question": "ஒரு கால்பந்து அணியில் மைதானத்தில் எத்தனை வீரர்கள் இருப்பார்கள்?", "propositions": ["11", "9", "10", "12"]}'),
  ('aaaa0306-0000-4000-8000-000000000306', 'fr', '{"question": "Quel est le plus grand océan ?", "propositions": ["Atlantique", "Indien", "Arctique", "Pacifique"]}'),
  ('aaaa0306-0000-4000-8000-000000000306', 'en', '{"question": "Which is the largest ocean?", "propositions": ["Atlantic", "Indian", "Arctic", "Pacific"]}'),
  ('aaaa0306-0000-4000-8000-000000000306', 'ta', '{"question": "மிகப் பெரிய பெருங்கடல் எது?", "propositions": ["அட்லாண்டிக்", "இந்தியப் பெருங்கடல்", "ஆர்க்டிக்", "பசிபிக்"]}')
) as v (id, langue, valeur);

-- Le mime n'a pas de partie publique : le mot ne s'affiche qu'à la régie, puis au verdict.
insert into public.contenus_traductions (contenu_id, langue, valeur)
select c.id, l.langue::public.langue, '{}'::jsonb
from public.contenus c
cross join (values ('fr'), ('en'), ('ta')) as l (langue)
where c.id::text like 'aaaa04%';

-- Les propositions sont dans le même ordre dans les trois langues : même bonne réponse.
insert into public.contenus_secrets (contenu_id, langue, valeur)
select v.id::uuid, l.langue::public.langue, jsonb_build_object('bonne', v.bonne)
from (values
  ('aaaa0301-0000-4000-8000-000000000301', 1),
  ('aaaa0302-0000-4000-8000-000000000302', 2),
  ('aaaa0303-0000-4000-8000-000000000303', 0),
  ('aaaa0304-0000-4000-8000-000000000304', 1),
  ('aaaa0305-0000-4000-8000-000000000305', 0),
  ('aaaa0306-0000-4000-8000-000000000306', 3)
) as v (id, bonne)
cross join (values ('fr'), ('en'), ('ta')) as l (langue);

insert into public.contenus_secrets (contenu_id, langue, valeur)
select v.id::uuid, v.langue::public.langue, jsonb_build_object('mot', v.mot)
from (values
  ('aaaa0401-0000-4000-8000-000000000401', 'fr', 'parapluie'),
  ('aaaa0401-0000-4000-8000-000000000401', 'en', 'umbrella'),
  ('aaaa0401-0000-4000-8000-000000000401', 'ta', 'குடை'),
  ('aaaa0402-0000-4000-8000-000000000402', 'fr', 'guitare'),
  ('aaaa0402-0000-4000-8000-000000000402', 'en', 'guitar'),
  ('aaaa0402-0000-4000-8000-000000000402', 'ta', 'கிட்டார்'),
  ('aaaa0403-0000-4000-8000-000000000403', 'fr', 'vélo'),
  ('aaaa0403-0000-4000-8000-000000000403', 'en', 'bicycle'),
  ('aaaa0403-0000-4000-8000-000000000403', 'ta', 'மிதிவண்டி'),
  ('aaaa0404-0000-4000-8000-000000000404', 'fr', 'lapin'),
  ('aaaa0404-0000-4000-8000-000000000404', 'en', 'rabbit'),
  ('aaaa0404-0000-4000-8000-000000000404', 'ta', 'முயல்'),
  ('aaaa0405-0000-4000-8000-000000000405', 'fr', 'nager'),
  ('aaaa0405-0000-4000-8000-000000000405', 'en', 'swim'),
  ('aaaa0405-0000-4000-8000-000000000405', 'ta', 'நீந்துதல்'),
  ('aaaa0406-0000-4000-8000-000000000406', 'fr', 'dormir'),
  ('aaaa0406-0000-4000-8000-000000000406', 'en', 'sleep'),
  ('aaaa0406-0000-4000-8000-000000000406', 'ta', 'தூங்குதல்'),
  ('aaaa0407-0000-4000-8000-000000000407', 'fr', 'avion'),
  ('aaaa0407-0000-4000-8000-000000000407', 'en', 'plane'),
  ('aaaa0407-0000-4000-8000-000000000407', 'ta', 'விமானம்'),
  ('aaaa0408-0000-4000-8000-000000000408', 'fr', 'singe'),
  ('aaaa0408-0000-4000-8000-000000000408', 'en', 'monkey'),
  ('aaaa0408-0000-4000-8000-000000000408', 'ta', 'குரங்கு')
) as v (id, langue, mot);

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

-- La surenchère à venir : ses trois thèmes, pour piloter une manche de démo (lot 6).
insert into public.passages (manche_id, evenement_id, ordre, contenu_id) values
  ('ba000003-0000-4000-8000-000000000003', 'eeee0001-0000-4000-8000-000000000001', 1,
   'aaaa0003-0000-4000-8000-000000000003'),
  ('ba000003-0000-4000-8000-000000000003', 'eeee0001-0000-4000-8000-000000000001', 2,
   'aaaa0201-0000-4000-8000-000000000201'),
  ('ba000003-0000-4000-8000-000000000003', 'eeee0001-0000-4000-8000-000000000001', 3,
   'aaaa0202-0000-4000-8000-000000000202');

-- La manche photo : ses deux thèmes, ouverts aux capitaines dès l'arrivée (lot 8).
insert into public.passages (manche_id, evenement_id, ordre, contenu_id) values
  ('ba000005-0000-4000-8000-000000000005', 'eeee0001-0000-4000-8000-000000000001', 1,
   'aaaa0005-0000-4000-8000-000000000005'),
  ('ba000005-0000-4000-8000-000000000005', 'eeee0001-0000-4000-8000-000000000001', 2,
   'aaaa0006-0000-4000-8000-000000000006');

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

-- Une manche de quiz et une de mime à venir, pour essayer le lot 7 depuis la régie de Brahim.
insert into public.manches (id, evenement_id, jeu, ordre, options) values
  ('bb000001-0000-4000-8000-000000000001', 'eeee0002-0000-4000-8000-000000000002', 'qcm2', 1,
   '{"questions": 4}'),
  ('bb000002-0000-4000-8000-000000000002', 'eeee0002-0000-4000-8000-000000000002', 'mime2', 2,
   '{"passages_par_equipe": 1}');

insert into public.passages (manche_id, evenement_id, equipe_id, ordre, contenu_id) values
  ('bb000001-0000-4000-8000-000000000001', 'eeee0002-0000-4000-8000-000000000002', null, 1,
   'aaaa0301-0000-4000-8000-000000000301'),
  ('bb000001-0000-4000-8000-000000000001', 'eeee0002-0000-4000-8000-000000000002', null, 2,
   'aaaa0302-0000-4000-8000-000000000302'),
  ('bb000001-0000-4000-8000-000000000001', 'eeee0002-0000-4000-8000-000000000002', null, 3,
   'aaaa0303-0000-4000-8000-000000000303'),
  ('bb000001-0000-4000-8000-000000000001', 'eeee0002-0000-4000-8000-000000000002', null, 4,
   'aaaa0304-0000-4000-8000-000000000304'),
  ('bb000002-0000-4000-8000-000000000002', 'eeee0002-0000-4000-8000-000000000002',
   '11200001-0000-4000-8000-000000000101', 1, 'aaaa0401-0000-4000-8000-000000000401'),
  ('bb000002-0000-4000-8000-000000000002', 'eeee0002-0000-4000-8000-000000000002',
   '11200002-0000-4000-8000-000000000102', 2, 'aaaa0402-0000-4000-8000-000000000402');
