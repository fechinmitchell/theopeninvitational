import pool from '../db.js';

async function migratePasswordReset() {
  try {
    console.log('🚀 Starting password reset migration...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Add reset token columns to users table
      console.log('🔐 Updating users table...');
      
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
      `);
      console.log('  → Added reset_token column');
      
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
      `);
      console.log('  → Added reset_token_expires column');

      // Create index for faster token lookups
      console.log('🔍 Creating indexes...');
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
      `);
      console.log('  → Added index on reset_token');

      await client.query('COMMIT');
      
      console.log('');
      console.log('✅ Password reset migration completed successfully!');
      console.log('');
      console.log('New features added:');
      console.log('  • Password reset token storage');
      console.log('  • Token expiration tracking');
      console.log('  • Index for fast token lookups');
      console.log('');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migratePasswordReset();