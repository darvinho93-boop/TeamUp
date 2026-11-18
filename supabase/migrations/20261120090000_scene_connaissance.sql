-- Cartes « Faisons connaissance » (2026-11-18) : la scène où le grand écran célèbre une équipe,
-- puis présente l'un de ses membres. Seule dans sa migration : une valeur d'énumération ne sert
-- pas dans la transaction qui l'ajoute.

alter type public.scene add value 'connaissance' after 'scores';
