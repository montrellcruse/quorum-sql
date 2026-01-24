import { createPool } from './db.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function seedAdminUser(pool: ReturnType<typeof createPool>) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    // Check if admin user exists
    const { rows: existing } = await client.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [adminEmail.toLowerCase()]
    );

    if (existing.length > 0) {
      // Update existing admin password
      await client.query(
        'UPDATE auth.users SET encrypted_password = $1, full_name = $2 WHERE email = $3',
        [hashedPassword, adminName, adminEmail.toLowerCase()]
      );
      console.log(`Updated admin user: ${adminEmail}`);
    } else {
      // Create new admin user
      await client.query(
        `INSERT INTO auth.users (id, email, full_name, encrypted_password)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [adminEmail.toLowerCase(), adminName, hashedPassword]
      );
      console.log(`Created admin user: ${adminEmail}`);
    }
  } finally {
    client.release();
  }
}

async function main() {
  const pool = createPool();
  try {
    await seedAdminUser(pool);
    console.log('Seed complete');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
