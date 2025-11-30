import pool from '../db.js';
import crypto from 'crypto';
import { sendPlayerInvite, generateCheckInUrl } from '../services/emailService.js';

// Generate unique game code
const generateGameCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate invite token for player check-in
const generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create a new game
export const createGame = async (req, res) => {
  try {
    const { name, numDays, days, tournamentDate, teamAName, teamBName } = req.body;
    const userId = req.user.userId;

    if (!name || !numDays || !days || days.length === 0) {
      return res.status(400).json({ error: 'Game name, number of days, and day configurations required' });
    }

    if (!tournamentDate) {
      return res.status(400).json({ error: 'Tournament date is required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Generate unique game code
      let gameCode;
      let codeExists = true;
      while (codeExists) {
        gameCode = generateGameCode();
        const existing = await client.query('SELECT id FROM games WHERE game_code = $1', [gameCode]);
        codeExists = existing.rows.length > 0;
      }

      // Calculate unlock and expiry times
      const tournamentDateObj = new Date(tournamentDate);
      const unlocksAt = new Date(tournamentDateObj);
      unlocksAt.setHours(unlocksAt.getHours() - 24);
      
      const expiresAt = new Date(tournamentDateObj);
      expiresAt.setDate(expiresAt.getDate() + 7);

      const gameResult = await client.query(
        `INSERT INTO games (name, game_code, created_by, num_days, status, tournament_date, unlocks_at, expires_at, team_a_name, team_b_name) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          name, 
          gameCode, 
          userId, 
          numDays, 
          'lobby',
          tournamentDate,
          unlocksAt,
          expiresAt,
          teamAName || 'Team A',
          teamBName || 'Team B'
        ]
      );

      const game = gameResult.rows[0];

      const dayGroups = {};
      days.forEach(session => {
        if (!dayGroups[session.dayNumber]) {
          dayGroups[session.dayNumber] = {
            dayNumber: session.dayNumber,
            formats: [],
            totalMatches: 0
          };
        }
        dayGroups[session.dayNumber].formats.push(session.format);
        dayGroups[session.dayNumber].totalMatches += session.numMatches;
      });

      for (const dayNum in dayGroups) {
        const dayData = dayGroups[dayNum];
        const formatString = dayData.formats.join(',');
        
        await client.query(
          'INSERT INTO game_days (game_id, day_number, format, num_matches) VALUES ($1, $2, $3, $4)',
          [game.id, dayData.dayNumber, formatString, dayData.totalMatches]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Game created successfully',
        game,
        gameCode
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get game by ID
export const getGame = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = result.rows[0];

    const daysResult = await pool.query(
      'SELECT * FROM game_days WHERE game_id = $1 ORDER BY day_number',
      [id]
    );

    game.days = daysResult.rows;

    const now = new Date();
    const unlocksAt = new Date(game.unlocks_at);
    const expiresAt = new Date(game.expires_at);
    
    if (now < unlocksAt) {
      game.phase = 'lobby';
    } else if (now >= unlocksAt && now < expiresAt) {
      game.phase = 'live';
    } else {
      game.phase = 'expired';
    }

    res.json({ game });

  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get game by code
export const getGameByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      'SELECT * FROM games WHERE game_code = $1',
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found. Check the code and try again.' });
    }

    const game = result.rows[0];

    const daysResult = await pool.query(
      'SELECT * FROM game_days WHERE game_id = $1 ORDER BY day_number',
      [game.id]
    );

    game.days = daysResult.rows;

    const playersResult = await pool.query(
      'SELECT id, name, email, handicap, team, is_captain, checked_in, checked_in_at FROM game_players WHERE game_id = $1 ORDER BY created_at',
      [game.id]
    );

    game.players = playersResult.rows;

    const now = new Date();
    const unlocksAt = new Date(game.unlocks_at);
    const expiresAt = new Date(game.expires_at);
    
    if (now < unlocksAt) {
      game.phase = 'lobby';
    } else if (now >= unlocksAt && now < expiresAt) {
      game.phase = 'live';
    } else {
      game.phase = 'expired';
    }

    res.json({ game });

  } catch (error) {
    console.error('Get game by code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get games created by the logged-in user
export const getMyGames = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT 
        g.*,
        (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
       FROM games g
       WHERE g.created_by = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    const games = result.rows.map(game => {
      const now = new Date();
      const unlocksAt = new Date(game.unlocks_at);
      const expiresAt = new Date(game.expires_at);
      
      if (now < unlocksAt) {
        game.phase = 'lobby';
      } else if (now >= unlocksAt && now < expiresAt) {
        game.phase = 'live';
      } else {
        game.phase = 'expired';
      }
      
      return game;
    });

    res.json({ games });

  } catch (error) {
    console.error('Get my games error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add player to game
export const addPlayer = async (req, res) => {
  try {
    const { gameId, email, name, handicap, isCaptain, sendInvite } = req.body;
    const userId = req.user?.userId || null;

    if (!gameId || !email || !name) {
      return res.status(400).json({ error: 'Game ID, email, and name required' });
    }

    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(game.expires_at);
    
    if (now > expiresAt) {
      return res.status(400).json({ error: 'This tournament has expired' });
    }

    const existingPlayer = await pool.query(
      'SELECT * FROM game_players WHERE game_id = $1 AND email = $2',
      [gameId, email]
    );

    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({ error: 'Player already in this game' });
    }

    const inviteToken = generateInviteToken();

    const result = await pool.query(
      `INSERT INTO game_players (game_id, user_id, email, name, handicap, is_captain, invite_token) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [gameId, userId, email, name, handicap || null, isCaptain || false, inviteToken]
    );

    const player = result.rows[0];

    // Send invite email if requested
    let emailResult = null;
    if (sendInvite) {
      emailResult = await sendPlayerInvite(player, game);
      if (emailResult.success) {
        await pool.query(
          'UPDATE game_players SET invite_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
          [player.id]
        );
      }
    }

    res.status(201).json({
      message: 'Player added successfully',
      player,
      checkInUrl: generateCheckInUrl(inviteToken),
      emailSent: emailResult?.success || false
    });

  } catch (error) {
    console.error('Add player error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update player details
export const updatePlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { name, email, handicap } = req.body;

    const playerResult = await pool.query(
      `SELECT gp.*, g.expires_at FROM game_players gp 
       JOIN games g ON gp.game_id = g.id 
       WHERE gp.id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(player.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({ error: 'This tournament has expired and cannot be edited' });
    }

    const result = await pool.query(
      `UPDATE game_players SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        handicap = COALESCE($3, handicap)
       WHERE id = $4 RETURNING *`,
      [name, email, handicap, playerId]
    );

    res.json({
      message: 'Player updated successfully',
      player: result.rows[0]
    });

  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete player from game
export const deletePlayer = async (req, res) => {
  try {
    const { playerId } = req.params;

    const playerResult = await pool.query(
      `SELECT gp.*, g.status, g.expires_at FROM game_players gp 
       JOIN games g ON gp.game_id = g.id 
       WHERE gp.id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    
    if (player.status === 'completed') {
      return res.status(400).json({ error: 'Cannot remove players from a completed tournament' });
    }

    await pool.query('DELETE FROM game_players WHERE id = $1', [playerId]);

    res.json({ message: 'Player removed successfully' });

  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Check-in player via token
export const checkInPlayer = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `UPDATE game_players 
       SET checked_in = true, checked_in_at = CURRENT_TIMESTAMP 
       WHERE invite_token = $1 
       RETURNING *`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid check-in link' });
    }

    const player = result.rows[0];

    const gameResult = await pool.query(
      'SELECT game_code, name FROM games WHERE id = $1',
      [player.game_id]
    );

    res.json({
      message: 'Checked in successfully!',
      player: result.rows[0],
      gameCode: gameResult.rows[0].game_code,
      gameName: gameResult.rows[0].name
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all players in a game
export const getPlayers = async (req, res) => {
  try {
    const { gameId } = req.params;

    const result = await pool.query(
      `SELECT id, name, email, handicap, team, is_captain, checked_in, checked_in_at, invite_token, invite_sent_at 
       FROM game_players WHERE game_id = $1 ORDER BY created_at`,
      [gameId]
    );

    const players = result.rows;
    const totalPlayers = players.length;
    const checkedInCount = players.filter(p => p.checked_in).length;

    res.json({ 
      players,
      checkInStats: {
        total: totalPlayers,
        checkedIn: checkedInCount,
        pending: totalPlayers - checkedInCount
      }
    });

  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update team names
export const updateTeams = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { teamAName, teamBName, teamAColor, teamBColor } = req.body;

    const result = await pool.query(
      `UPDATE games SET 
        team_a_name = COALESCE($1, team_a_name),
        team_b_name = COALESCE($2, team_b_name),
        team_a_color = COALESCE($3, team_a_color),
        team_b_color = COALESCE($4, team_b_color),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [teamAName, teamBName, teamAColor, teamBColor, gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      message: 'Teams updated successfully',
      game: result.rows[0]
    });

  } catch (error) {
    console.error('Update teams error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send invite to a player
export const sendInvite = async (req, res) => {
  try {
    const { playerId } = req.params;

    const playerResult = await pool.query(
      `SELECT gp.*, g.name as game_name, g.game_code, g.tournament_date 
       FROM game_players gp 
       JOIN games g ON gp.game_id = g.id 
       WHERE gp.id = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const game = {
      name: player.game_name,
      game_code: player.game_code,
      tournament_date: player.tournament_date
    };

    const emailResult = await sendPlayerInvite(player, game);

    if (emailResult.success) {
      await pool.query(
        'UPDATE game_players SET invite_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
        [playerId]
      );
    }

    res.json({
      message: emailResult.success ? 'Invite sent successfully' : 'Failed to send invite',
      success: emailResult.success,
      checkInUrl: generateCheckInUrl(player.invite_token)
    });

  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Check scoring access
export const checkScoringAccess = async (req, res) => {
  try {
    const { gameId } = req.params;

    const result = await pool.query(
      'SELECT id, status, unlocks_at, expires_at FROM games WHERE id = $1',
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = result.rows[0];
    const now = new Date();
    const unlocksAt = new Date(game.unlocks_at);
    const expiresAt = new Date(game.expires_at);

    let canScore = false;
    let reason = '';

    if (now < unlocksAt) {
      reason = 'Tournament has not started yet';
    } else if (now > expiresAt) {
      reason = 'Tournament scoring window has expired';
    } else {
      canScore = true;
    }

    res.json({
      canScore,
      reason,
      unlocksAt: game.unlocks_at,
      expiresAt: game.expires_at,
      currentTime: now.toISOString()
    });

  } catch (error) {
    console.error('Check scoring access error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Save draft pick
export const saveDraftPick = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { pickNumber, team, playerId } = req.body;

    const existingPick = await pool.query(
      'SELECT * FROM draft_picks WHERE game_id = $1 AND pick_number = $2',
      [gameId, pickNumber]
    );

    if (existingPick.rows.length > 0) {
      await pool.query(
        'UPDATE game_players SET team = $1 WHERE id = $2 AND team IS NULL',
        [team, playerId]
      );
      return res.json({ message: 'Draft pick already saved' });
    }

    await pool.query(
      'INSERT INTO draft_picks (game_id, pick_number, team, player_id) VALUES ($1, $2, $3, $4)',
      [gameId, pickNumber, team, playerId]
    );

    await pool.query(
      'UPDATE game_players SET team = $1 WHERE id = $2',
      [team, playerId]
    );

    res.json({ message: 'Draft pick saved successfully' });

  } catch (error) {
    console.error('Save draft pick error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Auto draft - Random
export const autoDraftRandom = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { gameId } = req.params;
    const { availablePlayers, teamAIds, teamBIds } = req.body;

    const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);
    
    const teamA = [];
    const teamB = [];
    const draftOrder = [];
    
    for (let i = 0; i < shuffled.length; i++) {
      const round = Math.floor(i / 2);
      const pickInRound = i % 2;
      
      let team;
      if (round % 2 === 0) {
        team = pickInRound === 0 ? 'A' : 'B';
      } else {
        team = pickInRound === 0 ? 'B' : 'A';
      }
      
      const player = shuffled[i];
      const pickNumber = i + 1;
      
      if (team === 'A') {
        teamA.push(player.id);
      } else {
        teamB.push(player.id);
      }

      draftOrder.push({ ...player, team, pickNumber });

      const existing = await client.query(
        'SELECT * FROM draft_picks WHERE game_id = $1 AND pick_number = $2',
        [gameId, pickNumber]
      );

      if (existing.rows.length === 0) {
        await client.query(
          'INSERT INTO draft_picks (game_id, pick_number, team, player_id) VALUES ($1, $2, $3, $4)',
          [gameId, pickNumber, team, player.id]
        );
      }

      await client.query(
        'UPDATE game_players SET team = $1 WHERE id = $2',
        [team, player.id]
      );
    }

    await client.query('COMMIT');

    res.json({ 
      message: 'Auto draft completed',
      teamA: [...teamAIds, ...teamA],
      teamB: [...teamBIds, ...teamB],
      draftOrder
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Auto draft random error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  } finally {
    client.release();
  }
};

// Auto draft - Balanced
export const autoDraftBalanced = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { gameId } = req.params;
    const { availablePlayers, teamAIds, teamBIds } = req.body;

    const sorted = [...availablePlayers].sort((a, b) => {
      const hcpA = a.handicap || 999;
      const hcpB = b.handicap || 999;
      return hcpA - hcpB;
    });

    const teamA = [];
    const teamB = [];
    const draftOrder = [];

    for (let i = 0; i < sorted.length; i++) {
      const round = Math.floor(i / 2);
      const pickInRound = i % 2;
      
      let team;
      if (round % 2 === 0) {
        team = pickInRound === 0 ? 'A' : 'B';
      } else {
        team = pickInRound === 0 ? 'B' : 'A';
      }
      
      const player = sorted[i];
      const pickNumber = i + 1;
      
      if (team === 'A') {
        teamA.push(player.id);
      } else {
        teamB.push(player.id);
      }

      draftOrder.push({ ...player, team, pickNumber });

      const existing = await client.query(
        'SELECT * FROM draft_picks WHERE game_id = $1 AND pick_number = $2',
        [gameId, pickNumber]
      );

      if (existing.rows.length === 0) {
        await client.query(
          'INSERT INTO draft_picks (game_id, pick_number, team, player_id) VALUES ($1, $2, $3, $4)',
          [gameId, pickNumber, team, player.id]
        );
      }

      await client.query(
        'UPDATE game_players SET team = $1 WHERE id = $2',
        [team, player.id]
      );
    }

    await client.query('COMMIT');

    res.json({ 
      message: 'Auto draft completed',
      teamA: [...teamAIds, ...teamA],
      teamB: [...teamBIds, ...teamB],
      draftOrder
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Auto draft balanced error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  } finally {
    client.release();
  }
};

// Finalize draft
export const finalizeDraft = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { draftMode } = req.body; // 'captains', 'random', or 'balanced'

    await pool.query(
      "UPDATE games SET status = 'draft_complete', draft_mode = $1 WHERE id = $2",
      [draftMode || 'captains', gameId]
    );

    res.json({ message: 'Draft finalized successfully' });

  } catch (error) {
    console.error('Finalize draft error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create matches
export const createMatches = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { matches } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const match of matches) {
        await client.query(
          `INSERT INTO matches (game_id, day_number, match_number, format, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            gameId,
            match.dayNumber,
            match.matchNumber,
            match.format,
            match.teamAPlayer1,
            match.teamAPlayer2 || null,
            match.teamBPlayer1,
            match.teamBPlayer2 || null,
            'not_started'
          ]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Matches created successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all matches
export const getMatches = async (req, res) => {
  try {
    const { gameId } = req.params;

    const result = await pool.query(
      `SELECT m.*, 
       p1a.name as team_a_player1_name, p1a.handicap as team_a_player1_handicap,
       p2a.name as team_a_player2_name, p2a.handicap as team_a_player2_handicap,
       p1b.name as team_b_player1_name, p1b.handicap as team_b_player1_handicap,
       p2b.name as team_b_player2_name, p2b.handicap as team_b_player2_handicap
       FROM matches m
       LEFT JOIN game_players p1a ON m.team_a_player1_id = p1a.id
       LEFT JOIN game_players p2a ON m.team_a_player2_id = p2a.id
       LEFT JOIN game_players p1b ON m.team_b_player1_id = p1b.id
       LEFT JOIN game_players p2b ON m.team_b_player2_id = p2b.id
       WHERE m.game_id = $1
       ORDER BY m.day_number, m.match_number`,
      [gameId]
    );

    res.json({ matches: result.rows });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get single match
export const getMatch = async (req, res) => {
  try {
    const { matchId } = req.params;

    const matchResult = await pool.query(
      `SELECT m.*, 
       p1a.name as team_a_player1_name, p1a.handicap as team_a_player1_handicap,
       p2a.name as team_a_player2_name, p2a.handicap as team_a_player2_handicap,
       p1b.name as team_b_player1_name, p1b.handicap as team_b_player1_handicap,
       p2b.name as team_b_player2_name, p2b.handicap as team_b_player2_handicap
       FROM matches m
       LEFT JOIN game_players p1a ON m.team_a_player1_id = p1a.id
       LEFT JOIN game_players p2a ON m.team_a_player2_id = p2a.id
       LEFT JOIN game_players p1b ON m.team_b_player1_id = p1b.id
       LEFT JOIN game_players p2b ON m.team_b_player2_id = p2b.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    const holesResult = await pool.query(
      'SELECT * FROM holes WHERE match_id = $1 ORDER BY hole_number',
      [matchId]
    );

    match.holes = holesResult.rows;

    res.json({ match });

  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Record hole
export const recordHole = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { holeNumber, winner } = req.body;

    const matchResult = await pool.query(
      `SELECT m.*, g.unlocks_at, g.expires_at FROM matches m 
       JOIN games g ON m.game_id = g.id 
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const now = new Date();
    const unlocksAt = new Date(match.unlocks_at);
    const expiresAt = new Date(match.expires_at);

    if (now < unlocksAt) {
      return res.status(400).json({ error: 'Scoring has not started yet' });
    }

    if (now > expiresAt) {
      return res.status(400).json({ error: 'Scoring window has expired' });
    }

    const existingHole = await pool.query(
      'SELECT * FROM holes WHERE match_id = $1 AND hole_number = $2',
      [matchId, holeNumber]
    );

    if (existingHole.rows.length > 0) {
      await pool.query(
        'UPDATE holes SET winner = $1 WHERE match_id = $2 AND hole_number = $3',
        [winner, matchId, holeNumber]
      );
    } else {
      await pool.query(
        'INSERT INTO holes (match_id, hole_number, winner) VALUES ($1, $2, $3)',
        [matchId, holeNumber, winner]
      );
    }

    const holesResult = await pool.query(
      'SELECT * FROM holes WHERE match_id = $1 ORDER BY hole_number',
      [matchId]
    );

    const holes = holesResult.rows;
    let teamAScore = 0;
    let teamBScore = 0;

    holes.forEach(hole => {
      if (hole.winner === 'A') teamAScore++;
      else if (hole.winner === 'B') teamBScore++;
    });

    const diff = teamAScore - teamBScore;
    const holesPlayed = holes.length;
    const holesRemaining = 18 - holesPlayed;
    
    let matchStatus = 'in_progress';
    let matchWinner = null;

    if (Math.abs(diff) > holesRemaining && holesRemaining > 0) {
      matchStatus = 'completed';
      matchWinner = diff > 0 ? 'A' : 'B';
    } else if (holesPlayed === 18) {
      matchStatus = 'completed';
      if (diff === 0) matchWinner = 'halved';
      else matchWinner = diff > 0 ? 'A' : 'B';
    }

    await pool.query(
      'UPDATE matches SET team_a_score = $1, team_b_score = $2, status = $3, winner = $4 WHERE id = $5',
      [teamAScore, teamBScore, matchStatus, matchWinner, matchId]
    );

    res.json({ 
      message: 'Hole recorded successfully',
      teamAScore,
      teamBScore,
      matchStatus,
      matchWinner
    });

  } catch (error) {
    console.error('Record hole error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete hole
export const deleteFromHole = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { holeNumber } = req.body;

    const matchResult = await pool.query(
      `SELECT m.*, g.unlocks_at, g.expires_at FROM matches m 
       JOIN games g ON m.game_id = g.id 
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const now = new Date();
    const expiresAt = new Date(match.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({ error: 'Scoring window has expired' });
    }

    await pool.query(
      'DELETE FROM holes WHERE match_id = $1 AND hole_number >= $2',
      [matchId, holeNumber]
    );

    const holesResult = await pool.query(
      'SELECT * FROM holes WHERE match_id = $1 ORDER BY hole_number',
      [matchId]
    );

    const holes = holesResult.rows;
    let teamAScore = 0;
    let teamBScore = 0;

    holes.forEach(hole => {
      if (hole.winner === 'A') teamAScore++;
      else if (hole.winner === 'B') teamBScore++;
    });

    const diff = teamAScore - teamBScore;
    const holesPlayed = holes.length;
    const holesRemaining = 18 - holesPlayed;
    
    let matchStatus;
    let matchWinner;

    if (holesPlayed === 0) {
      matchStatus = 'not_started';
      matchWinner = null;
    } else if (holesPlayed === 18) {
      matchStatus = 'completed';
      matchWinner = diff === 0 ? 'halved' : (diff > 0 ? 'A' : 'B');
    } else if (Math.abs(diff) > holesRemaining) {
      matchStatus = 'completed';
      matchWinner = diff > 0 ? 'A' : 'B';
    } else {
      matchStatus = 'in_progress';
      matchWinner = null;
    }

    await pool.query(
      'UPDATE matches SET team_a_score = $1, team_b_score = $2, status = $3, winner = $4 WHERE id = $5',
      [teamAScore, teamBScore, matchStatus, matchWinner, matchId]
    );

    res.json({ 
      message: 'Holes deleted successfully',
      teamAScore,
      teamBScore,
      matchStatus,
      matchWinner,
      holesPlayed
    });

  } catch (error) {
    console.error('Delete holes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a game (only by the creator)
export const deleteGame = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check if game exists and user is the creator
    const gameResult = await client.query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    );

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    if (game.created_by !== userId) {
      return res.status(403).json({ error: 'You can only delete games you created' });
    }

    await client.query('BEGIN');

    // Delete in order due to foreign key constraints
    // 1. Delete holes (references matches)
    await client.query(
      'DELETE FROM holes WHERE match_id IN (SELECT id FROM matches WHERE game_id = $1)',
      [id]
    );

    // 2. Delete matches
    await client.query('DELETE FROM matches WHERE game_id = $1', [id]);

    // 3. Delete draft picks
    await client.query('DELETE FROM draft_picks WHERE game_id = $1', [id]);

    // 4. Delete game players
    await client.query('DELETE FROM game_players WHERE game_id = $1', [id]);

    // 5. Delete game days
    await client.query('DELETE FROM game_days WHERE game_id = $1', [id]);

    // 6. Delete the game itself
    await client.query('DELETE FROM games WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ message: 'Game deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// Reset draft - clear team assignments and allow re-drafting
export const resetDraft = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check if game exists and user is the creator
    const gameResult = await client.query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    );

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    if (game.created_by !== userId) {
      return res.status(403).json({ error: 'You can only reset drafts for games you created' });
    }

    await client.query('BEGIN');

    // 1. Delete holes (scores)
    await client.query(
      'DELETE FROM holes WHERE match_id IN (SELECT id FROM matches WHERE game_id = $1)',
      [id]
    );

    // 2. Delete matches
    await client.query('DELETE FROM matches WHERE game_id = $1', [id]);

    // 3. Delete draft picks
    await client.query('DELETE FROM draft_picks WHERE game_id = $1', [id]);

    // 4. Clear team assignments from players (but keep the players)
    await client.query(
      'UPDATE game_players SET team = NULL, is_captain = false WHERE game_id = $1',
      [id]
    );

    // 5. Reset game status back to 'pending' (pre-draft)
    await client.query(
      'UPDATE games SET status = $1, draft_mode = NULL WHERE id = $2',
      ['pending', id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Draft reset successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset draft error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// Get leaderboard
export const getLeaderboard = async (req, res) => {
  try {
    const { gameId } = req.params;

    const matchesResult = await pool.query(
      'SELECT * FROM matches WHERE game_id = $1',
      [gameId]
    );

    const matches = matchesResult.rows;
    let teamAPoints = 0;
    let teamBPoints = 0;

    matches.forEach(match => {
      if (match.winner === 'A') teamAPoints += 1;
      else if (match.winner === 'B') teamBPoints += 1;
      else if (match.winner === 'halved') {
        teamAPoints += 0.5;
        teamBPoints += 0.5;
      }
    });

    const gameResult = await pool.query(
      'SELECT team_a_name, team_b_name FROM games WHERE id = $1',
      [gameId]
    );

    const game = gameResult.rows[0];

    // Also update game's team scores
    await pool.query(
      'UPDATE games SET team_a_score = $1, team_b_score = $2 WHERE id = $3',
      [teamAPoints, teamBPoints, gameId]
    );

    res.json({
      teamAPoints,
      teamBPoints,
      teamAName: game?.team_a_name || 'Team A',
      teamBName: game?.team_b_name || 'Team B',
      totalMatches: matches.length,
      completedMatches: matches.filter(m => m.status === 'completed').length
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a single match
export const deleteMatch = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { gameId, matchId } = req.params;

    // Verify match exists and belongs to this game
    const matchResult = await client.query(
      'SELECT * FROM matches WHERE id = $1 AND game_id = $2',
      [matchId, gameId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    await client.query('BEGIN');

    // Delete all holes for this match first
    await client.query('DELETE FROM holes WHERE match_id = $1', [matchId]);

    // Delete the match
    await client.query('DELETE FROM matches WHERE id = $1', [matchId]);

    // Re-number remaining matches
    const remainingMatches = await client.query(
      'SELECT id FROM matches WHERE game_id = $1 ORDER BY match_number',
      [gameId]
    );

    for (let i = 0; i < remainingMatches.rows.length; i++) {
      await client.query(
        'UPDATE matches SET match_number = $1 WHERE id = $2',
        [i + 1, remainingMatches.rows[i].id]
      );
    }

    // Update game scores
    await updateGameTeamScores(client, gameId);

    await client.query('COMMIT');

    res.json({ message: 'Match deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// Delete all matches for a game
export const deleteAllMatches = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { gameId } = req.params;

    await client.query('BEGIN');

    // Delete all holes for all matches in this game
    await client.query(
      'DELETE FROM holes WHERE match_id IN (SELECT id FROM matches WHERE game_id = $1)',
      [gameId]
    );

    // Delete all matches
    await client.query('DELETE FROM matches WHERE game_id = $1', [gameId]);

    // Reset game scores to 0
    await client.query(
      'UPDATE games SET team_a_score = 0, team_b_score = 0 WHERE id = $1',
      [gameId]
    );

    await client.query('COMMIT');

    res.json({ message: 'All matches deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete all matches error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// Helper function to update game team scores based on match results
const updateGameTeamScores = async (client, gameId) => {
  const matchesResult = await client.query(
    'SELECT winner FROM matches WHERE game_id = $1',
    [gameId]
  );

  let teamAPoints = 0;
  let teamBPoints = 0;

  matchesResult.rows.forEach(match => {
    if (match.winner === 'A') teamAPoints += 1;
    else if (match.winner === 'B') teamBPoints += 1;
    else if (match.winner === 'halved') {
      teamAPoints += 0.5;
      teamBPoints += 0.5;
    }
  });

  await client.query(
    'UPDATE games SET team_a_score = $1, team_b_score = $2 WHERE id = $3',
    [teamAPoints, teamBPoints, gameId]
  );

  return { teamAPoints, teamBPoints };
};