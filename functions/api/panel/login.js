// functions/api/panel/login.js — POST /api/panel/login { passcode }
//
// Checks the passcode against the STAFF_PASSCODE secret and, on success, sets a
// signed HttpOnly cookie. GET reports whether the caller is already logged in
// (so the panel can skip the login screen on reload).

import { json } from "../../_lib/db.js";
import { checkPasscode, makeSessionCookie, clearSessionCookie, isStaff } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, { status: 400 });
  }

  if (!checkPasscode(env, body?.passcode)) {
    return json({ error: "invalid_passcode" }, { status: 401 });
  }

  const cookie = await makeSessionCookie(env, new URL(request.url));
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}

export async function onRequestGet({ request, env }) {
  return json({ authenticated: await isStaff(request, env) });
}

export async function onRequestDelete({ request }) {
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(new URL(request.url)) } });
}
