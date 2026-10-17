-- La scène d'ouverture (2026-10-17).
--
-- Avant la page du QR code, l'écran commun montre une ouverture en boucle (les quatre ronds du
-- logo). Passer de l'ouverture à l'accueil déclenche la révélation du logo de la soirée.
-- Seule dans sa migration : une valeur ajoutée à un type énuméré ne peut pas servir dans la
-- transaction qui l'ajoute (la suivante en fait la scène par défaut).

alter type public.scene add value 'ouverture' before 'accueil';
