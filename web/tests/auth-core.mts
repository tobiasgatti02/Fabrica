import assert from 'node:assert/strict';
import {
  clearSessionCookie,
  cookieValue,
  fromBase64Url,
  hashPassword,
  normalizeEmail,
  passwordChecks,
  sessionCookie,
  toBase64Url,
  validRequestOrigin,
  validateAuthPayload,
  verifyPassword,
} from '../features/auth/core';

assert.equal(normalizeEmail('  PERSONA@Example.COM  '), 'persona@example.com');
assert.equal(normalizeEmail(null), '');

assert.deepEqual(passwordChecks('Clave-Segura-2026'), {
  length: true,
  letters: true,
  number: true,
  symbol: true,
});

const login = validateAuthPayload({
  action: 'login',
  email: '  PERSONA@Example.COM ',
  password: 'Clave-Segura-2026',
});
assert.equal(login.ok, true);
if (login.ok) assert.equal(login.value.email, 'persona@example.com');

assert.equal(validateAuthPayload(null).ok, false);
assert.equal(validateAuthPayload({ action: 'unknown' }).ok, false);
assert.equal(
  validateAuthPayload({
    action: 'register',
    name: 'A',
    email: 'persona@example.com',
    password: 'Clave-Segura-2026',
  }).ok,
  false,
);
assert.equal(
  validateAuthPayload({
    action: 'register',
    name: 'Estudio Norte',
    email: 'persona@example.com',
    password: 'solamentelarga',
  }).ok,
  false,
);
assert.equal(validateAuthPayload({ action: 'logout' }).ok, true);

assert.equal(
  cookieValue(
    'theme=dark; fabrica_session=abc.def-123; x=1',
    'fabrica_session',
  ),
  'abc.def-123',
);
assert.equal(cookieValue('not_fabrica_session=x', 'fabrica_session'), '');

const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
assert.throws(() => fromBase64Url('***'));

const password = 'Clave-Segura-2026';
const encoded = await hashPassword(password);
assert.equal(await verifyPassword(password, encoded), true);
assert.equal(await verifyPassword('Clave-Incorrecta-2026', encoded), false);
assert.equal(await verifyPassword(password, 'pbkdf2_sha256$1$bad$bad'), false);
assert.equal(await verifyPassword(password, 'not-a-hash'), false);

const httpRequest = new Request('http://localhost:3000/api/auth');
const httpsRequest = new Request('https://fabrica.example/api/auth');
const httpCookie = sessionCookie('token', httpRequest);
const httpsCookie = sessionCookie('token', httpsRequest);
assert.match(httpCookie, /HttpOnly; SameSite=Lax; Path=\//);
assert.doesNotMatch(httpCookie, /; Secure/);
assert.match(httpsCookie, /; Secure; Priority=High$/);
assert.match(clearSessionCookie(httpsRequest), /Max-Age=0/);
assert.match(clearSessionCookie(httpsRequest), /Expires=Thu, 01 Jan 1970/);

assert.equal(
  validRequestOrigin(
    new Request('https://fabrica.example/api/auth', {
      headers: { origin: 'https://fabrica.example' },
    }),
  ),
  true,
);
assert.equal(
  validRequestOrigin(
    new Request('https://fabrica.example/api/auth', {
      headers: { origin: 'https://evil.example' },
    }),
  ),
  false,
);

console.log('PASS: auth validation, hashing, cookies and origin checks.');
