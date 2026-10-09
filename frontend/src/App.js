// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CreateGame from './pages/CreateGame';
import GameSetup from './pages/GameSetup';
import Draft from './pages/Draft';
import MatchSetup from './pages/MatchSetup';
import LiveScore from './pages/LiveScore';
import Leaderboard from './pages/Leaderboard';
import Join from './pages/Join';
import Lobby from './pages/Lobby';
import CheckIn from './pages/CheckIn';
import MyGames from './pages/MyGames';
import './App.css';

// Redirects logged out users to /login, then back to where they were going
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="navigation">
      <div>
        <Link to="/" className="nav-brand">
          The Open Invitational
        </Link>
      </div>
      <div className="nav-links">
        <Link to="/join">Join Game</Link>
        {isAuthenticated ? (
          <>
            <Link to="/my-games">My Games</Link>
            <Link to="/create-game">Create Game</Link>
            {user?.name && <span className="nav-user-info">Hello, {user.name}</span>}
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Navigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/create-game" element={<ProtectedRoute><CreateGame /></ProtectedRoute>} />
            <Route path="/my-games" element={<ProtectedRoute><MyGames /></ProtectedRoute>} />
            <Route path="/join" element={<Join />} />
            <Route path="/tournament/:code" element={<Lobby />} />
            <Route path="/checkin/:token" element={<CheckIn />} />
            <Route path="/game/:gameId/setup" element={<GameSetup />} />
            <Route path="/game/:gameId/draft" element={<Draft />} />
            <Route path="/game/:gameId/matches" element={<MatchSetup />} />
            <Route path="/game/:gameId/leaderboard" element={<Leaderboard />} />
            <Route path="/match/:matchId/score" element={<LiveScore />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;