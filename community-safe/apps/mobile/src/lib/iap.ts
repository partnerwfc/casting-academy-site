import { Platform } from 'react-native';
import {
  ErrorCode, fetchProducts, finishTransaction, getAvailablePurchases, initConnection, purchaseErrorListener,
  purchaseUpdatedListener, requestPurchase, restorePurchases, type Purchase,
} from 'expo-iap';
import { supabase } from './supabase';

// Achats in-app Apple (StoreKit 2) sans prestataire : l'app envoie l'identifiant de transaction à notre serveur,
// qui le vérifie auprès d'Apple. Le forfait n'est attribué qu'après cette vérification. Aucune carte ne transite par nous.
export const iapAvailable = Platform.OS === 'ios';

let connected = false;
async function ensure() {
  if (!iapAvailable) throw new Error('iap_unavailable');
  if (!connected) { await initConnection(); connected = true; }
}

/** Prix localisés de l'App Store, par identifiant produit. */
export async function loadStorePrices(skus: string[]): Promise<Record<string, string>> {
  await ensure();
  const products = (await fetchProducts({ skus, type: 'subs' })) ?? [];
  return Object.fromEntries((products as { id: string; displayPrice: string }[]).map((p) => [p.id, p.displayPrice]));
}

async function verifyOnServer(purchase: Purchase): Promise<boolean> {
  const transactionId = (purchase as { transactionId?: string }).transactionId ?? purchase.id;
  const { data, error } = await supabase.functions.invoke('apple-iap', { body: { transaction_id: transactionId } });
  return !error && (data as { ok?: boolean } | null)?.ok === true;
}

/** true = achat vérifié par le serveur ; false = annulé par l'utilisateur. Lève une erreur sinon. */
export async function buy(creatorId: string, sku: string): Promise<boolean> {
  await ensure();
  return new Promise<boolean>((resolve, reject) => {
    const subs = [
      purchaseUpdatedListener(async (purchase) => {
        if (purchase.productId !== sku) return;
        cleanup();
        try {
          if (!(await verifyOnServer(purchase))) return reject(new Error('purchase_not_verified'));
          await finishTransaction({ purchase, isConsumable: false });
          resolve(true);
        } catch (e) { reject(e); }
      }),
      purchaseErrorListener((err) => {
        cleanup();
        if (err.code === ErrorCode.UserCancelled) resolve(false); else reject(new Error(err.message));
      }),
    ];
    const cleanup = () => subs.forEach((s) => s.remove());
    // appAccountToken = id du créateur : Apple le renvoie dans la transaction, le serveur s'en sert pour attribuer le forfait.
    requestPurchase({ request: { apple: { sku, appAccountToken: creatorId } }, type: 'subs' }).catch((e) => { cleanup(); reject(e); });
  });
}

/** Restaure les achats du compte Apple puis les fait revérifier par le serveur. */
export async function restore(): Promise<boolean> {
  await ensure();
  await restorePurchases();
  const purchases = await getAvailablePurchases();
  let ok = false;
  for (const p of purchases) { if (await verifyOnServer(p)) { ok = true; await finishTransaction({ purchase: p, isConsumable: false }); } }
  return ok;
}
