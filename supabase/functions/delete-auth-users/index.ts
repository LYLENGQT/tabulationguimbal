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

    // Get all users (we'll delete all non-admin users regardless of request body)
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

    // Delete all users except admin
    // Since we're resetting the system, we delete all non-admin users
    for (const user of usersData.users) {
      // Skip admin user
      const userEmail = user.email?.toLowerCase()
      if (userEmail === adminEmail.toLowerCase()) {
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

