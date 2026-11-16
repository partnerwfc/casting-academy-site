import type { AppLocale } from '@community-safe/shared';

interface Copy {
  story: string[]; how: string; steps: [string, string][]; fans: string; fansPoints: string[];
  creators: string; creatorsPoints: string[]; pricing: string; perYear: string; quote: string; upTo: string; annPerMonth: string;
  trust: string; trustPoints: string[]; closing: string;
}

export const landingCopy: Record<AppLocale, Copy> = {
  en: {
    story: ['You spent ten years building your community.', 'Tomorrow your account is hacked, suspended or deleted.', 'In a few hours you can lose your only way to reach thousands of people.'],
    how: 'How it works',
    steps: [['Create your space', 'A verified profile and a personal link: savemycommunity.app/@you'], ['Share your link', 'Your followers join your backup channel for free, in a few taps.'], ['Send an SOS when needed', 'One notification tells them where to find you again.']],
    fans: 'For followers', fansPoints: ['Free, forever.', 'No feed, no ads, nothing to scroll.', 'Only the alerts you allow, creator by creator.'],
    creators: 'For creators', creatorsPoints: ['A channel that does not depend on any social network.', 'A secure SOS button with identity re-confirmation.', 'Important announcements, a few times a month at most.'],
    pricing: 'Pricing', perYear: '/ year', quote: 'On request', upTo: 'Up to {n} members', annPerMonth: '{n} announcement(s) / month',
    trust: 'Built on trust', trustPoints: ['Alerts only come from verified creators.', 'Follower contact details are never sold, and never handed to creators.', 'Export or delete your data at any time.'],
    closing: "Don't risk losing everything overnight.",
  },
  fr: {
    story: ['Tu as passé dix ans à construire ta communauté.', 'Demain, ton compte est piraté, suspendu ou supprimé.', 'En quelques heures, tu peux perdre ton seul moyen de joindre des milliers de personnes.'],
    how: 'Comment ça marche',
    steps: [['Crée ton espace', 'Un profil vérifié et un lien personnel : savemycommunity.app/@toi'], ['Partage ton lien', 'Tes abonnés rejoignent ton canal de secours gratuitement, en quelques clics.'], ['Envoie un SOS si nécessaire', 'Une notification leur indique où te retrouver.']],
    fans: 'Pour les abonnés', fansPoints: ['Gratuit, pour toujours.', 'Pas de fil, pas de publicité, rien à faire défiler.', 'Uniquement les alertes que tu autorises, créateur par créateur.'],
    creators: 'Pour les créateurs', creatorsPoints: ["Un canal qui ne dépend d'aucun réseau social.", "Un bouton SOS sécurisé avec reconfirmation d'identité.", 'Des annonces importantes, quelques fois par mois au maximum.'],
    pricing: 'Tarifs', perYear: '/ an', quote: 'Sur devis', upTo: "Jusqu'à {n} membres", annPerMonth: '{n} annonce(s) / mois',
    trust: 'Fondé sur la confiance', trustPoints: ['Les alertes proviennent uniquement de créateurs vérifiés.', 'Les coordonnées des abonnés ne sont jamais vendues, ni transmises aux créateurs.', 'Exporte ou supprime tes données à tout moment.'],
    closing: 'Ne prends pas le risque de tout perdre en une nuit.',
  },
  pt: {
    story: ['Passaste dez anos a construir a tua comunidade.', 'Amanhã, a tua conta é pirateada, suspensa ou eliminada.', 'Em poucas horas podes perder a única forma de chegar a milhares de pessoas.'],
    how: 'Como funciona',
    steps: [['Cria o teu espaço', 'Um perfil verificado e um link pessoal: savemycommunity.app/@tu'], ['Partilha o teu link', 'Os teus seguidores juntam-se ao canal de reserva gratuitamente, em poucos toques.'], ['Envia um SOS quando for preciso', 'Uma notificação diz-lhes onde te encontrar.']],
    fans: 'Para seguidores', fansPoints: ['Gratuito, para sempre.', 'Sem feed, sem publicidade, nada para percorrer.', 'Apenas os alertas que autorizas, criador a criador.'],
    creators: 'Para criadores', creatorsPoints: ['Um canal que não depende de nenhuma rede social.', 'Um botão SOS seguro com reconfirmação de identidade.', 'Anúncios importantes, no máximo algumas vezes por mês.'],
    pricing: 'Preços', perYear: '/ ano', quote: 'Sob consulta', upTo: 'Até {n} membros', annPerMonth: '{n} anúncio(s) / mês',
    trust: 'Assente na confiança', trustPoints: ['Os alertas vêm apenas de criadores verificados.', 'Os contactos dos seguidores nunca são vendidos nem entregues aos criadores.', 'Exporta ou elimina os teus dados a qualquer momento.'],
    closing: 'Não arrisques perder tudo numa noite.',
  },
  es: {
    story: ['Has pasado diez años construyendo tu comunidad.', 'Mañana, tu cuenta es hackeada, suspendida o eliminada.', 'En pocas horas puedes perder tu única forma de llegar a miles de personas.'],
    how: 'Cómo funciona',
    steps: [['Crea tu espacio', 'Un perfil verificado y un enlace personal: savemycommunity.app/@tú'], ['Comparte tu enlace', 'Tus seguidores se unen gratis a tu canal de respaldo, en pocos toques.'], ['Envía un SOS cuando haga falta', 'Una notificación les dice dónde encontrarte.']],
    fans: 'Para seguidores', fansPoints: ['Gratis, para siempre.', 'Sin feed, sin anuncios, nada que deslizar.', 'Solo las alertas que autorices, creador por creador.'],
    creators: 'Para creadores', creatorsPoints: ['Un canal que no depende de ninguna red social.', 'Un botón SOS seguro con reconfirmación de identidad.', 'Anuncios importantes, como máximo unas pocas veces al mes.'],
    pricing: 'Precios', perYear: '/ año', quote: 'A consultar', upTo: 'Hasta {n} miembros', annPerMonth: '{n} anuncio(s) / mes',
    trust: 'Basado en la confianza', trustPoints: ['Las alertas solo provienen de creadores verificados.', 'Los datos de contacto de los seguidores nunca se venden ni se entregan a los creadores.', 'Exporta o elimina tus datos en cualquier momento.'],
    closing: 'No te arriesgues a perderlo todo en una noche.',
  },
};
