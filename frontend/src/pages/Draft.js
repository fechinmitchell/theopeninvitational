import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import './Draft.css';

function Draft() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftMode = searchParams.get('mode') || 'captains';

  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [captains, setCaptains] = useState({ teamA: null, teamB: null });
  const [currentPick, setCurrentPick] = useState(1);
  const [currentTeam, setCurrentTeam] = useState('A');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftComplete, setDraftComplete] = useState(false);
  const [draftStarted, setDraftStarted] = useState(false);

  // Captain selection phase
  const [captainSelectionPhase, setCaptainSelectionPhase] = useState(false);
  const [selectingCaptainFor, setSelectingCaptainFor] = useState('A'); // 'A' or 'B'

  // Auto draft states
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
  const [highlightedPlayer, setHighlightedPlayer] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Refs to prevent issues with stale closures and double-running effects
  const draftStartedRef = useRef(false);
  const confettiTimeoutRef = useRef(null);

  const fetchGameData = useCallback(async () => {
    try {
      const [gameRes, playersRes] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/games/${gameId}/players`)
      ]);
      
      setGame(gameRes.data.game);
      const allPlayers = playersRes.data.players;
      setPlayers(allPlayers);

      // Check for existing team assignments
      const teamAAssigned = allPlayers.filter(p => p.team === 'A');
      const teamBAssigned = allPlayers.filter(p => p.team === 'B');
      const unassigned = allPlayers.filter(p => !p.team);

      if (teamAAssigned.length > 0 || teamBAssigned.length > 0) {
        // Draft already in progress or complete
        setTeamA(teamAAssigned);
        setTeamB(teamBAssigned);
        setAvailablePlayers(unassigned);
        
        // Find captains from existing teams
        const captainA = teamAAssigned.find(p => p.is_captain);
        const captainB = teamBAssigned.find(p => p.is_captain);
        if (captainA || captainB) {
          setCaptains({ teamA: captainA || null, teamB: captainB || null });
        }
        
        if (unassigned.length === 0 && allPlayers.length > 0) {
          setDraftComplete(true);
        }
      } else {
        // Fresh draft - set up based on mode
        if (draftMode === 'captains') {
          const captainList = allPlayers.filter(p => p.is_captain);
          if (captainList.length >= 2) {
            // Captains already assigned - proceed to draft
            setCaptains({
              teamA: captainList[0],
              teamB: captainList[1]
            });
            setTeamA([captainList[0]]);
            setTeamB([captainList[1]]);
            setAvailablePlayers(allPlayers.filter(p => !p.is_captain));
            setDraftStarted(true);
          } else {
            // Need to select captains first
            setCaptainSelectionPhase(true);
            setAvailablePlayers(allPlayers);
          }
        } else {
          setAvailablePlayers(allPlayers);
        }
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load game data');
      setLoading(false);
    }
  }, [gameId, draftMode]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // Auto-start draft for random/balanced modes - with ref to prevent double execution
  useEffect(() => {
    if (!loading && !draftStartedRef.current && availablePlayers.length > 0 && (draftMode === 'random' || draftMode === 'balanced')) {
      draftStartedRef.current = true;
      setDraftStarted(true);
      handleAutoDraft(draftMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, availablePlayers.length, draftMode]);

  // Cleanup confetti timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  // Snake draft logic
  const getNextTeam = (pickNum) => {
    const round = Math.floor((pickNum - 1) / 2);
    const pickInRound = (pickNum - 1) % 2;
    
    if (round % 2 === 0) {
      return pickInRound === 0 ? 'A' : 'B';
    } else {
      return pickInRound === 0 ? 'B' : 'A';
    }
  };

  // Handle captain selection
  const handleSelectCaptain = async (player) => {
    try {
      // Update player as captain in database
      await api.put(`/games/player/${player.id}`, {
        is_captain: true
      });

      if (selectingCaptainFor === 'A') {
        setCaptains(prev => ({ ...prev, teamA: { ...player, is_captain: true } }));
        setTeamA([{ ...player, is_captain: true }]);
        setAvailablePlayers(prev => prev.filter(p => p.id !== player.id));
        setSelectingCaptainFor('B');
      } else {
        setCaptains(prev => ({ ...prev, teamB: { ...player, is_captain: true } }));
        setTeamB([{ ...player, is_captain: true }]);
        setAvailablePlayers(prev => prev.filter(p => p.id !== player.id));
        
        // Both captains selected - start the draft
        setCaptainSelectionPhase(false);
        setDraftStarted(true);
      }
    } catch (err) {
      console.error('Captain selection error:', err);
      setError('Failed to set captain: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePickPlayer = async (player) => {
    if (isAutoDrawing) return;
    
    try {
      if (currentTeam === 'A') {
        setTeamA(prev => [...prev, player]);
      } else {
        setTeamB(prev => [...prev, player]);
      }

      const newAvailable = availablePlayers.filter(p => p.id !== player.id);
      setAvailablePlayers(newAvailable);

      await api.post(`/games/${gameId}/draft-pick`, {
        pickNumber: currentPick,
        team: currentTeam,
        playerId: player.id
      });

      if (newAvailable.length === 0) {
        setDraftComplete(true);
        triggerConfetti();
        return;
      }

      const nextPick = currentPick + 1;
      const nextTeam = getNextTeam(nextPick);
      
      setCurrentPick(nextPick);
      setCurrentTeam(nextTeam);

    } catch (err) {
      console.error('Pick error:', err);
      setError('Failed to save draft pick: ' + (err.response?.data?.error || err.message));
    }
  };

  // Optimized confetti trigger with proper cleanup
  const triggerConfetti = () => {
    setShowConfetti(true);
    
    // Clear any existing timeout
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 4000);
  };

  const handleAutoDraft = async (mode) => {
    setIsAutoDrawing(true);
    setError('');

    try {
      const endpoint = mode === 'random' ? 'auto-draft-random' : 'auto-draft-balanced';
      const response = await api.post(`/games/${gameId}/${endpoint}`, {
        availablePlayers,
        teamAIds: teamA.map(p => p.id),
        teamBIds: teamB.map(p => p.id)
      });

      const { draftOrder } = response.data;

      for (let i = 0; i < draftOrder.length; i++) {
        const pickedPlayer = draftOrder[i];
        
        const baseSpeed = 150;
        const speedDecrease = Math.min(i * 8, 100);
        const speed = Math.max(30, baseSpeed - speedDecrease);
        
        const remainingPlayers = availablePlayers.filter(
          p => !draftOrder.slice(0, i).some(picked => picked.id === p.id)
        );
        
        const spins = Math.max(5, 15 - i);
        for (let j = 0; j < spins; j++) {
          if (remainingPlayers.length > 0) {
            const randomPlayer = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
            setHighlightedPlayer(randomPlayer?.id);
          }
          await new Promise(resolve => setTimeout(resolve, speed / spins));
        }

        setHighlightedPlayer(pickedPlayer.id);
        await new Promise(resolve => setTimeout(resolve, speed * 3));

        if (pickedPlayer.team === 'A') {
          setTeamA(prev => [...prev, pickedPlayer]);
        } else {
          setTeamB(prev => [...prev, pickedPlayer]);
        }

        setAvailablePlayers(prev => prev.filter(p => p.id !== pickedPlayer.id));
        setHighlightedPlayer(null);

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setDraftComplete(true);
      triggerConfetti();
      setIsAutoDrawing(false);

    } catch (err) {
      console.error('Auto draft error:', err);
      setError('Auto draft failed: ' + (err.response?.data?.error || err.message));
      setIsAutoDrawing(false);
    }
  };

  const handleFinalizeDraft = async () => {
    try {
      await api.post(`/games/${gameId}/finalize-draft`, {
        teamA: teamA.map(p => p.id),
        teamB: teamB.map(p => p.id),
        draftMode: draftMode
      });

      // Go back to lobby
      navigate(`/tournament/${game.game_code}`);
    } catch (err) {
      setError('Failed to finalize draft: ' + (err.response?.data?.error || err.message));
    }
  };

  const getModeTitle = () => {
    switch (draftMode) {
      case 'random': return '🎲 Random Draw';
      case 'balanced': return '⚖️ Balanced Draft';
      case 'captains': return '👆 Captains Pick';
      default: return 'Draft';
    }
  };

  if (loading) {
    return (
      <div className="draft-container">
        <div className="draft-content">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading draft...</p>
          </div>
        </div>
      </div>
    );
  }

  if (players.length < 2) {
    return (
      <div className="draft-container">
        <div className="draft-content glass-card">
          <h2>Not Enough Players</h2>
          <p style={{ textAlign: 'center', color: 'var(--light-text)', marginBottom: '24px' }}>
            You need at least 2 players to start a draft.
          </p>
          <button onClick={() => navigate(-1)} className="secondary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Captain Selection Phase
  if (captainSelectionPhase) {
    return (
      <div className="draft-container">
        <div className="draft-header">
          <h1 className="draft-title">{game?.name}</h1>
          <p className="draft-mode-badge">👆 Captains Pick</p>
        </div>

        <div className="draft-content">
          <div className="captain-selection-section">
            <div className="captain-selection-icon">
              {selectingCaptainFor === 'A' ? '🔵' : '🔴'}
            </div>
            <h2>Select {selectingCaptainFor === 'A' ? game?.team_a_name || 'Team A' : game?.team_b_name || 'Team B'} Captain</h2>
            <p className="captain-selection-subtitle">
              {selectingCaptainFor === 'A' 
                ? 'Choose who will lead the first team and pick first'
                : 'Now choose the captain for the second team'
              }
            </p>

            {/* Show selected captain for Team A if selecting for B */}
            {selectingCaptainFor === 'B' && captains.teamA && (
              <div className="selected-captain-preview">
                <span className="selected-label">{game?.team_a_name || 'Team A'} Captain:</span>
                <span className="selected-name">{captains.teamA.name}</span>
              </div>
            )}

            <div className="captain-selection-grid">
              {availablePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => handleSelectCaptain(player)}
                  className="captain-option-btn"
                >
                  <div className="captain-option-name">{player.name}</div>
                  {player.handicap && (
                    <div className="captain-option-handicap">HCP {player.handicap}</div>
                  )}
                </button>
              ))}
            </div>

            <button onClick={() => navigate(-1)} className="back-link-btn">
              ← Choose Different Draft Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="draft-container">
      {/* Optimized Confetti - reduced from 50 to 20 elements for better performance */}
      {showConfetti && (
        <div className="confetti-container">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="confetti" 
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: i % 3 === 0 ? 'var(--ryder-blue)' : i % 3 === 1 ? 'var(--ryder-red)' : 'var(--ryder-gold)'
              }}
            />
          ))}
        </div>
      )}

      <div className="draft-header">
        <h1 className="draft-title">{game?.name}</h1>
        <p className="draft-mode-badge">{getModeTitle()}</p>
        
        {!draftComplete && !isAutoDrawing && draftMode === 'captains' && draftStarted && (
          <div className="draft-status">
            <p className="current-pick">Pick #{currentPick}</p>
            <p className={`current-team team-${currentTeam.toLowerCase()}`}>
              {currentTeam === 'A' ? (captains.teamA?.name || 'Team A') : (captains.teamB?.name || 'Team B')}'s Turn
            </p>
          </div>
        )}

        {isAutoDrawing && (
          <div className="draft-status">
            <p className="auto-drawing-text">🎰 Drawing players...</p>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="draft-content">
        {/* Teams Display */}
        <div className="teams-display">
          {/* Team A */}
          <div className="team-column team-a-column">
            <div className="team-header team-a-header">
              <h3>{game?.team_a_name || 'Team A'}</h3>
              <p className="team-count">{teamA.length} Players</p>
            </div>
            <div className="team-players">
              {teamA.map((player, index) => (
                <div key={player.id} className="team-player team-a-player slide-in">
                  <span className="player-number">{index + 1}</span>
                  <div className="player-info-draft">
                    <div className="player-name-draft">
                      {player.name}
                      {player.is_captain && <span className="captain-badge-small">C</span>}
                    </div>
                    {player.handicap && (
                      <div className="player-handicap-draft">HCP {player.handicap}</div>
                    )}
                  </div>
                </div>
              ))}
              {teamA.length === 0 && (
                <div className="empty-team-draft">Waiting for players...</div>
              )}
            </div>
          </div>

          {/* Team B */}
          <div className="team-column team-b-column">
            <div className="team-header team-b-header">
              <h3>{game?.team_b_name || 'Team B'}</h3>
              <p className="team-count">{teamB.length} Players</p>
            </div>
            <div className="team-players">
              {teamB.map((player, index) => (
                <div key={player.id} className="team-player team-b-player slide-in">
                  <span className="player-number">{index + 1}</span>
                  <div className="player-info-draft">
                    <div className="player-name-draft">
                      {player.name}
                      {player.is_captain && <span className="captain-badge-small">C</span>}
                    </div>
                    {player.handicap && (
                      <div className="player-handicap-draft">HCP {player.handicap}</div>
                    )}
                  </div>
                </div>
              ))}
              {teamB.length === 0 && (
                <div className="empty-team-draft">Waiting for players...</div>
              )}
            </div>
          </div>
        </div>

        {/* Available Players */}
        {!draftComplete && availablePlayers.length > 0 && (
          <div className="available-players-section">
            <h3>
              {isAutoDrawing ? 'Drawing...' : `Available Players (${availablePlayers.length} remaining)`}
            </h3>
            <div className="available-players-grid">
              {availablePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => draftMode === 'captains' && handlePickPlayer(player)}
                  disabled={isAutoDrawing || draftMode !== 'captains'}
                  className={`available-player-btn ${
                    highlightedPlayer === player.id ? 'highlighted-player' : ''
                  } ${draftMode !== 'captains' ? 'no-click' : ''}`}
                >
                  <div className="available-player-name">{player.name}</div>
                  {player.handicap && (
                    <div className="available-player-handicap">HCP {player.handicap}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Draft Complete */}
        {draftComplete && (
          <div className="draft-complete-section">
            <h2>🎉 Draft Complete!</h2>
            <p>All players have been assigned to teams!</p>
            
            <div className="team-summary">
              <div className="summary-card summary-a">
                <h4>{game?.team_a_name || 'Team A'}</h4>
                <p className="team-size">{teamA.length} Players</p>
                {teamA.some(p => p.handicap) && (
                  <p className="avg-handicap">
                    Avg HCP: {(teamA.reduce((sum, p) => sum + (p.handicap || 0), 0) / teamA.filter(p => p.handicap).length).toFixed(1)}
                  </p>
                )}
              </div>
              <div className="summary-card summary-b">
                <h4>{game?.team_b_name || 'Team B'}</h4>
                <p className="team-size">{teamB.length} Players</p>
                {teamB.some(p => p.handicap) && (
                  <p className="avg-handicap">
                    Avg HCP: {(teamB.reduce((sum, p) => sum + (p.handicap || 0), 0) / teamB.filter(p => p.handicap).length).toFixed(1)}
                  </p>
                )}
              </div>
            </div>
            
            <button onClick={handleFinalizeDraft} className="finalize-btn">
              Back to Lobby →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Draft;