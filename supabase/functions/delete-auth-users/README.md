# Delete Auth Users Edge Function

This Supabase Edge Function securely deletes authentication users server-side during system reset.

## Purpose

When the admin resets the system, this function:
- Deletes judge authentication users from Supabase Auth
- Preserves the admin user (admin@mrmsteen2025.com)
- Uses the service role key server-side (never exposed to client)

## Deployment

1. Login to Supabase:
   ```bash
   supabase login
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy delete-auth-users
   ```

## Usage

The function is called automatically by the `resetSystem()` function in `src/services/supabaseApi.ts`.

**Request Body:**
```json
{
  "judgeEmails": ["judge1@example.com", "judge2@example.com"]
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 2,
  "deletedUsers": ["judge1@example.com", "judge2@example.com"],
  "failedDeletions": []
}
```

## Security

- Uses service role key (automatically available in Edge Functions environment)
- Never exposes sensitive keys to client-side code
- Skips admin user deletion to preserve admin access

