import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Lobby.css';

function Lobby() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [copied, setCopied] = useState(false);

  // Modal states
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showEditPlayer, setShowEditPlayer] = useState(null);
  const [editingTeams, setEditingTeams] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showRedraftModal, setShowRedraftModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingDraft, setResettingDraft] = useState(false);

  // Form states
  const [newPlayer, setNewPlayer] = useState({ name: '', email: '', handicap: '', sendInvite: true });
  const [editPlayer, setEditPlayer] = useState({ name: '', email: '', handicap: '' });
  const [teamNames, setTeamNames] = useState({ teamA: '', teamB: '' });

  // Refs to prevent stale closure issues and track if countdown has expired
  const countdownExpiredRef = useRef(false);
  const gameRef = useRef(null);

  const fetchGame = useCallback(async () => {
    try {
      const response = await api.get(`/games/code/${code}`);
      setGame(response.data.game);
      gameRef.current = response.data.game;
      setTeamNames({
        teamA: response.data.game.team_a_name || 'Team A',
        teamB: response.data.game.team_b_name || 'Team B'
      });
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tournament');
      setLoading(false);
    }
  }, [code]);

  // Initial fetch and polling interval
  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 10000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  // Countdown timer - separate effect with proper cleanup
  useEffect(() => {
    if (!game?.unlocks_at) return;

    // Reset expired flag when unlocks_at changes
    countdownExpiredRef.current = false;

    const calculateCountdown = () => {
      const now = new Date();
      const unlocks = new Date(game.unlocks_at);
      const diff = unlocks - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        
        // Only fetch once when countdown expires
        if (!countdownExpiredRef.current) {
          countdownExpiredRef.current = true;
          fetchGame();
        }
        return true; // Signal that countdown is done
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
      return false; // Countdown still running
    };

    // Calculate immediately
    const isDone = calculateCountdown();
    
    // Only start interval if countdown isn't already done
    if (!isDone) {
      const timer = setInterval(() => {
        const expired = calculateCountdown();
        if (expired) {
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [game?.unlocks_at, fetchGame]);

  const copyGameCode = () => {
    navigator.clipboard.writeText(game.game_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteMessage = () => {
    const date = formatDate(game.tournament_date);
    const message = `🏌️ You're invited to ${game.name}!\n\n📅 Date: ${date}\n🎯 Game Code: ${game.game_code}\n\nJoin here: ${window.location.origin}/tournament/${game.game_code}`;
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/tournament/${game.game_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: game.name,
          text: `Join my golf tournament! Code: ${game.game_code}`,
          url: url
        });
      } catch (err) {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/games/add-player', {
        gameId: game.id,
        name: newPlayer.name,
        email: newPlayer.email,
        handicap: newPlayer.handicap ? parseInt(newPlayer.handicap) : null,
        sendInvite: newPlayer.sendInvite
      });
      setNewPlayer({ name: '', email: '', handicap: '', sendInvite: true });
      setShowAddPlayer(false);
      fetchGame();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add player');
    }
  };

  const handleUpdatePlayer = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/games/player/${showEditPlayer.id}`, {
        name: editPlayer.name,
        email: editPlayer.email,
        handicap: editPlayer.handicap ? parseInt(editPlayer.handicap) : null
      });
      setShowEditPlayer(null);
      fetchGame();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update player');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm('Remove this player from the tournament?')) return;
    try {
      await api.delete(`/games/player/${playerId}`);
      fetchGame();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove player');
    }
  };

  const handleSendInvite = async (playerId) => {
    try {
      await api.post(`/games/player/${playerId}/send-invite`);
      alert('Invite sent!');
      fetchGame();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send invite');
    }
  };

  const handleUpdateTeams = async () => {
    try {
      await api.put(`/games/${game.id}/teams`, {
        teamAName: teamNames.teamA,
        teamBName: teamNames.teamB
      });
      setEditingTeams(false);
      fetchGame();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update teams');
    }
  };

  const openEditPlayer = (player) => {
    setEditPlayer({
      name: player.name,
      email: player.email || '',
      handicap: player.handicap || ''
    });
    setShowEditPlayer(player);
  };

  // Handle draft option selection
  const handleDraftOption = (option) => {
    setShowDraftModal(false);
    navigate(`/game/${game.id}/draft?mode=${option}`);
  };

  // Handle re-draft - reset teams and start new draft
  const handleRedraft = async (option) => {
    setResettingDraft(true);
    try {
      // Reset the draft (clear team assignments)
      await api.post(`/games/${game.id}/reset-draft`);
      setShowRedraftModal(false);
      // Navigate to draft with selected mode
      navigate(`/game/${game.id}/draft?mode=${option}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset draft');
      setResettingDraft(false);
    }
  };

  // Handle tournament deletion
  const handleDeleteTournament = async () => {
    setDeleting(true);
    try {
      await api.delete(`/games/${game.id}`);
      navigate('/my-games');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete tournament');
      setDeleting(false);
    }
  };

  // Check if current user is the creator
  const isCreator = user && game && game.created_by === user.userId;

  // Get phase info for status badge
  const getPhaseInfo = () => {
    if (!game) return { label: '', className: '', icon: '' };
    
    switch (game.phase) {
      case 'lobby':
        return { label: 'In Lobby', className: 'phase-lobby', icon: '⏳' };
      case 'live':
        return { label: 'Live', className: 'phase-live', icon: '🏌️' };
      case 'expired':
        return { label: 'Completed', className: 'phase-completed', icon: '🏆' };
      default:
        return { label: '', className: '', icon: '' };
    }
  };

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lobby-container">
        <div className="error-state glass-card">
          <div className="error-icon">⚠️</div>
          <h2>Tournament Not Found</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/join')}>Enter Game Code</button>
        </div>
      </div>
    );
  }

  const players = game.players || [];
  const teamAPlayers = players.filter(p => p.team === 'A');
  const teamBPlayers = players.filter(p => p.team === 'B');
  const unassignedPlayers = players.filter(p => !p.team);
  const checkedInCount = players.filter(p => p.checked_in).length;
  const allCheckedIn = players.length > 0 && checkedInCount === players.length;
  const minPlayersForDraft = 4;
  const isDraftComplete = game.status === 'draft_complete';
  const phaseInfo = getPhaseInfo();

  // Calculate team scores (placeholder - would need actual score data)
  const teamAScore = game.team_a_score || 0;
  const teamBScore = game.team_b_score || 0;

  return (
    <div className="lobby-container">
      {/* Top Navigation Bar */}
      <div className="lobby-top-nav">
        <button onClick={() => navigate('/my-games')} className="back-btn">
          ← My Games
        </button>
        
        <div className={`tournament-status-badge ${phaseInfo.className}`}>
          <span className="status-icon">{phaseInfo.icon}</span>
          <span className="status-label">{phaseInfo.label}</span>
        </div>

        {isCreator && (
          <button 
            onClick={() => setShowDeleteModal(true)} 
            className="delete-tournament-btn"
            title="Delete Tournament"
          >
            🗑️
          </button>
        )}
      </div>

      <div className="lobby-header">
        <h1 className="tournament-name">{game.name}</h1>
        
        <div className="game-code-box" onClick={copyGameCode}>
          <span className="code-label">Game Code</span>
          <span className="code-value">{game.game_code}</span>
          <span className="copy-hint">{copied ? '✓ Copied!' : 'Click to copy'}</span>
        </div>
      </div>

      {/* Score Preview Banner */}
      <div className="score-preview-banner glass-card">
        <div className="score-team team-a">
          <span className="score-team-name">{game.team_a_name || 'Team A'}</span>
          <span className="score-value">{teamAScore}</span>
        </div>
        <div className="score-divider">
          <span className="score-vs">VS</span>
        </div>
        <div className="score-team team-b">
          <span className="score-value">{teamBScore}</span>
          <span className="score-team-name">{game.team_b_name || 'Team B'}</span>
        </div>
      </div>

      {/* Player Count Summary */}
      <div className="player-count-summary">
        <span className="player-count-icon">👥</span>
        <span className="player-count-text">
          <strong>{players.length}</strong> player{players.length !== 1 ? 's' : ''} registered
        </span>
        {game.max_players && (
          <span className="player-count-max">/ {game.max_players} max</span>
        )}
      </div>

      {/* Phase Banner */}
      {game.phase === 'live' && (
        <div className="phase-banner live">
          <span className="pulse-dot"></span>
          Tournament is LIVE!
          {isDraftComplete && (
            <button onClick={() => navigate(`/game/${game.id}/matches`)} className="start-btn">
              Set Up Matches →
            </button>
          )}
        </div>
      )}

      {game.phase === 'expired' && (
        <div className="phase-banner expired">
          Scoring window has closed
          <button onClick={() => navigate(`/game/${game.id}/leaderboard`)} className="view-btn">
            View Results
          </button>
        </div>
      )}

      {/* Tournament Date & Countdown */}
      {game.phase === 'lobby' && (
        <div className="countdown-section glass-card">
          <div className="tournament-date">
            <span className="date-icon">📅</span>
            <span className="date-text">{formatDate(game.tournament_date)}</span>
          </div>
          
          <p className="countdown-label">Scoring unlocks in:</p>
          
          <div className="countdown-boxes">
            <div className="countdown-box">
              <span className="count-value">{countdown.days}</span>
              <span className="count-label">Days</span>
            </div>
            <div className="countdown-box">
              <span className="count-value">{countdown.hours}</span>
              <span className="count-label">Hours</span>
            </div>
            <div className="countdown-box">
              <span className="count-value">{countdown.minutes}</span>
              <span className="count-label">Mins</span>
            </div>
            <div className="countdown-box">
              <span className="count-value">{countdown.seconds}</span>
              <span className="count-label">Secs</span>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Progress */}
      <div className="checkin-progress glass-card">
        <h3>Player Check-In</h3>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: players.length > 0 ? `${(checkedInCount / players.length) * 100}%` : '0%' }}
          ></div>
        </div>
        
        <div className="checkin-stats">
          <span className="stat checked">✓ {checkedInCount} checked in</span>
          <span className="stat pending">⏳ {players.length - checkedInCount} pending</span>
        </div>

        {allCheckedIn && players.length > 0 && (
          <div className="all-checked-in">🎉 Everyone's in!</div>
        )}
      </div>

      {/* DRAFT / MATCH SETUP SECTION */}
      <div className="draft-section glass-card">
        {isDraftComplete ? (
          // Draft done - show options to edit or proceed
          <>
            <div className="draft-complete-badge">✅</div>
            <h3>Teams Are Set!</h3>
            
            {/* Show how draft was done */}
            {game.draft_mode && (
              <div className="draft-mode-indicator">
                <span className="draft-mode-label">Draft Mode:</span>
                <span className={`draft-mode-value ${game.draft_mode}`}>
                  {game.draft_mode === 'captains' && '👆 Captains Pick'}
                  {game.draft_mode === 'random' && '🎲 Random Draw'}
                  {game.draft_mode === 'balanced' && '⚖️ Balanced by Handicap'}
                  {!['captains', 'random', 'balanced'].includes(game.draft_mode) && '📋 Manual'}
                </span>
              </div>
            )}

            {game.phase === 'live' ? (
              <>
                <p className="draft-ready-text">Tournament is live! Set up your matches:</p>
                <div className="draft-action-buttons">
                  <button 
                    onClick={() => navigate(`/game/${game.id}/matches`)}
                    className="draft-start-btn"
                  >
                    ⚡ Set Up Matches
                  </button>
                  <button 
                    onClick={() => setShowRedraftModal(true)}
                    className="draft-edit-btn"
                  >
                    ✏️ Re-Draft Teams
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="draft-ready-text">
                  Teams are ready! Match setup will be available when the tournament goes live.
                </p>
                <button 
                  onClick={() => setShowRedraftModal(true)}
                  className="draft-edit-btn full-width"
                >
                  ✏️ Change Draft / Re-Draft Teams
                </button>
              </>
            )}
          </>
        ) : (
          // Draft not done yet
          <>
            <h3>🏆 Team Draft</h3>
            {players.length < minPlayersForDraft ? (
              <div className="draft-requirement">
                <p>Add at least <strong>{minPlayersForDraft} players</strong> to start the draft</p>
                <p className="player-count">{players.length} / {minPlayersForDraft} players added</p>
              </div>
            ) : (
              <>
                <p className="draft-ready-text">
                  {players.length} players ready! Choose how to assign teams:
                </p>
                <div className="draft-options">
                  <button 
                    onClick={() => setShowDraftModal(true)}
                    className="draft-start-btn"
                  >
                    ⚡ Start Draft
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Share Section */}
      <div className="share-section glass-card">
        <h3>Invite Players</h3>
        <div className="share-buttons">
          <button onClick={copyInviteMessage} className="share-btn">
            📋 Copy Invite Message
          </button>
          <button onClick={shareLink} className="share-btn secondary">
            🔗 Share Link
          </button>
        </div>
      </div>

      {/* Teams Section */}
      <div className="teams-section">
        <div className="teams-header">
          <h2>Teams</h2>
          {!editingTeams ? (
            <button onClick={() => setEditingTeams(true)} className="edit-teams-btn">
              ✏️ Edit Team Names
            </button>
          ) : (
            <div className="team-name-inputs">
              <input
                type="text"
                value={teamNames.teamA}
                onChange={(e) => setTeamNames({ ...teamNames, teamA: e.target.value })}
                placeholder="Team A Name"
              />
              <input
                type="text"
                value={teamNames.teamB}
                onChange={(e) => setTeamNames({ ...teamNames, teamB: e.target.value })}
                placeholder="Team B Name"
              />
              <button onClick={handleUpdateTeams}>Save</button>
              <button onClick={() => setEditingTeams(false)} className="secondary">Cancel</button>
            </div>
          )}
        </div>

        <div className="teams-grid">
          <div className="team-column team-a">
            <h3 className="team-title">{game.team_a_name || 'Team A'}</h3>
            <div className="player-list">
              {teamAPlayers.map(player => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  onEdit={() => openEditPlayer(player)}
                  onDelete={() => handleDeletePlayer(player.id)}
                  onSendInvite={() => handleSendInvite(player.id)}
                />
              ))}
              {teamAPlayers.length === 0 && (
                <div className="empty-team">No players assigned yet</div>
              )}
            </div>
          </div>

          <div className="team-column team-b">
            <h3 className="team-title">{game.team_b_name || 'Team B'}</h3>
            <div className="player-list">
              {teamBPlayers.map(player => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  onEdit={() => openEditPlayer(player)}
                  onDelete={() => handleDeletePlayer(player.id)}
                  onSendInvite={() => handleSendInvite(player.id)}
                />
              ))}
              {teamBPlayers.length === 0 && (
                <div className="empty-team">No players assigned yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Unassigned Players */}
        {unassignedPlayers.length > 0 && (
          <div className="unassigned-section">
            <h3>Unassigned Players</h3>
            <div className="player-list horizontal">
              {unassignedPlayers.map(player => (
                <PlayerCard 
                  key={player.id} 
                  player={player} 
                  onEdit={() => openEditPlayer(player)}
                  onDelete={() => handleDeletePlayer(player.id)}
                  onSendInvite={() => handleSendInvite(player.id)}
                />
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setShowAddPlayer(true)} className="add-player-btn">
          + Add Player
        </button>
      </div>

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal-overlay" onClick={() => setShowAddPlayer(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Player</h2>
            <form onSubmit={handleAddPlayer}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newPlayer.email}
                  onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Handicap</label>
                <input
                  type="number"
                  value={newPlayer.handicap}
                  onChange={(e) => setNewPlayer({ ...newPlayer, handicap: e.target.value })}
                  min="0"
                  max="54"
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={newPlayer.sendInvite}
                    onChange={(e) => setNewPlayer({ ...newPlayer, sendInvite: e.target.checked })}
                  />
                  Send invite email
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddPlayer(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit">Add Player</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {showEditPlayer && (
        <div className="modal-overlay" onClick={() => setShowEditPlayer(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Player</h2>
            <form onSubmit={handleUpdatePlayer}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={editPlayer.name}
                  onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editPlayer.email}
                  onChange={(e) => setEditPlayer({ ...editPlayer, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Handicap</label>
                <input
                  type="number"
                  value={editPlayer.handicap}
                  onChange={(e) => setEditPlayer({ ...editPlayer, handicap: e.target.value })}
                  min="0"
                  max="54"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditPlayer(null)} className="secondary">
                  Cancel
                </button>
                <button type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Draft Options Modal */}
      {showDraftModal && (
        <div className="modal-overlay" onClick={() => setShowDraftModal(false)}>
          <div className="modal-content draft-modal" onClick={e => e.stopPropagation()}>
            <h2>Choose Draft Mode</h2>
            <p className="draft-modal-subtitle">How would you like to assign {players.length} players to teams?</p>
            
            <div className="draft-mode-options">
              <button 
                onClick={() => handleDraftOption('captains')}
                className="draft-mode-btn captains"
              >
                <span className="draft-mode-icon">👆</span>
                <div>
                  <span className="draft-mode-title">Captains Pick</span>
                  <span className="draft-mode-desc">Captains take turns selecting players</span>
                </div>
              </button>

              <button 
                onClick={() => handleDraftOption('random')}
                className="draft-mode-btn random"
              >
                <span className="draft-mode-icon">🎲</span>
                <div>
                  <span className="draft-mode-title">Random Draw</span>
                  <span className="draft-mode-desc">Players randomly assigned to teams</span>
                </div>
              </button>

              <button 
                onClick={() => handleDraftOption('balanced')}
                className="draft-mode-btn balanced"
              >
                <span className="draft-mode-icon">⚖️</span>
                <div>
                  <span className="draft-mode-title">Balanced by Handicap</span>
                  <span className="draft-mode-desc">Fair distribution based on skill level</span>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setShowDraftModal(false)} 
              className="modal-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Tournament Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">🗑️</div>
            <h2>Delete Tournament?</h2>
            <p className="delete-modal-message">
              Are you sure you want to delete <strong>"{game.name}"</strong>?
              <br /><br />
              This will permanently remove the tournament, all players, matches, and scores. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteTournament} 
                className="danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-Draft Modal */}
      {showRedraftModal && (
        <div className="modal-overlay" onClick={() => !resettingDraft && setShowRedraftModal(false)}>
          <div className="modal-content draft-modal redraft-modal" onClick={e => e.stopPropagation()}>
            <div className="redraft-warning-icon">🔄</div>
            <h2>Re-Draft Teams</h2>
            <p className="redraft-warning-text">
              This will <strong>clear all current team assignments</strong> and let you draft again with a new method.
              {game.phase === 'live' && (
                <><br /><br /><span className="warning-highlight">⚠️ Any existing match scores will also be cleared!</span></>
              )}
            </p>
            
            <p className="draft-modal-subtitle">Choose a new draft method:</p>
            
            <div className="draft-mode-options">
              <button 
                onClick={() => handleRedraft('captains')}
                className="draft-mode-btn captains"
                disabled={resettingDraft}
              >
                <span className="draft-mode-icon">👆</span>
                <div>
                  <span className="draft-mode-title">Captains Pick</span>
                  <span className="draft-mode-desc">Captains take turns selecting players</span>
                </div>
              </button>

              <button 
                onClick={() => handleRedraft('random')}
                className="draft-mode-btn random"
                disabled={resettingDraft}
              >
                <span className="draft-mode-icon">🎲</span>
                <div>
                  <span className="draft-mode-title">Random Draw</span>
                  <span className="draft-mode-desc">Players randomly assigned to teams</span>
                </div>
              </button>

              <button 
                onClick={() => handleRedraft('balanced')}
                className="draft-mode-btn balanced"
                disabled={resettingDraft}
              >
                <span className="draft-mode-icon">⚖️</span>
                <div>
                  <span className="draft-mode-title">Balanced by Handicap</span>
                  <span className="draft-mode-desc">Fair distribution based on skill level</span>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setShowRedraftModal(false)} 
              className="modal-cancel-btn"
              disabled={resettingDraft}
            >
              {resettingDraft ? 'Resetting...' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Player Card Component
function PlayerCard({ player, onEdit, onDelete, onSendInvite }) {
  return (
    <div className={`player-card ${player.checked_in ? 'checked-in' : 'pending'}`}>
      <div className="player-status">
        {player.checked_in ? (
          <span className="status-icon checked">✓</span>
        ) : (
          <span className="status-icon pending">⏳</span>
        )}
      </div>
      <div className="player-info">
        <span className="player-name">
          {player.name}
          {player.is_captain && <span className="captain-badge">C</span>}
        </span>
        {player.handicap && <span className="player-handicap">HCP {player.handicap}</span>}
      </div>
      <div className="player-actions">
        {!player.checked_in && player.email && (
          <button onClick={onSendInvite} className="action-btn invite" title="Send Invite">
            ✉️
          </button>
        )}
        <button onClick={onEdit} className="action-btn edit" title="Edit">
          ✏️
        </button>
        <button onClick={onDelete} className="action-btn delete" title="Remove">
          🗑️
        </button>
      </div>
    </div>
  );
}

export default Lobby;