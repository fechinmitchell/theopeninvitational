import pool from '../db.js';

async function migrateLobbyFeatures() {
  try {
    console.log('🚀 Starting lobby features migration...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Add new columns to games table
      console.log('📦 Updating games table...');
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS game_code VARCHAR(8) UNIQUE;
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS tournament_date DATE;
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS unlocks_at TIMESTAMP;
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_a_name VARCHAR(100) DEFAULT 'Team A';
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_b_name VARCHAR(100) DEFAULT 'Team B';
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_a_color VARCHAR(7) DEFAULT '#00205B';
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_b_color VARCHAR(7) DEFAULT '#CE1126';
      `);
      
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);

      // NEW: Add draft_mode column
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS draft_mode VARCHAR(20);
      `);
      console.log('  → Added draft_mode column');

      // NEW: Add team scores columns for score preview
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_a_score DECIMAL(5,1) DEFAULT 0;
      `);
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS team_b_score DECIMAL(5,1) DEFAULT 0;
      `);
      console.log('  → Added team score columns');

      // NEW: Add max_players column
      await client.query(`
        ALTER TABLE games ADD COLUMN IF NOT EXISTS max_players INTEGER;
      `);
      console.log('  → Added max_players column');

      // Add new columns to game_players table
      console.log('👥 Updating game_players table...');
      
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) UNIQUE;
      `);
      
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP;
      `);
      
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;
      `);
      
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
      `);
      
      await client.query(`
        ALTER TABLE game_players ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
      `);

      // Create indexes for better performance
      console.log('🔍 Creating indexes...');
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_games_game_code ON games(game_code);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_games_draft_mode ON games(draft_mode);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_game_players_invite_token ON game_players(invite_token);
      `);

      // Generate game codes for existing games that don't have one
      console.log('🎲 Generating game codes for existing games...');
      
      const existingGames = await client.query(
        'SELECT id FROM games WHERE game_code IS NULL'
      );
      
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (const game of existingGames.rows) {
        let code;
        let codeExists = true;
        while (codeExists) {
          code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const existing = await client.query(
            'SELECT id FROM games WHERE game_code = $1', 
            [code]
          );
          codeExists = existing.rows.length > 0;
        }
        
        await client.query(
          'UPDATE games SET game_code = $1 WHERE id = $2',
          [code, game.id]
        );
        console.log(`  → Game ${game.id} assigned code: ${code}`);
      }

      await client.query('COMMIT');
      
      console.log('');
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('New features added:');
      console.log('  • Game codes for sharing');
      console.log('  • Tournament dates with unlock/expiry times');
      console.log('  • Custom team names and colors');
      console.log('  • Player check-in system');
      console.log('  • Draft mode tracking (captains/random/balanced)');
      console.log('  • Team score columns for live preview');
      console.log('  • Max players setting');
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

migrateLobbyFeatures();