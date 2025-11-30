import express from 'express';
import { 
  createGame, 
  getGame,
  getGameByCode,
  getMyGames,
  deleteGame,
  resetDraft,
  addPlayer,
  updatePlayer,
  deletePlayer,
  getPlayers,
  checkInPlayer,
  updateTeams,
  sendInvite,
  checkScoringAccess,
  saveDraftPick,
  autoDraftRandom,
  autoDraftBalanced,
  finalizeDraft,
  createMatches,
  getMatches,
  getMatch,
  deleteMatch,
  deleteAllMatches,
  recordHole,
  deleteFromHole,
  getLeaderboard
} from '../controllers/gameController.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/create', authenticateToken, createGame);
router.get('/my-games', authenticateToken, getMyGames);
router.delete('/:id', authenticateToken, deleteGame);
router.post('/:id/reset-draft', authenticateToken, resetDraft);

// Public routes - Game access by code
router.get('/code/:code', getGameByCode);

// Check-in route (public)
router.post('/checkin/:token', checkInPlayer);

// Game routes
router.get('/:id', getGame);
router.get('/:gameId/scoring-access', checkScoringAccess);

// Player routes
router.post('/add-player', optionalAuth, addPlayer);
router.get('/:gameId/players', getPlayers);
router.put('/player/:playerId', optionalAuth, updatePlayer);
router.delete('/player/:playerId', optionalAuth, deletePlayer);
router.post('/player/:playerId/send-invite', sendInvite);

// Team customization
router.put('/:gameId/teams', optionalAuth, updateTeams);

// Draft routes
router.post('/:gameId/draft-pick', saveDraftPick);
router.post('/:gameId/auto-draft-random', autoDraftRandom);
router.post('/:gameId/auto-draft-balanced', autoDraftBalanced);
router.post('/:gameId/finalize-draft', finalizeDraft);

// Match routes
router.post('/:gameId/create-matches', createMatches);
router.get('/:gameId/matches', getMatches);
router.delete('/:gameId/matches', deleteAllMatches);
router.get('/match/:matchId', getMatch);
router.delete('/:gameId/match/:matchId', deleteMatch);
router.post('/match/:matchId/record-hole', recordHole);
router.post('/match/:matchId/delete-from-hole', deleteFromHole);
router.get('/:gameId/leaderboard', getLeaderboard);

export default router;