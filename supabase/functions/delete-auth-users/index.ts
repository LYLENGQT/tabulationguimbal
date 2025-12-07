// @deno-types="https://esm.sh/@supabase/supabase-js@2.39.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Note: Deno types are not available in local TypeScript environment
// This is expected and won't affect the function when deployed to Supabase
// @ts-ignore - Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get service role key from environment (automatically available in Edge Functions)
    // @ts-ignore - Deno is available in Supabase Edge Functions runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore - Deno is available in Supabase Edge Functions runtime
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Parse request body (optional)
    let requestBody: { emails?: string[] } = {}
    try {
      const bodyText = await req.text()
      if (bodyText) {
        requestBody = JSON.parse(bodyText)
      }
    } catch (e) {
      // Body is optional, continue without it
    }

    // Get all users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      return new Response(
        JSON.stringify({ error: `Failed to list users: ${listError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const deletedUsers: string[] = []
    const failedDeletions: Array<{ email: string; error: string }> = []
    const adminEmail = 'admin@mrmsteen2025.com'
    const emailsToDelete = requestBody.emails?.map((e: string) => e?.toLowerCase()).filter(Boolean) || []

    // If specific emails provided, only delete those. Otherwise, delete all non-admin users
    const shouldDeleteAll = emailsToDelete.length === 0

    for (const user of usersData.users) {
      // Skip admin user
      const userEmail = user.email?.toLowerCase()
      if (userEmail === adminEmail.toLowerCase()) {
        continue
      }

      // If specific emails provided, only delete if email matches
      if (!shouldDeleteAll && userEmail && !emailsToDelete.includes(userEmail)) {
        continue
      }

      // Delete the user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        failedDeletions.push({
          email: user.email || user.id,
          error: deleteError.message
        })
      } else {
        deletedUsers.push(user.email || user.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: deletedUsers.length,
        deletedUsers,
        failedDeletions
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

