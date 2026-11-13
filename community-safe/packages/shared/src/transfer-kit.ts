import { translate } from './i18n';
import { creatorUrl, TRANSFER_SOURCES, type AppLocale, type TransferSource } from './constants';

export interface KitText {
  source: TransferSource;
  label: string;
  text: string;
  url: string;
}

const LABELS: Record<TransferSource, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', whatsapp: 'WhatsApp',
  newsletter: 'Newsletter', qr: 'QR code',
};

// Textes prêts à copier, un par réseau, chacun avec son lien suivi (?s=source)
// pour mesurer la provenance sans collecter de donnée personnelle.
export function buildTransferKit(locale: AppLocale, baseUrl: string, handle: string): KitText[] {
  const base = translate(locale, 'kit.shareText');
  const story = translate(locale, 'kit.story');
  return TRANSFER_SOURCES.filter((s) => s !== 'qr').map((source) => {
    const url = creatorUrl(baseUrl, handle, source);
    // X limite la longueur : version courte.
    const text = source === 'x' ? `${story}\n${url}` : `${base}\n\n👉 ${url}`;
    return { source, label: LABELS[source], text, url };
  });
}
