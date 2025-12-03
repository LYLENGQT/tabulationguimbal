import { createClient } from '@supabase/supabase-js';

/**
 * One-time script to seed an admin auth user in Supabase.
 *
 * Usage (from project root):
 *   1) Create a .env.seeder file (DO NOT commit) with:
 *        SUPABASE_URL=...
 *        SUPABASE_SERVICE_ROLE_KEY=...
 *   2) Run:
 *        npx ts-node scripts/seed-admin.ts
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in your environment before running this script.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  console.log(`Creating admin user ${email} ...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'admin'
    }
  });

  if (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }

  console.log('Admin seeded:', data.user?.id, data.user?.email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


