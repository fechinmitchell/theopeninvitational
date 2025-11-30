import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CheckIn.css';

function CheckIn() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gameName, setGameName] = useState('');

  const checkIn = useCallback(async () => {
    try {
      const response = await api.post(`/games/checkin/${token}`);
      
      setStatus('success');
      setMessage('You\'re checked in!');
      setGameCode(response.data.gameCode);
      setPlayerName(response.data.player.name);
      setGameName(response.data.gameName);
      
      setTimeout(() => {
        navigate(`/tournament/${response.data.gameCode}`);
      }, 3000);
      
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Invalid or expired check-in link');
    }
  }, [token, navigate]);

  useEffect(() => {
    checkIn();
  }, [checkIn]);

  return (
    <div className="checkin-container">
      <div className="checkin-content glass-card">
        {status === 'loading' && (
          <div className="checkin-loading">
            <div className="loading-spinner"></div>
            <h2>Checking you in...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="checkin-success">
            <div className="success-icon">✓</div>
            <h2>You're In, {playerName}!</h2>
            <p className="success-message">
              You've been checked in to <strong>{gameName}</strong>
            </p>
            <div className="redirect-notice">
              <p>Redirecting to the lobby...</p>
              <button 
                onClick={() => navigate(`/tournament/${gameCode}`)}
                className="go-to-lobby-btn"
              >
                Go to Lobby Now
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="checkin-error">
            <div className="error-icon">✕</div>
            <h2>Check-In Failed</h2>
            <p className="error-message">{message}</p>
            <div className="error-actions">
              <button onClick={() => navigate('/join')} className="secondary">
                Enter Game Code
              </button>
              <button onClick={() => navigate('/')}>
                Go Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckIn;