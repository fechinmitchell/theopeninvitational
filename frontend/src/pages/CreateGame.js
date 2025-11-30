import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './CreateGame.css';

function CreateGame() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [gameName, setGameName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [numDays, setNumDays] = useState(1);
  const [days, setDays] = useState([
    { 
      dayNumber: 1, 
      sessions: [
        { name: 'Morning Session', format: 'singles', numMatches: 4, numHoles: 18 }
      ]
    }
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  
  // Success state
  const [createdGame, setCreatedGame] = useState(null);
  const [copied, setCopied] = useState(false);

  // Format explanations
  const formatInfo = {
    singles: {
      name: 'Singles',
      description: 'One player vs one player. Each player plays their own ball throughout the round. The player who wins the most holes wins the match.'
    },
    foursomes: {
      name: 'Foursomes (Alternate Shot)',
      description: 'Two players per team share one ball, taking turns hitting shots. Players also alternate who tees off on each hole. Strategy and teamwork are crucial as partners must adapt to each other\'s shots.'
    },
    fourballs: {
      name: 'Fourballs (Best Ball)',
      description: 'Two players per team, but each plays their own ball. The best score from each team on each hole counts. This format often produces lower scores and more birdies.'
    }
  };

  // Get today's date as minimum for date picker
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Add a day
  const addDay = () => {
    setDays([
      ...days,
      { 
        dayNumber: days.length + 1, 
        sessions: [
          { name: 'Morning Session', format: 'singles', numMatches: 4, numHoles: 18 }
        ]
      }
    ]);
    setNumDays(days.length + 1);
  };

  // Remove last day
  const removeDay = () => {
    if (days.length > 1) {
      setDays(days.slice(0, -1));
      setNumDays(days.length - 1);
    }
  };

  // Add session to a day
  const addSession = (dayIndex) => {
    const newDays = [...days];
    newDays[dayIndex].sessions.push({
      name: `Session ${newDays[dayIndex].sessions.length + 1}`,
      format: 'singles',
      numMatches: 4,
      numHoles: 18
    });
    setDays(newDays);
  };

  // Remove session from a day
  const removeSession = (dayIndex, sessionIndex) => {
    const newDays = [...days];
    if (newDays[dayIndex].sessions.length > 1) {
      newDays[dayIndex].sessions.splice(sessionIndex, 1);
      setDays(newDays);
    }
  };

  // Update session name
  const updateSessionName = (dayIndex, sessionIndex, name) => {
    const newDays = [...days];
    newDays[dayIndex].sessions[sessionIndex].name = name;
    setDays(newDays);
  };

  // Update session format
  const updateSessionFormat = (dayIndex, sessionIndex, format) => {
    const newDays = [...days];
    newDays[dayIndex].sessions[sessionIndex].format = format;
    setDays(newDays);
  };

  // Update number of matches
  const updateNumMatches = (dayIndex, sessionIndex, num) => {
    const newDays = [...days];
    newDays[dayIndex].sessions[sessionIndex].numMatches = parseInt(num);
    setDays(newDays);
  };

  // Update number of holes
  const updateNumHoles = (dayIndex, sessionIndex, num) => {
    const newDays = [...days];
    newDays[dayIndex].sessions[sessionIndex].numHoles = parseInt(num);
    setDays(newDays);
  };

  // Copy game code
  const copyGameCode = () => {
    navigator.clipboard.writeText(createdGame.gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy invite message
  const copyInviteMessage = () => {
    const date = new Date(tournamentDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const message = `🏌️ You're invited to ${gameName}!\n\n📅 Date: ${date}\n🎯 Game Code: ${createdGame.gameCode}\n\nJoin here: ${window.location.origin}/tournament/${createdGame.gameCode}`;
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      setError('You must be logged in to create a game');
      return;
    }

    if (!gameName.trim()) {
      setError('Please enter a game name');
      return;
    }

    if (!tournamentDate) {
      setError('Please select a tournament date');
      return;
    }

    setLoading(true);

    try {
      // Flatten sessions into matches with day_number
      const allSessions = [];
      days.forEach(day => {
        day.sessions.forEach(session => {
          allSessions.push({
            dayNumber: day.dayNumber,
            sessionName: session.name,
            format: session.format,
            numMatches: session.numMatches,
            numHoles: session.numHoles
          });
        });
      });

      const response = await api.post('/games/create', {
        name: gameName,
        tournamentDate,
        teamAName: teamAName || 'Team A',
        teamBName: teamBName || 'Team B',
        numDays,
        days: allSessions
      });

      // Show success screen
      setCreatedGame(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create game');
    }

    setLoading(false);
  };

  // Success Screen
  if (createdGame) {
    return (
      <div className="create-game-container">
        <div className="create-game-content glass-card success-screen">
          <div className="success-icon">🎉</div>
          <h2 className="create-game-title">Tournament Created!</h2>
          <p className="success-subtitle">{gameName}</p>

          <div className="game-code-display" onClick={copyGameCode}>
            <span className="code-label">Game Code</span>
            <span className="code-value">{createdGame.gameCode}</span>
            <span className="copy-hint">{copied ? '✓ Copied!' : 'Click to copy'}</span>
          </div>

          <div className="success-actions">
            <button 
              onClick={() => navigate(`/tournament/${createdGame.gameCode}`)}
              className="primary-btn"
            >
              Go to Tournament Lobby
            </button>
            <button onClick={copyInviteMessage} className="secondary-btn">
              📋 Copy Invite Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="create-game-container">
        <div className="create-game-content glass-card">
          <h2 className="create-game-title">Create a Game</h2>
          <p style={{ textAlign: 'center', color: 'var(--light-text)' }}>
            You must be logged in to create a game.
          </p>
          <button onClick={() => navigate('/login')} style={{ marginTop: '20px' }}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-game-container">
      <div className="create-game-content glass-card">
        <h2 className="create-game-title">Create Your Tournament</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="create-game-form">
          
          {/* Game Name */}
          <div className="form-group">
            <label>Tournament Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g., Summer Cup 2024"
              required
            />
          </div>

          {/* Tournament Date */}
          <div className="form-group">
            <label>Tournament Date</label>
            <input
              type="date"
              value={tournamentDate}
              onChange={(e) => setTournamentDate(e.target.value)}
              min={getTodayString()}
              required
            />
            <span className="form-hint">Scoring unlocks 24 hours before this date and stays open for 7 days</span>
          </div>

          {/* Team Names */}
          <div className="team-names-row">
            <div className="form-group">
              <label>Team A Name</label>
              <input
                type="text"
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                placeholder="e.g., The Hackers"
              />
            </div>
            <div className="form-group">
              <label>Team B Name</label>
              <input
                type="text"
                value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)}
                placeholder="e.g., The Slicers"
              />
            </div>
          </div>

          {/* Days Configuration */}
          <div className="days-section">
            <div className="days-header">
              <label>Tournament Days ({numDays})</label>
              <div className="days-controls">
                <button type="button" onClick={removeDay} disabled={days.length === 1}>
                  - Remove Day
                </button>
                <button type="button" onClick={addDay} className="team-usa">
                  + Add Day
                </button>
              </div>
            </div>

            {days.map((day, dayIndex) => (
              <div key={dayIndex} className="day-config">
                <div className="day-header">
                  <h4>Day {day.dayNumber}</h4>
                  <button 
                    type="button" 
                    onClick={() => addSession(dayIndex)}
                    className="add-session-btn"
                  >
                    + Add Session
                  </button>
                </div>

                {day.sessions.map((session, sessionIndex) => (
                  <div key={sessionIndex} className="session-config">
                    <div className="session-header">
                      <input
                        type="text"
                        value={session.name}
                        onChange={(e) => updateSessionName(dayIndex, sessionIndex, e.target.value)}
                        className="session-name-input"
                        placeholder="Session name"
                      />
                      {day.sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSession(dayIndex, sessionIndex)}
                          className="remove-session-btn"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="session-inputs">
                      <div className="form-group">
                        <div className="label-with-info">
                          <label>Format</label>
                          <button 
                            type="button" 
                            className="info-btn"
                            onClick={() => setShowFormatInfo(true)}
                            title="Learn about formats"
                          >
                            <span className="info-icon">i</span>
                          </button>
                        </div>
                        <select 
                          value={session.format}
                          onChange={(e) => updateSessionFormat(dayIndex, sessionIndex, e.target.value)}
                        >
                          <option value="singles">Singles</option>
                          <option value="foursomes">Foursomes (Alternate Shot)</option>
                          <option value="fourballs">Fourballs (Best Ball)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Holes</label>
                        <select
                          value={session.numHoles}
                          onChange={(e) => updateNumHoles(dayIndex, sessionIndex, e.target.value)}
                        >
                          <option value={9}>9 Holes</option>
                          <option value={18}>18 Holes</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Matches</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={session.numMatches}
                          onChange={(e) => updateNumMatches(dayIndex, sessionIndex, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading} className="form-submit">
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </form>
      </div>

      {/* Format Info Modal */}
      {showFormatInfo && (
        <div className="modal-overlay" onClick={() => setShowFormatInfo(false)}>
          <div className="modal-content format-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Match Formats Explained</h3>
              <button 
                type="button"
                className="modal-close-btn"
                onClick={() => setShowFormatInfo(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="format-info-list">
              {Object.entries(formatInfo).map(([key, info]) => (
                <div key={key} className="format-info-item">
                  <h4>{info.name}</h4>
                  <p>{info.description}</p>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button 
                type="button"
                onClick={() => setShowFormatInfo(false)}
                className="modal-close"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateGame;