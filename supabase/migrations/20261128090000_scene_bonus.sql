-- Le bonus d'une soirée à thème (2026-11-28) : la chanson choisie par les hôtes, chantée en karaoké
-- quand la régie juge l'ambiance bonne. Seule dans sa migration : une valeur d'énumération ne sert
-- pas dans la transaction qui l'ajoute. La musique vient du réglage `bonus` du thème
-- (`themes_soiree.reglages`), écrit par la clé de service : rien d'autre ne change.

alter type public.scene add value 'bonus' after 'connaissance';
