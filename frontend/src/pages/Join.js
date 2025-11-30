import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Join.css';

function Join() {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double-submission
    if (loading) return;
    
    setError('');
    setLoading(true);

    try {
      const response = await api.get(`/games/code/${gameCode.toUpperCase()}`);
      
      if (response.data.game) {
        navigate(`/tournament/${gameCode.toUpperCase()}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Game not found. Check the code and try again.');
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setGameCode(value.slice(0, 6));
  };

  return (
    <div className="join-container">
      <div className="join-content glass-card">
        <div className="join-icon">⛳</div>
        <h2 className="join-title">Join a Tournament</h2>
        <p className="join-subtitle">Enter the 6-character game code shared with you</p>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="join-form">
          <div className="code-input-container">
            <input
              type="text"
              value={gameCode}
              onChange={handleCodeChange}
              placeholder="XXXXXX"
              className="code-input"
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading || gameCode.length !== 6} className="join-btn">
            {loading ? 'Finding game...' : 'Join Tournament'}
          </button>
        </form>

        <div className="join-footer">
          <p>Don't have a code?</p>
          <button onClick={() => navigate('/create-game')} className="secondary">
            Create a Tournament
          </button>
        </div>
      </div>
    </div>
  );
}

export default Join;