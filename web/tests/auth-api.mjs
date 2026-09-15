import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.AUTH_TEST_URL || 'http://localhost:3000';
const email = `auth-${randomUUID()}@example.invalid`;
const password = 'Prueba-Segura-2026';

async function auth(body, options = {}) {
  const response = await fetch(`${base}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { error: text };
  }
  return { response, result };
}

const invalidOrigin = await auth(
  { action: 'login', email, password },
  { headers: { Origin: 'https://attacker.example' } },
);
assert.equal(invalidOrigin.response.status, 403);

const registration = await auth({
  action: 'register',
  name: 'Prueba de acceso',
  email,
  password,
});
assert.equal(
  registration.response.status,
  201,
  JSON.stringify(registration.result),
);
const registrationCookie = registration.response.headers.get('set-cookie');
assert(registrationCookie);
assert.match(registrationCookie, /fabrica_session=/);
assert.match(registrationCookie, /HttpOnly/i);
assert.match(registrationCookie, /SameSite=Lax/i);
const cookie = registrationCookie.split(';')[0];

const authenticatedStudio = await fetch(`${base}/api/studio`, {
  headers: { cookie },
});
assert.equal(authenticatedStudio.status, 200, await authenticatedStudio.text());

const duplicate = await auth({
  action: 'register',
  name: 'Cuenta duplicada',
  email: email.toUpperCase(),
  password,
});
assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.result));

const wrongPassword = await auth({
  action: 'login',
  email,
  password: 'Otra-Clave-2026',
});
assert.equal(
  wrongPassword.response.status,
  401,
  JSON.stringify(wrongPassword.result),
);

const login = await auth({ action: 'login', email, password });
assert.equal(login.response.status, 200, JSON.stringify(login.result));
assert(login.response.headers.get('set-cookie'));

const logout = await auth(
  { action: 'logout' },
  {
    headers: { cookie: login.response.headers.get('set-cookie').split(';')[0] },
  },
);
assert.equal(logout.response.status, 200, JSON.stringify(logout.result));
assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/i);

console.log(
  'PASS: registration, normalized duplicate, login, protected access, CSRF rejection and logout.',
);
