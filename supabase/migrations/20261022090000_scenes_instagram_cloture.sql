-- Deux scènes de plus à l'écran commun (2026-10-22).
--
-- `instagram` : une page entière qui invite la salle à suivre @teamup_officiel, QR code compris,
-- lancée par la régie quand elle veut. `cloture` : la fin de soirée, le logo qui se forme comme à
-- l'ouverture, « Merci ! », puis la même invitation. Seules dans leur migration : une valeur
-- ajoutée à un type énuméré ne sert pas dans la transaction qui l'ajoute.

alter type public.scene add value 'instagram' after 'podium';
alter type public.scene add value 'cloture' after 'instagram';
