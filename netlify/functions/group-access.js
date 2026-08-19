const crypto = require('crypto');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const b64url = value => Buffer.from(value).toString('base64url');

function sign(payload, secret) {
  const encoded = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [encoded, supplied] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const a = Buffer.from(supplied || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false });

  const passkey = process.env.GROUP_PASSKEY;
  const signingSecret = process.env.GROUP_ACCESS_SIGNING_SECRET;
  if (!passkey || !signingSecret) {
    console.error('Missing GROUP_PASSKEY or GROUP_ACCESS_SIGNING_SECRET');
    return json(500, { ok: false, error: 'Group access is not configured yet.' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false }); }

  if (body.token) {
    const payload = verify(body.token, signingSecret);
    if (!payload) return json(401, { ok: false });
    return json(200, { ok: true, name: payload.name });
  }

  const name = String(body.name || '').trim().slice(0, 80);
  const suppliedPasskey = String(body.passkey || '');
  if (!name) return json(400, { ok: false, error: 'Enter your name.' });

  const supplied = Buffer.from(suppliedPasskey);
  const expected = Buffer.from(passkey);
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!matches) return json(401, { ok: false, error: 'That passkey is not correct.' });

  const payload = {
    v: 1,
    name,
    exp: Date.now() + (1000 * 60 * 60 * 24 * 90)
  };

  return json(200, { ok: true, token: sign(payload, signingSecret), name });
};
