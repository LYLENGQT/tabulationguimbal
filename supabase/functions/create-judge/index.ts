// Creates a judge's auth account and judges row in one server-side step.
//
// Why this exists: creating judges with a browser-side auth.signUp() required
// public sign-ups to stay open (so anyone could self-register) and replaced the
// admin's session with the new judge's. Here the service role key does the work,
// so public sign-ups can be disabled and the admin stays signed in.
//
// Only the admin account may call this.

// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const ADMIN_EMAIL = 'admin@mrmsteen2025.com'
const JUDGE_EMAIL_DOMAIN = 'judge.mrmsteen2025.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

// @ts-ignore - Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })

  // @ts-ignore - Deno is available in Supabase Edge Functions runtime
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  // @ts-ignore - Deno is available in Supabase Edge Functions runtime
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Missing Supabase configuration' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Caller must be signed in as the admin (the anon key alone is not enough)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller } = await admin.auth.getUser(token)
  if (caller?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json(403, { error: 'Only the admin can create judges' })
  }

  let body: { full_name?: string; username?: string; password?: string; division?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Request body must be JSON' })
  }

  const full_name = body.full_name?.trim() ?? ''
  const username = body.username?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  const division = body.division

  if (!full_name) return json(400, { error: 'Full name is required' })
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return json(400, { error: 'Username must be 3-32 letters, numbers, dots, dashes or underscores' })
  }
  if (password.length < 6) return json(400, { error: 'Password must be at least 6 characters' })
  if (division !== 'male' && division !== 'female') return json(400, { error: 'Division must be male or female' })

  const email = `${username}@${JUDGE_EMAIL_DOMAIN}`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, username, division }
  })
  if (createError || !created?.user) {
    return json(400, { error: createError?.message ?? 'Could not create the judge account' })
  }

  const { data: judge, error: judgeError } = await admin
    .from('judges')
    .insert({ full_name, email, username, division })
    .select()
    .single()

  if (judgeError) {
    // Roll back the auth account so a retry with the same username works
    await admin.auth.admin.deleteUser(created.user.id)
    return json(400, { error: `Could not create the judge profile: ${judgeError.message}` })
  }

  return json(200, { judge })
})
