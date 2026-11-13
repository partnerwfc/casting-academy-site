import type { ReactNode } from 'react';
import { Footer, Header } from '@/components/Chrome';

// Trame de travail : à faire relire et compléter par un juriste avant le lancement public
// (identité de l'éditeur, DPO, sous-traitants, transferts hors UE, droit applicable par territoire).
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="narrow prose" style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: '2rem' }}>{title}</h1>
        <p className="card soft small">Draft — pending legal review. / Projet — en attente de validation juridique.</p>
        {children}
      </main>
      <Footer />
    </>
  );
}
