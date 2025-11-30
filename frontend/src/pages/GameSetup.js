import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GameSetup.css';

function GameSetup() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add player form
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerHandicap, setPlayerHandicap] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const [gameRes, playersRes] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/games/${gameId}/players`)
      ]);
      
      setGame(gameRes.data.game);
      setPlayers(playersRes.data.players);
      setLoading(false);
    } catch (err) {
      setError('Failed to load game data');
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setError('');
    setAddingPlayer(true);

    try {
      await api.post('/games/add-player', {
        gameId: parseInt(gameId),
        email: playerEmail,
        name: playerName,
        handicap: playerHandicap ? parseFloat(playerHandicap) : null,
        isCaptain
      });

      // Reset form
      setPlayerEmail('');
      setPlayerName('');
      setPlayerHandicap('');
      setIsCaptain(false);

      // Refresh players list
      await fetchGameData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add player');
    }

    setAddingPlayer(false);
  };

  const handleStartDraft = () => {
    const captains = players.filter(p => p.is_captain);
    
    if (captains.length !== 2) {
      setError('You need exactly 2 captains to start the draft');
      return;
    }

    if (players.length < 4) {
      setError('You need at least 4 players to start');
      return;
    }

    navigate(`/game/${gameId}/draft`);
  };

  if (loading) {
    return (
      <div className="game-setup-container">
        <div className="game-setup-content glass-card">
          <p style={{ textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-setup-container">
        <div className="game-setup-content glass-card">
          <p style={{ textAlign: 'center', color: 'var(--ryder-red)' }}>Game not found</p>
        </div>
      </div>
    );
  }

  const captains = players.filter(p => p.is_captain);

  return (
    <div className="game-setup-container">
      <div className="game-setup-content glass-card">
        <h2 className="game-setup-title">{game.name}</h2>
        <p className="game-setup-subtitle">Invite players and select captains</p>

        {error && <div className="error-message">{error}</div>}

        {/* Add Player Form */}
        <div className="add-player-section">
          <h3>Add Player</h3>
          <form onSubmit={handleAddPlayer} className="add-player-form">
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={playerEmail}
                  onChange={(e) => setPlayerEmail(e.target.value)}
                  placeholder="player@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player Name"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Handicap (Optional)</label>
                <input
                  type="number"
                  step="0.1"
                  value={playerHandicap}
                  onChange={(e) => setPlayerHandicap(e.target.value)}
                  placeholder="e.g., 12.5"
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={isCaptain}
                    onChange={(e) => setIsCaptain(e.target.checked)}
                    disabled={captains.length >= 2 && !isCaptain}
                  />
                  <span>Make Captain</span>
                </label>
              </div>
            </div>

            <button type="submit" disabled={addingPlayer} className="add-player-btn">
              {addingPlayer ? 'Adding...' : '+ Add Player'}
            </button>
          </form>
        </div>

        {/* Players List */}
        <div className="players-section">
          <h3>Players ({players.length})</h3>
          
          {players.length === 0 ? (
            <p className="no-players">No players added yet. Add your first player above!</p>
          ) : (
            <div className="players-list">
              {players.map(player => (
                <div key={player.id} className={`player-card ${player.is_captain ? 'captain' : ''}`}>
                  <div className="player-info">
                    <div className="player-name">
                      {player.name}
                      {player.is_captain && <span className="captain-badge">CAPTAIN</span>}
                    </div>
                    <div className="player-details">
                      {player.email} {player.handicap && `• HC: ${player.handicap}`}
                    </div>
                  </div>
                  {player.team && (
                    <div className={`player-team team-${player.team.toLowerCase()}`}>
                      Team {player.team}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="setup-actions">
          {captains.length === 2 && players.length >= 4 && (
            <button onClick={handleStartDraft} className="team-usa">
              Start Draft
            </button>
          )}
          {captains.length < 2 && (
            <p className="setup-hint">Select 2 captains to start the draft</p>
          )}
          {captains.length === 2 && players.length < 4 && (
            <p className="setup-hint">Add at least 4 players to start</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameSetup;