# Jouer une soirée depuis le PC, sans internet

Le PC sert l'app sur le wifi du routeur de la salle (Cudy, réseau `TeamUp`). Les invités s'y
branchent et scannent le QR de l'écran. Rien ne passe par internet pendant la soirée. Voir aussi
`CLAUDE.md`, section « Conventions posées le 2026-11-28 (soirée sur le PC) ».

## La veille, avec internet

1. Démarrer Docker Desktop, puis lancer `pnpm db:start`.
2. Lancer `pnpm soiree:descendre --code PS4EPT`.
   - La soirée, ses contenus, ses musiques, ses scènes et son thème descendent de l'en-ligne vers
     le PC. Le script vérifie ensuite la copie (lignes et fichiers).
   - Si la copie a déjà servi à une répétition, ajouter `--remise-a-zero`.
   - La première fois, le script donne le mot de passe du compte d'animateur **sur le PC**. Ce
     compte garde ton e-mail habituel.
3. PC branché au routeur, lancer une fois `pnpm soiree:pc --code PS4EPT`.
   - Il construit l'app pour l'adresse du PC sur le routeur, puis la démarre. Il la reconstruit
     aussi quand le code a changé depuis (quelques minutes) : la relancer après chaque mise à
     jour, pour ne pas découvrir la construction sur place.
   - Vérifier que l'écran s'ouvre, puis l'arrêter avec Ctrl+C.

**Après la descente, ne plus lancer `pnpm db:reset`** : il efface la base du PC.

## Sur place

1. **Le routeur.** L'allumer, puis brancher le PC **en câble** sur un port LAN. Le PC doit avoir
   l'adresse `192.168.10.244`.
2. **La base.** Démarrer Docker Desktop, puis lancer `pnpm db:start`.
3. **Le pare-feu**, une fois, dans PowerShell **ouvert en administrateur** :
   `New-NetFirewallRule -DisplayName "Team Up soirée" -Direction Inbound -Protocol TCP -LocalPort 3000,54321 -RemoteAddress 192.168.10.0/24 -Action Allow`
4. **L'app.** Lancer `pnpm soiree:pc --code PS4EPT`. Le script affiche les trois adresses.
5. **L'écran**, dans Chrome sur le PC, en plein écran (F11) : `http://localhost:3000/ecran/PS4EPT`,
   puis « Activer le son ».
   - Toujours l'ouvrir par `localhost` sur le PC : ses fichiers et sa musique sont là.
6. **La régie**, avec le compte du PC :
   - sur le PC, à l'adresse `http://localhost:3000/regie` ;
   - ou depuis une tablette branchée au wifi `TeamUp`, à l'adresse `http://192.168.10.244:3000/regie`.
7. **Les invités** se branchent au wifi `TeamUp`, puis scannent le QR de l'écran, qui mène à
   `http://192.168.10.244:3000/PS4EPT`. Un téléphone qui reste sur sa 4G ne joint pas le PC :
   lui faire couper ses données mobiles.

## Après

- Arrêter l'app avec Ctrl+C.
- Retirer la règle du pare-feu (PowerShell en administrateur) :
  `Remove-NetFirewallRule -DisplayName "Team Up soirée"`.
- Lancer `pnpm db:stop`.
- Les scores, les photos et les avis restent sur le PC. La régie les exporte en CSV et en ZIP.
