import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">The Open Invitational</h1>
        <p className="home-subtitle">Create and manage your own Ryder Cup style golf tournaments with friends</p>
        
        {isAuthenticated ? (
          <div className="home-welcome">
            <h2>Welcome back, {user.name}!</h2>
            <div className="home-buttons">
              <button onClick={() => navigate('/create-game')}>
                Create New Game
              </button>
              <button className="team-usa" onClick={() => navigate('/my-games')}>
                My Games
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="home-buttons">
              <button onClick={() => navigate('/login')}>
                Login
              </button>
              <button className="team-usa" onClick={() => navigate('/register')}>
                Register
              </button>
            </div>
            <div className="home-guest-section">
              <button className="secondary" onClick={() => navigate('/guest')}>
                Continue as Guest
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Home;