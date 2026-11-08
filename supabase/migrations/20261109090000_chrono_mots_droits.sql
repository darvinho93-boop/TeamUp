-- Surenchère en mode téléphones : `chrono_mots_ouvert` (20261108090000) était restée exécutable par
-- tous. Elle ne fait que comparer l'heure de la base au chrono qu'on lui passe et ne lit rien,
-- mais, comme les autres fonctions, elle ne sert qu'à la régie, à l'écran et au serveur.
revoke execute on function public.chrono_mots_ouvert(public.pilotage) from public, anon;
grant execute on function public.chrono_mots_ouvert(public.pilotage) to authenticated, service_role;
