// Copie la logique partagée (fichiers autonomes) vers les Edge Functions Supabase,
// qui ne peuvent pas importer le paquet pnpm. `--check` échoue si la copie est périmée.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['push.ts', 'link-safety.ts', 'billing.ts', 'certification.ts'];
const header = '// ⚠️ Fichier généré depuis packages/shared/src — ne pas modifier (pnpm sync:functions).\n';
const check = process.argv.includes('--check');
let stale = false;

mkdirSync(join(root, 'supabase/functions/_shared'), { recursive: true });
for (const f of files) {
  const wanted = header + readFileSync(join(root, 'packages/shared/src', f), 'utf8');
  const target = join(root, 'supabase/functions/_shared', f);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current === wanted) continue;
  if (check) { stale = true; console.error(`périmé : supabase/functions/_shared/${f}`); }
  else { writeFileSync(target, wanted); console.log(`copié : ${f}`); }
}
if (stale) { console.error('→ lancer `pnpm sync:functions`'); process.exit(1); }
