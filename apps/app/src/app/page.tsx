import Link from 'next/link';

export default function Home() {
  return (
    <main className="tu-container" style={{ paddingBlock: 'var(--tu-space-16)' }}>
      <div className="tu-stack">
        <h1>Team Up!</h1>
        <p>
          Cette surface accueillera l&apos;écran joueur. On rejoint une partie par le code de salle
          : <code>app.teamup.fr/K7P2M9</code> — lot 5.
        </p>
        <p>
          <Link className="tu-btn tu-btn--ghost" href="/kit-ui">
            Voir le kit d&apos;interface
          </Link>
        </p>
      </div>
    </main>
  );
}
