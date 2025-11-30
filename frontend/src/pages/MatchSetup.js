import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './MatchSetup.css';

function MatchSetup() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasMatches, setHasMatches] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create match form
  const [matchFormat, setMatchFormat] = useState('singles');
  const [selectedTeamAPlayer1, setSelectedTeamAPlayer1] = useState('');
  const [selectedTeamAPlayer2, setSelectedTeamAPlayer2] = useState('');
  const [selectedTeamBPlayer1, setSelectedTeamBPlayer1] = useState('');
  const [selectedTeamBPlayer2, setSelectedTeamBPlayer2] = useState('');

  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const fetchGameData = async () => {
    try {
      const [gameRes, playersRes, matchesRes] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/games/${gameId}/players`),
        api.get(`/games/${gameId}/matches`)
      ]);

      setGame(gameRes.data.game);
      const allPlayers = playersRes.data.players;
      setPlayers(allPlayers);

      const teamAPlayers = allPlayers.filter(p => p.team === 'A');
      const teamBPlayers = allPlayers.filter(p => p.team === 'B');
      setTeamA(teamAPlayers);
      setTeamB(teamBPlayers);

      if (matchesRes.data.matches.length > 0) {
        setMatches(matchesRes.data.matches);
        setHasMatches(true);
      } else {
        setMatches([]);
        setHasMatches(false);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load game data');
      setLoading(false);
    }
  };

  const handleAutoCreateMatches = async () => {
    setCreating(true);
    setError('');
    
    try {
      const matchesData = [];
      const numMatches = Math.min(teamA.length, teamB.length);

      if (numMatches === 0) {
        setError('Need at least one player on each team to create matches');
        setCreating(false);
        return;
      }

      for (let i = 0; i < numMatches; i++) {
        matchesData.push({
          dayNumber: 1,
          matchNumber: i + 1,
          format: 'singles',
          teamAPlayer1: teamA[i].id,
          teamAPlayer2: null,
          teamBPlayer1: teamB[i].id,
          teamBPlayer2: null
        });
      }

      await api.post(`/games/${gameId}/create-matches`, {
        matches: matchesData
      });

      setSuccess(`${numMatches} singles matches created successfully!`);
      await fetchGameData();

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create matches');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSingleMatch = async () => {
    if (!selectedTeamAPlayer1 || !selectedTeamBPlayer1) {
      setError('Please select at least one player from each team');
      return;
    }

    if (matchFormat !== 'singles' && (!selectedTeamAPlayer2 || !selectedTeamBPlayer2)) {
      setError('Please select a partner for each team for doubles/fourball matches');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const nextMatchNumber = matches.length + 1;
      
      await api.post(`/games/${gameId}/create-matches`, {
        matches: [{
          dayNumber: 1,
          matchNumber: nextMatchNumber,
          format: matchFormat,
          teamAPlayer1: parseInt(selectedTeamAPlayer1),
          teamAPlayer2: matchFormat !== 'singles' ? parseInt(selectedTeamAPlayer2) : null,
          teamBPlayer1: parseInt(selectedTeamBPlayer1),
          teamBPlayer2: matchFormat !== 'singles' ? parseInt(selectedTeamBPlayer2) : null
        }]
      });

      setSuccess('Match created successfully!');
      setShowCreateModal(false);
      resetCreateForm();
      await fetchGameData();

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create match');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!matchToDelete) return;
    
    setDeleting(true);
    setError('');

    try {
      await api.delete(`/games/${gameId}/match/${matchToDelete.id}`);
      setSuccess('Match deleted successfully');
      setShowDeleteModal(false);
      setMatchToDelete(null);
      await fetchGameData();

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete match');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllMatches = async () => {
    setDeleting(true);
    setError('');

    try {
      await api.delete(`/games/${gameId}/matches`);
      setSuccess('All matches deleted successfully');
      setShowDeleteAllModal(false);
      await fetchGameData();

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete matches');
    } finally {
      setDeleting(false);
    }
  };

  const resetCreateForm = () => {
    setMatchFormat('singles');
    setSelectedTeamAPlayer1('');
    setSelectedTeamAPlayer2('');
    setSelectedTeamBPlayer1('');
    setSelectedTeamBPlayer2('');
  };

  const getMatchStatusClass = (match) => {
    if (match.status === 'completed') return 'complete';
    if (match.status === 'in_progress') return 'in-progress';
    return 'not-started';
  };

  const getMatchStatusText = (match) => {
    if (match.status === 'completed') {
      if (match.winner === 'halved') return '⚪ Halved';
      const diff = Math.abs(match.team_a_score - match.team_b_score);
      return `✓ ${match.winner === 'A' ? game?.team_a_name || 'Team A' : game?.team_b_name || 'Team B'} won ${diff}UP`;
    }
    if (match.status === 'in_progress') {
      const diff = match.team_a_score - match.team_b_score;
      if (diff === 0) return '⚡ All Square';
      return `⚡ ${diff > 0 ? game?.team_a_name || 'A' : game?.team_b_name || 'B'} ${Math.abs(diff)}UP`;
    }
    return '⏳ Not Started';
  };

  if (loading) {
    return (
      <div className="match-setup-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading matches...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="match-setup-container">
        <div className="error-state glass-card">
          <div className="error-icon">⚠️</div>
          <h2>Game Not Found</h2>
          <p>This tournament doesn't exist or you don't have access.</p>
          <button onClick={() => navigate('/my-games')} className="primary-btn">
            Go to My Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="match-setup-container">
      {/* Header */}
      <div className="match-setup-header">
        <button onClick={() => navigate(`/tournament/${game.game_code}`)} className="back-btn">
          ← Back to Lobby
        </button>
        <div className="header-center">
          <h1 className="match-setup-title">{game.name}</h1>
          <p className="match-setup-subtitle">Match Setup</p>
        </div>
        {hasMatches && (
          <button 
            onClick={() => navigate(`/game/${gameId}/leaderboard`)}
            className="leaderboard-btn"
          >
            📊 Leaderboard
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="message-toast error-toast">
          <span className="toast-icon">❌</span>
          <span className="toast-text">{error}</span>
          <button onClick={() => setError('')} className="toast-close">×</button>
        </div>
      )}
      {success && (
        <div className="message-toast success-toast">
          <span className="toast-icon">✅</span>
          <span className="toast-text">{success}</span>
          <button onClick={() => setSuccess('')} className="toast-close">×</button>
        </div>
      )}

      {/* Team Score Summary */}
      <div className="team-score-summary glass-card">
        <div className="team-score-item team-a-score-item">
          <span className="team-label">{game.team_a_name || 'Team A'}</span>
          <span className="team-player-count">{teamA.length} players</span>
        </div>
        <div className="vs-badge">VS</div>
        <div className="team-score-item team-b-score-item">
          <span className="team-label">{game.team_b_name || 'Team B'}</span>
          <span className="team-player-count">{teamB.length} players</span>
        </div>
      </div>

      {/* No Matches State */}
      {!hasMatches && (
        <div className="no-matches-section glass-card">
          <div className="no-matches-icon">🎯</div>
          <h2>No Matches Yet</h2>
          <p>Create matches to start scoring your tournament.</p>
          
          <div className="create-options">
            <button 
              onClick={handleAutoCreateMatches} 
              className="auto-create-btn"
              disabled={creating || teamA.length === 0 || teamB.length === 0}
            >
              {creating ? 'Creating...' : '⚡ Auto-Create Singles Matches'}
            </button>
            <span className="or-divider">or</span>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="manual-create-btn"
              disabled={teamA.length === 0 || teamB.length === 0}
            >
              ➕ Create Match Manually
            </button>
          </div>

          {(teamA.length === 0 || teamB.length === 0) && (
            <p className="warning-text">
              ⚠️ You need players on both teams before creating matches.
              <button onClick={() => navigate(`/tournament/${game.game_code}`)} className="link-btn">
                Go back to add players
              </button>
            </p>
          )}
        </div>
      )}

      {/* Matches List */}
      {hasMatches && (
        <div className="matches-section">
          <div className="matches-header">
            <h2>Matches ({matches.length})</h2>
            <div className="matches-actions">
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="add-match-btn"
              >
                ➕ Add Match
              </button>
              <button 
                onClick={() => setShowDeleteAllModal(true)} 
                className="delete-all-btn"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>
          
          <div className="matches-grid">
            {matches.map(match => {
              const teamAName = match.team_a_player2_name
                ? `${match.team_a_player1_name} & ${match.team_a_player2_name}`
                : match.team_a_player1_name;

              const teamBName = match.team_b_player2_name
                ? `${match.team_b_player1_name} & ${match.team_b_player2_name}`
                : match.team_b_player1_name;

              return (
                <div key={match.id} className={`match-card ${getMatchStatusClass(match)}`}>
                  <div className="match-card-header">
                    <span className="match-number">Match {match.match_number}</span>
                    <span className="match-format-badge">{match.format}</span>
                    <button 
                      onClick={() => {
                        setMatchToDelete(match);
                        setShowDeleteModal(true);
                      }}
                      className="match-delete-btn"
                      title="Delete match"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="match-players">
                    <div className="match-team match-team-a">
                      <span className="team-indicator">🔵</span>
                      <span className="player-names">{teamAName}</span>
                    </div>
                    <div className="match-vs">VS</div>
                    <div className="match-team match-team-b">
                      <span className="team-indicator">🔴</span>
                      <span className="player-names">{teamBName}</span>
                    </div>
                  </div>

                  <div className="match-score-display">
                    <span className="score team-a-score">{match.team_a_score || 0}</span>
                    <span className="score-divider">-</span>
                    <span className="score team-b-score">{match.team_b_score || 0}</span>
                  </div>

                  <div className={`match-status-badge ${getMatchStatusClass(match)}`}>
                    {getMatchStatusText(match)}
                  </div>

                  <button
                    onClick={() => navigate(`/match/${match.id}/score`)}
                    className="score-btn"
                  >
                    {match.status === 'completed' ? '👁️ View Scorecard' : 
                     match.status === 'in_progress' ? '⚡ Continue Scoring' : 
                     '🏌️ Start Match'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Match Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create New Match</h2>
            
            <div className="form-group">
              <label>Match Format</label>
              <select 
                value={matchFormat} 
                onChange={(e) => setMatchFormat(e.target.value)}
                className="form-select"
              >
                <option value="singles">Singles (1v1)</option>
                <option value="fourball">Fourball (2v2 Best Ball)</option>
                <option value="foursomes">Foursomes (2v2 Alternate Shot)</option>
              </select>
            </div>

            <div className="team-selection">
              <div className="team-select-column team-a-select">
                <h3>🔵 {game.team_a_name || 'Team A'}</h3>
                <div className="form-group">
                  <label>Player 1</label>
                  <select 
                    value={selectedTeamAPlayer1}
                    onChange={(e) => setSelectedTeamAPlayer1(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select player...</option>
                    {teamA.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {matchFormat !== 'singles' && (
                  <div className="form-group">
                    <label>Player 2</label>
                    <select 
                      value={selectedTeamAPlayer2}
                      onChange={(e) => setSelectedTeamAPlayer2(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select player...</option>
                      {teamA.filter(p => p.id.toString() !== selectedTeamAPlayer1).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="vs-divider-vertical">VS</div>

              <div className="team-select-column team-b-select">
                <h3>🔴 {game.team_b_name || 'Team B'}</h3>
                <div className="form-group">
                  <label>Player 1</label>
                  <select 
                    value={selectedTeamBPlayer1}
                    onChange={(e) => setSelectedTeamBPlayer1(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select player...</option>
                    {teamB.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                {matchFormat !== 'singles' && (
                  <div className="form-group">
                    <label>Player 2</label>
                    <select 
                      value={selectedTeamBPlayer2}
                      onChange={(e) => setSelectedTeamBPlayer2(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select player...</option>
                      {teamB.filter(p => p.id.toString() !== selectedTeamBPlayer1).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }} 
                className="secondary-btn"
                disabled={creating}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateSingleMatch} 
                className="primary-btn"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Match Modal */}
      {showDeleteModal && matchToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-icon">🗑️</div>
            <h2>Delete Match {matchToDelete.match_number}?</h2>
            <p className="delete-warning">
              This will permanently delete this match and all its scores.
              {matchToDelete.status !== 'not_started' && (
                <strong> This match has already been started!</strong>
              )}
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setMatchToDelete(null);
                }} 
                className="secondary-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteMatch} 
                className="danger-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Matches Modal */}
      {showDeleteAllModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllModal(false)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-icon">⚠️</div>
            <h2>Delete ALL Matches?</h2>
            <p className="delete-warning">
              This will permanently delete <strong>all {matches.length} matches</strong> and their scores.
              This action cannot be undone!
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteAllModal(false)} 
                className="secondary-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAllMatches} 
                className="danger-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchSetup;