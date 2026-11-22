import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

// Achats in-app Apple via RevenueCat. L'identifiant utilisateur RevenueCat est l'id du profil créateur :
// le webhook serveur s'en sert pour attribuer le forfait. Aucune donnée de carte ne transite par nous.
const KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY;
export const iapAvailable = Platform.OS === 'ios' && !!KEY;

let configuredFor: string | null = null;
async function ensure(creatorId: string) {
  if (!iapAvailable) throw new Error('iap_unavailable');
  if (configuredFor === null) { Purchases.configure({ apiKey: KEY!, appUserID: creatorId }); }
  else if (configuredFor !== creatorId) { await Purchases.logIn(creatorId); }
  configuredFor = creatorId;
}

/** productId → offre (avec prix localisé de l'App Store). */
export async function loadStorePackages(creatorId: string): Promise<Record<string, PurchasesPackage>> {
  await ensure(creatorId);
  const offerings = await Purchases.getOfferings();
  const out: Record<string, PurchasesPackage> = {};
  for (const off of Object.values(offerings.all)) for (const p of off.availablePackages) out[p.product.identifier] = p;
  return out;
}

/** true = achat effectué ; false = annulé par l'utilisateur. */
export async function buy(creatorId: string, pkg: PurchasesPackage): Promise<boolean> {
  await ensure(creatorId);
  try { await Purchases.purchasePackage(pkg); return true; }
  catch (e) { if ((e as { userCancelled?: boolean }).userCancelled) return false; throw e; }
}

export async function restore(creatorId: string): Promise<boolean> {
  await ensure(creatorId);
  const info = await Purchases.restorePurchases();
  return Object.keys(info.entitlements.active).length > 0;
}
