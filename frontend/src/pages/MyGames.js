import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './MyGames.css';

function MyGames() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyGames();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchMyGames = async () => {
    try {
      const response = await api.get('/games/my-games');
      setGames(response.data.games);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load your games');
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPhaseInfo = (game) => {
    const now = new Date();
    const unlocksAt = new Date(game.unlocks_at);
    const expiresAt = new Date(game.expires_at);
    
    if (now < unlocksAt) {
      return { phase: 'lobby', label: 'In Lobby', className: 'phase-lobby' };
    } else if (now >= unlocksAt && now < expiresAt) {
      return { phase: 'live', label: 'Live', className: 'phase-live' };
    } else {
      return { phase: 'expired', label: 'Completed', className: 'phase-expired' };
    }
  };

  const getStatusIcon = (phase) => {
    switch (phase) {
      case 'lobby': return '⏳';
      case 'live': return '🏌️';
      case 'expired': return '🏆';
      default: return '📋';
    }
  };

  const handleDeleteClick = (e, game) => {
    e.stopPropagation(); // Prevent navigating to the game
    setGameToDelete(game);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    
    setDeleting(true);
    try {
      await api.delete(`/games/${gameToDelete.id}`);
      setGames(games.filter(g => g.id !== gameToDelete.id));
      setShowDeleteModal(false);
      setGameToDelete(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete game');
    }
    setDeleting(false);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setGameToDelete(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="my-games-container">
        <div className="my-games-content glass-card">
          <h2 className="my-games-title">My Games</h2>
          <p className="my-games-empty">Please log in to view your games.</p>
          <button onClick={() => navigate('/login')}>Login</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-games-container">
        <div className="my-games-content">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading your games...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-games-container">
      <div className="my-games-content">
        <div className="my-games-header">
          <h1 className="my-games-title">My Games</h1>
          <button onClick={() => navigate('/create-game')} className="create-btn">
            + Create New Game
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {games.length === 0 ? (
          <div className="my-games-empty-state glass-card">
            <div className="empty-icon">⛳</div>
            <h2>No Games Yet</h2>
            <p>Create your first tournament and invite your friends!</p>
            <button onClick={() => navigate('/create-game')}>
              Create Your First Game
            </button>
          </div>
        ) : (
          <div className="games-grid">
            {games.map(game => {
              const phaseInfo = getPhaseInfo(game);
              
              return (
                <div 
                  key={game.id} 
                  className={`game-card ${phaseInfo.className}`}
                  onClick={() => navigate(`/tournament/${game.game_code}`)}
                >
                  {/* Top Bar - Status Badge + Delete Button */}
                  <div className="game-card-top-bar">
                    <div className="game-card-status">
                      <span className="game-status-icon">{getStatusIcon(phaseInfo.phase)}</span>
                      <span className={`game-phase-badge ${phaseInfo.className}`}>
                        {phaseInfo.label}
                      </span>
                    </div>
                    <button 
                      className="delete-game-btn"
                      onClick={(e) => handleDeleteClick(e, game)}
                      title="Delete game"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="game-card-body">
                    <h3 className="game-card-title">{game.name}</h3>
                    
                    <div className="game-card-details">
                      <div className="game-detail">
                        <span className="detail-icon">📅</span>
                        <span>{formatDate(game.tournament_date)}</span>
                      </div>
                      <div className="game-detail">
                        <span className="detail-icon">🎯</span>
                        <span className="game-code">{game.game_code}</span>
                      </div>
                      <div className="game-detail">
                        <span className="detail-icon">👥</span>
                        <span>{game.player_count || 0} players</span>
                      </div>
                    </div>

                    <div className="game-card-teams">
                      <span className="team team-a">{game.team_a_name || 'Team A'}</span>
                      <span className="vs">VS</span>
                      <span className="team team-b">{game.team_b_name || 'Team B'}</span>
                    </div>

                    <div className="game-card-action">
                      <span>View Tournament →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && gameToDelete && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon modal-icon-danger">🗑️</div>
            <h3 className="modal-title">Delete Tournament?</h3>
            <p className="modal-message">
              Are you sure you want to delete <strong>"{gameToDelete.name}"</strong>?
              <br /><br />
              This will permanently remove the tournament, all players, matches, and scores. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button 
                onClick={cancelDelete}
                className="modal-btn modal-btn-cancel"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="modal-btn modal-btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyGames;