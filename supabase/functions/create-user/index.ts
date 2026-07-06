// Supabase Edge Function: create-user
// Server-side, admin-only account creation. Replaces the insecure client-side
// supabase.auth.signUp flow so public signups can be DISABLED in the dashboard
// without breaking the admin's ability to create workers.
//
// Uses the service-role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY) which
// bypasses RLS, so it must verify the caller itself:
//   - caller must present a valid JWT (an authenticated user), and
//   - callers that are an explicit 'worker' are rejected (owner/admin allowed).
//
// Deploy: Supabase Dashboard -> Edge Functions -> Create a new function named
// exactly "create-user" -> paste this file -> Deploy. No secrets to set; the
// SUPABASE_* env vars are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Nedostaje autorizacija' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Identify the caller from their JWT.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await caller.auth.getUser()
    if (authErr || !user) return json({ error: 'Neautorizovan' }, 401)

    // Service-role client (bypasses RLS).
    const admin = createClient(url, serviceKey)

    // Only an explicit 'worker' is blocked; the owner (often not in app_users)
    // and admins are allowed — mirrors the /users route guard in the client.
    const { data: callerRow } = await admin
      .from('app_users').select('role').eq('auth_user_id', user.id).maybeSingle()
    if (callerRow?.role === 'worker') {
      return json({ error: 'Samo administrator može kreirati korisnike.' }, 403)
    }

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Neispravan zahtjev.' }, 400)
    const { username, password, fullName, phone, role, email } = body

    if (!username || !password || !fullName) {
      return json({ error: 'Ime, korisničko ime i lozinka su obavezni.' }, 400)
    }
    if (String(username).length < 3) {
      return json({ error: 'Korisničko ime mora imati najmanje 3 karaktera.' }, 400)
    }
    if (String(password).length < 6) {
      return json({ error: 'Lozinka mora imati najmanje 6 karaktera.' }, 400)
    }
    if (role !== 'admin' && role !== 'worker') {
      return json({ error: 'Neispravna uloga.' }, 400)
    }

    // Workers may not have a real email → synthesize an internal login email.
    const authEmail = email || `${username}@ldgradnja.local`

    // Create the auth account (pre-confirmed; no public signup needed).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    })
    if (createErr || !created?.user) {
      const msg = createErr?.message || ''
      const friendly = /already been registered|already exists/i.test(msg)
        ? 'Korisničko ime/email je već zauzet.'
        : (msg || 'Kreiranje naloga nije uspjelo.')
      return json({ error: friendly }, 400)
    }

    // Insert the app_users profile row under the calling admin.
    const { data: row, error: insErr } = await admin.from('app_users').insert({
      admin_id: user.id,
      username,
      email: email || null,
      full_name: fullName,
      phone: phone || '',
      role,
      auth_user_id: created.user.id,
    }).select().single()

    if (insErr || !row) {
      // Roll back the orphan auth account so a retry can reuse the username.
      await admin.auth.admin.deleteUser(created.user.id)
      const msg = insErr?.message || ''
      const friendly = /duplicate|unique/i.test(msg)
        ? 'Korisničko ime je već zauzeto.'
        : (msg || 'Upis profila nije uspio.')
      return json({ error: friendly }, 400)
    }

    return json({ user: row }, 200)
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
