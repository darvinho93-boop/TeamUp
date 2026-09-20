'use client';

import { Button, Card, TeamDot, TextField } from '@teamup/ui/react';
import './kit.css';

const teams = [
  { index: 1, name: 'Navy' },
  { index: 2, name: 'Corail' },
  { index: 3, name: 'Sauge' },
  { index: 4, name: 'Ambre' },
];

function Demo() {
  return (
    <div className="kit__demo">
      <div className="tu-cluster">
        <Button variant="primary">Action structurante</Button>
        <Button variant="accent">Demander un devis</Button>
        <Button variant="ghost">Secondaire</Button>
        <Button variant="primary" disabled>
          Indisponible
        </Button>
      </div>

      <div className="tu-cluster">
        <Button variant="accent" size="lg">
          C&apos;est à toi de jouer
        </Button>
      </div>

      <div className="kit__grid">
        <TextField label="Prénom" name="prenom" placeholder="Camille" required />
        <TextField
          label="Nombre d'invités"
          name="invites"
          type="number"
          hint="Le nombre d'équipes découle du nombre d'invités."
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          error="Cette adresse ne semble pas valide."
        />
      </div>

      <div className="kit__grid">
        <Card title="Points communs">
          Une équipe, dos à l&apos;écran, devine ce qui rassemble les invités debout.
        </Card>
        <Card title="Surenchère" lift>
          Les champions s&apos;avancent, puis le sujet est dévoilé.
        </Card>
      </div>

      <div className="tu-cluster">
        {teams.map((team) => (
          <TeamDot key={team.index} index={team.index} name={team.name} />
        ))}
      </div>
      <div className="tu-cluster">
        {teams.map((team) => (
          <TeamDot key={team.index} index={team.index} name={team.name} variant="badge" />
        ))}
      </div>
      <div className="tu-cluster">
        <TeamDot index={2} name="Équipe Corail" size="lg" />
      </div>
    </div>
  );
}

export default function KitUi() {
  return (
    <main className="tu-container kit">
      <header className="kit__intro">
        <h1>Kit d&apos;interface</h1>
        <p>
          Les composants de <code>@teamup/ui</code> rendus côté React. La même page existe côté
          vitrine sur <code>/kit-ui</code>, avec les composants Astro : les deux doivent être
          identiques.
        </p>
      </header>

      <section className="kit__theme" aria-labelledby="theme-clair">
        <h2 id="theme-clair">Thème clair — vitrine et écran joueur</h2>
        <Demo />
      </section>

      <section className="kit__theme" data-theme="stage" aria-labelledby="theme-stage">
        <h2 id="theme-stage">Thème stage — écran commun et régie</h2>
        <Demo />
      </section>
    </main>
  );
}
