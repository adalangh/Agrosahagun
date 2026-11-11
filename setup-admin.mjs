/**
 * Crea el primer administrador en TU proyecto de Firebase (una sola vez).
 * Uso:  node setup-admin.mjs            -> usuario "admin" / contraseña "admin123"
 *       node setup-admin.mjs miuser MiClave123
 * Requisitos: Node 18+, "Correo/contraseña" habilitado en Authentication y, mientras
 * corre el script, reglas temporales:  { "rules": { ".read": "auth != null", ".write": "auth != null" } }
 * Después publica database.rules.json.
 */
import { readFileSync } from 'node:fs';

const cfg = readFileSync(new URL('./config.firebase-config.js', import.meta.url), 'utf8');
const pick = (k) => (cfg.match(new RegExp(`${k}:\\s*"([^"]+)"`)) || [])[1];
const apiKey = pick('apiKey'), dbUrl = pick('databaseURL');
const user = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin123';
const email = user.includes('@') ? user : `${user}@agrosahagun.app`;

if (password.length < 6) { console.error('❌ Firebase exige contraseñas de al menos 6 caracteres.'); process.exit(1); }

const call = async (url, opts) => { const r = await fetch(url, opts); return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }; };
const post = (path, body) => call(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${apiKey}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });

let res = await post('signUp');
if (!res.ok && res.data?.error?.message === 'EMAIL_EXISTS') res = await post('signInWithPassword');
if (!res.ok) {
  const m = res.data?.error?.message || res.status;
  console.error('❌ Authentication:', m);
  if (String(m).includes('OPERATION_NOT_ALLOWED')) console.error('   Habilita "Correo/contraseña" en Authentication > Sign-in method.');
  if (String(m).includes('INVALID_LOGIN')) console.error('   El usuario ya existe con otra contraseña.');
  process.exit(1);
}
const { localId: uid, idToken } = res.data;

const put = await call(`${dbUrl}/agrosahagun_db/users/${uid}.json?auth=${idToken}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Administrador', email, role: 'admin', active: true, createdAt: Date.now() })
});
if (!put.ok) {
  console.error('❌ Base de datos:', put.data?.error || put.status);
  console.error('   Pon reglas temporales (ver arriba) en Realtime Database > Rules, ejecuta de nuevo y luego publica database.rules.json.');
  process.exit(1);
}
console.log(`✅ Administrador listo.\n   Usuario: ${user}\n   Contraseña: ${password}\n   UID: ${uid}\n   Ahora publica database.rules.json y cambia la contraseña.`);
