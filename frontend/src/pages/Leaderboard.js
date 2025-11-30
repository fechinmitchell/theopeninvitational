import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Leaderboard.css';

function Leaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchLeaderboardData();
    // Auto-refresh every 5 seconds for live updates
    const interval = setInterval(() => {
      fetchLeaderboardData(true); // Silent refresh
    }, 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  const fetchLeaderboardData = async (silent = false) => {
    try {
      const [gameRes, leaderboardRes, matchesRes] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/games/${gameId}/leaderboard`),
        api.get(`/games/${gameId}/matches`)
      ]);

      setGame(gameRes.data.game);
      setLeaderboard(leaderboardRes.data);
      setMatches(matchesRes.data.matches);
      setLastUpdate(new Date());
      
      if (!silent) {
        setLoading(false);
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to load leaderboard');
        setLoading(false);
      }
    }
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchLeaderboardData();
  };

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="loading">Loading leaderboard...</div>
      </div>
    );
  }

  if (!game || !leaderboard) {
    return (
      <div className="leaderboard-container">
        <div className="error-display">Data not found</div>
      </div>
    );
  }

  const teamALead = leaderboard.teamAPoints > leaderboard.teamBPoints;
  const teamBLead = leaderboard.teamBPoints > leaderboard.teamAPoints;
  const isTied = leaderboard.teamAPoints === leaderboard.teamBPoints;

  return (
    <div className="leaderboard-container">
      {/* Header */}
      <div className="leaderboard-header">
        <button onClick={() => navigate(`/game/${gameId}/matches`)} className="back-button">
          ← Back
        </button>
        <h1 className="leaderboard-title">{game.name}</h1>
        <button onClick={handleManualRefresh} className="refresh-button" title="Refresh now">
          🔄
        </button>
      </div>

      {/* Live Update Indicator */}
      <div className="live-update-indicator">
        <span className="live-dot"></span>
        <span className="live-text">Live • Updated {new Date(lastUpdate).toLocaleTimeString()}</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Main Scoreboard */}
      <div className="main-scoreboard">
        <div className={`team-score-card team-a-score ${teamALead ? 'leading' : ''}`}>
          <div className="team-score-label">{leaderboard.teamAName || game.team_a_name || 'Team A'}</div>
          <div className="team-score-points">{leaderboard.teamAPoints}</div>
          {teamALead && <div className="leading-badge">🏆 LEADING</div>}
        </div>

        <div className="scoreboard-divider">
          <div className="divider-line"></div>
          <div className="progress-text">
            {leaderboard.completedMatches} / {leaderboard.totalMatches} Matches Complete
          </div>
          <div className="divider-line"></div>
        </div>

        <div className={`team-score-card team-b-score ${teamBLead ? 'leading' : ''}`}>
          <div className="team-score-label">{leaderboard.teamBName || game.team_b_name || 'Team B'}</div>
          <div className="team-score-points">{leaderboard.teamBPoints}</div>
          {teamBLead && <div className="leading-badge">🏆 LEADING</div>}
        </div>
      </div>

      {isTied && (
        <div className="tied-banner">
          ⚖️ ALL SQUARE - Teams are tied!
        </div>
      )}

      {/* Match Results */}
      <div className="matches-results-section">
        <h2>Match Results</h2>

        <div className="matches-results-grid">
          {matches.map(match => {
            const teamAName = match.team_a_player2_name
              ? `${match.team_a_player1_name} & ${match.team_a_player2_name}`
              : match.team_a_player1_name;

            const teamBName = match.team_b_player2_name
              ? `${match.team_b_player1_name} & ${match.team_b_player2_name}`
              : match.team_b_player1_name;

            const isComplete = match.status === 'completed';
            const isInProgress = match.status === 'in_progress';

            let matchResult = '';
            if (isComplete) {
              if (match.winner === 'halved') {
                matchResult = 'HALVED';
              } else {
                const diff = Math.abs(match.team_a_score - match.team_b_score);
                const holesPlayed = (match.team_a_score + match.team_b_score);
                const holesRemaining = 18 - holesPlayed;
                if (diff > holesRemaining && holesRemaining >= 0) {
                  matchResult = `${diff}&${holesRemaining + 1}`;
                } else {
                  matchResult = `${diff}UP`;
                }
              }
            } else if (isInProgress) {
              const diff = match.team_a_score - match.team_b_score;
              if (diff === 0) {
                matchResult = 'AS';
              } else if (diff > 0) {
                matchResult = `A ${diff}UP`;
              } else {
                matchResult = `B ${Math.abs(diff)}UP`;
              }
            }

            return (
              <div
                key={match.id}
                className={`match-result-card ${isComplete ? 'complete' : ''} ${isInProgress ? 'in-progress' : ''}`}
                onClick={() => navigate(`/match/${match.id}/score`)}
              >
                <div className="match-result-header">
                  <span className="match-result-number">Match {match.match_number}</span>
                  <span className="match-result-format">{match.format}</span>
                </div>

                <div className="match-result-players">
                  <div className={`player-vs team-a-player ${match.winner === 'A' ? 'winner' : ''}`}>
                    <div className="player-name">{teamAName}</div>
                    {isComplete && match.winner === 'A' && <div className="winner-icon">🏆</div>}
                  </div>

                  <div className="vs-text">VS</div>

                  <div className={`player-vs team-b-player ${match.winner === 'B' ? 'winner' : ''}`}>
                    <div className="player-name">{teamBName}</div>
                    {isComplete && match.winner === 'B' && <div className="winner-icon">🏆</div>}
                  </div>
                </div>

                <div className="match-result-status">
                  {isComplete && (
                    <span className="result-badge complete-result">
                      {match.winner === 'halved' ? '⚪ HALVED' : `✓ ${matchResult}`}
                    </span>
                  )}
                  {isInProgress && (
                    <span className="result-badge progress-result">
                      ⚡ {matchResult}
                    </span>
                  )}
                  {!isComplete && !isInProgress && (
                    <span className="result-badge pending-result">
                      ⏳ Not Started
                    </span>
                  )}
                </div>

                <div className="match-result-score">
                  <span className="score-display">{match.team_a_score || 0}</span>
                  <span className="score-divider">-</span>
                  <span className="score-display">{match.team_b_score || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tournament Complete */}
      {leaderboard.completedMatches === leaderboard.totalMatches && leaderboard.totalMatches > 0 && (
        <div className="tournament-complete-section">
          <h2>🏆 TOURNAMENT COMPLETE! 🏆</h2>
          {!isTied && (
            <p className="winner-announcement">
              {teamALead ? (leaderboard.teamAName || game.team_a_name || 'Team A') : (leaderboard.teamBName || game.team_b_name || 'Team B')} WINS {leaderboard.teamAPoints} - {leaderboard.teamBPoints}!
            </p>
          )}
          {isTied && (
            <p className="winner-announcement">
              TOURNAMENT TIED {leaderboard.teamAPoints} - {leaderboard.teamBPoints}!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Leaderboard;