import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './LiveScore.css';

function LiveScore() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [holes, setHoles] = useState([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [holeToDelete, setHoleToDelete] = useState(null);

  useEffect(() => {
    fetchMatchData();
  }, [matchId]);

  const fetchMatchData = async () => {
    try {
      const response = await api.get(`/games/match/${matchId}`);
      const matchData = response.data.match;
      
      setMatch(matchData);
      setHoles(matchData.holes || []);
      
      const lastHole = matchData.holes.length > 0 ? matchData.holes[matchData.holes.length - 1].hole_number : 0;
      setCurrentHole(Math.min(lastHole + 1, 18));
      
      calculateMatchStatus(matchData);
      setLoading(false);
    } catch (err) {
      setError('Failed to load match data');
      setLoading(false);
    }
  };

  const calculateMatchStatus = (matchData) => {
    const matchHoles = matchData.holes || [];
    let teamAUp = 0;
    let teamBUp = 0;

    matchHoles.forEach(hole => {
      if (hole.winner === 'A') teamAUp++;
      else if (hole.winner === 'B') teamBUp++;
    });

    const diff = teamAUp - teamBUp;
    const holesRemaining = 18 - matchHoles.length;

    if (matchData.status === 'completed') {
      if (matchData.winner === 'halved') {
        setMatchStatus('ALL SQUARE - Match Halved');
      } else if (matchData.winner === 'A') {
        setMatchStatus(`TEAM A WINS ${diff > 1 ? `${diff}&${holesRemaining + 1}` : '1UP'}`);
      } else {
        setMatchStatus(`TEAM B WINS ${Math.abs(diff) > 1 ? `${Math.abs(diff)}&${holesRemaining + 1}` : '1UP'}`);
      }
    } else if (diff === 0) {
      setMatchStatus('ALL SQUARE');
    } else if (diff > 0) {
      setMatchStatus(`TEAM A ${diff}UP`);
    } else {
      setMatchStatus(`TEAM B ${Math.abs(diff)}UP`);
    }
  };

  const handleRecordHole = async (winner) => {
    try {
      await api.post(`/games/match/${matchId}/record-hole`, {
        holeNumber: currentHole,
        winner
      });

      await fetchMatchData();

      const response = await api.get(`/games/match/${matchId}`);
      if (response.data.match.status === 'completed') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        if (currentHole < 18) {
          setCurrentHole(currentHole + 1);
        }
      }

    } catch (err) {
      setError('Failed to record hole result');
    }
  };

  const handleEditHole = (holeNum) => {
    setCurrentHole(holeNum);
  };

  const handleUndoLastHole = () => {
    if (holes.length === 0) return;
    setShowUndoModal(true);
  };

  const confirmUndoLastHole = async () => {
    const lastHole = holes[holes.length - 1];
    
    try {
      await api.post(`/games/match/${matchId}/delete-from-hole`, {
        holeNumber: lastHole.hole_number
      });

      await fetchMatchData();
      setError('');
      setShowUndoModal(false);

    } catch (err) {
      setError('Failed to undo hole result');
      setShowUndoModal(false);
    }
  };

  const handleDeleteHole = (holeNum) => {
    setHoleToDelete(holeNum);
    setShowDeleteModal(true);
  };

  const confirmDeleteHole = async () => {
    try {
      await api.post(`/games/match/${matchId}/delete-from-hole`, {
        holeNumber: holeToDelete
      });

      await fetchMatchData();
      setCurrentHole(holeToDelete);
      setError('');
      setShowDeleteModal(false);
      setHoleToDelete(null);

    } catch (err) {
      setError('Failed to delete hole result');
      setShowDeleteModal(false);
      setHoleToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="live-score-container">
        <div className="loading">Loading match...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="live-score-container">
        <div className="error-display">Match not found</div>
      </div>
    );
  }

  const teamAPlayers = match.team_a_player2_name 
    ? `${match.team_a_player1_name} & ${match.team_a_player2_name}`
    : match.team_a_player1_name;

  const teamBPlayers = match.team_b_player2_name
    ? `${match.team_b_player1_name} & ${match.team_b_player2_name}`
    : match.team_b_player1_name;

  const currentHoleData = holes.find(h => h.hole_number === currentHole);
  const isMatchComplete = match.status === 'completed';
  const hasHoles = holes.length > 0;

  return (
    <div className="live-score-container">
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="confetti" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              backgroundColor: i % 3 === 0 ? 'var(--ryder-blue)' : i % 3 === 1 ? 'var(--ryder-red)' : 'var(--ryder-gold)'
            }}></div>
          ))}
        </div>
      )}

      {/* Undo Modal */}
      {showUndoModal && (
        <div className="modal-overlay" onClick={() => setShowUndoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">↩️</div>
            <h3 className="modal-title">Undo Last Hole?</h3>
            <p className="modal-message">
              Are you sure you want to undo the result for Hole {holes[holes.length - 1].hole_number}?
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowUndoModal(false)}
                className="modal-btn modal-btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmUndoLastHole}
                className="modal-btn modal-btn-confirm"
              >
                Yes, Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon modal-icon-danger">🗑️</div>
            <h3 className="modal-title">Delete from Hole {holeToDelete}?</h3>
            <p className="modal-message">
              This will delete Hole {holeToDelete} and all holes after it. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="modal-btn modal-btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteHole}
                className="modal-btn modal-btn-danger"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-First Header */}
      <div className="match-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <div className="match-header-info">
          <h1 className="match-title">Match {match.match_number}</h1>
          <span className="match-format">{match.format}</span>
        </div>
      </div>

      {/* Match Status Banner */}
      <div className={`match-status-banner ${isMatchComplete ? 'complete' : ''}`}>
        <div className="status-text">{matchStatus}</div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Teams Display - Mobile Optimized */}
      <div className="teams-vs">
        <div className="team-card team-a-card">
          <div className="team-label">TEAM A</div>
          <div className="team-players">{teamAPlayers}</div>
          <div className="team-score">{match.team_a_score || 0}</div>
        </div>

        <div className="vs-divider">VS</div>

        <div className="team-card team-b-card">
          <div className="team-label">TEAM B</div>
          <div className="team-players">{teamBPlayers}</div>
          <div className="team-score">{match.team_b_score || 0}</div>
        </div>
      </div>

      {/* Current Hole Scoring */}
      {!isMatchComplete && (
        <div className="current-hole-section">
          <h2 className="current-hole-title">Hole {currentHole}</h2>
          
          {currentHoleData && (
            <div className="hole-edit-notice">
              <span>✏️ Editing existing result</span>
              <button 
                onClick={() => handleDeleteHole(currentHole)}
                className="delete-hole-btn"
              >
                🗑️ Delete from here
              </button>
            </div>
          )}
          
          <div className="hole-buttons">
            <button
              onClick={() => handleRecordHole('A')}
              className="hole-btn team-a-btn"
            >
              <span className="hole-btn-text">Team A Won</span>
            </button>
            
            <button
              onClick={() => handleRecordHole('halved')}
              className="hole-btn halved-btn"
            >
              <span className="hole-btn-text">Halved</span>
            </button>
            
            <button
              onClick={() => handleRecordHole('B')}
              className="hole-btn team-b-btn"
            >
              <span className="hole-btn-text">Team B Won</span>
            </button>
          </div>
        </div>
      )}

      {/* Match Complete */}
      {isMatchComplete && (
        <div className="match-complete-section">
          <h2>🏆 Match Complete!</h2>
          <button 
            onClick={() => navigate(`/game/${match.game_id}/leaderboard`)}
            className="view-leaderboard-btn"
          >
            📊 View Tournament Leaderboard
          </button>
        </div>
      )}

      {/* Scorecard - Mobile First Design */}
      <div className="scorecard-section">
        <div className="scorecard-header">
          <h3>Scorecard</h3>
          <div className="scorecard-actions">
            {hasHoles && (
              <button onClick={handleUndoLastHole} className="undo-compact-btn">
                <span className="btn-icon">↩️</span>
                <span className="btn-text">Undo {holes[holes.length - 1].hole_number}</span>
              </button>
            )}
            {!isMatchComplete && (
              <button 
                onClick={() => navigate(`/game/${match.game_id}/leaderboard`)}
                className="view-live-leaderboard-btn"
              >
                <span className="btn-icon">📊</span>
                <span className="btn-text">Live Board</span>
              </button>
            )}
          </div>
        </div>

        <div className="scorecard-grid">
          {[...Array(18)].map((_, i) => {
            const holeNum = i + 1;
            const hole = holes.find(h => h.hole_number === holeNum);
            
            return (
              <div
                key={holeNum}
                className={`scorecard-hole ${hole ? 'played' : ''} ${currentHole === holeNum && !isMatchComplete ? 'current' : ''}`}
                onClick={() => !isMatchComplete && handleEditHole(holeNum)}
              >
                <div className="hole-number">{holeNum}</div>
                <div className="hole-result">
                  {hole ? (
                    hole.winner === 'A' ? '🔵' :
                    hole.winner === 'B' ? '🔴' : '⚪'
                  ) : '—'}
                </div>
                {hole && !isMatchComplete && (
                  <button 
                    className="mini-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteHole(holeNum);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="scorecard-legend">
          <span>🔵 Team A</span>
          <span>🔴 Team B</span>
          <span>⚪ Halved</span>
        </div>
      </div>
    </div>
  );
}

export default LiveScore;