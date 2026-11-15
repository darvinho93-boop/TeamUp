-- Blind test (2026-11-15) : un jeu de plus dans le référentiel. Seule dans sa migration : une
-- valeur d'énumération ne sert pas dans la transaction qui l'ajoute (voir 20261017120000).
alter type public.jeu add value if not exists 'blind';
