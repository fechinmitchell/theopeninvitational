-- Users table (registered accounts)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table (tournaments)
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_by INT REFERENCES users(id),
  num_days INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'setup',
  draft_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game days configuration
CREATE TABLE game_days (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  format VARCHAR(50) NOT NULL,
  num_matches INT NOT NULL,
  UNIQUE(game_id, day_number)
);

-- Players in a game (mix of registered users and guests)
CREATE TABLE game_players (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  handicap DECIMAL(4,1),
  is_captain BOOLEAN DEFAULT false,
  team VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draft history
CREATE TABLE draft_picks (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  pick_number INT NOT NULL,
  team VARCHAR(10) NOT NULL,
  player_id INT REFERENCES game_players(id) ON DELETE CASCADE,
  picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, pick_number)
);

-- Matches (pairings for each day)
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  game_id INT REFERENCES games(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  match_number INT NOT NULL,
  format VARCHAR(50) NOT NULL,
  team_a_player1_id INT REFERENCES game_players(id),
  team_a_player2_id INT REFERENCES game_players(id) NULL,
  team_b_player1_id INT REFERENCES game_players(id),
  team_b_player2_id INT REFERENCES game_players(id) NULL,
  status VARCHAR(50) DEFAULT 'not_started',
  winner VARCHAR(10),
  team_a_score DECIMAL(3,1) DEFAULT 0,
  team_b_score DECIMAL(3,1) DEFAULT 0,
  UNIQUE(game_id, day_number, match_number)
);

-- Hole-by-hole results
CREATE TABLE holes (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  winner VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, hole_number)
);

-- Indexes for performance
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_matches_game ON matches(game_id);
CREATE INDEX idx_holes_match ON holes(match_id);
CREATE INDEX idx_draft_picks_game ON draft_picks(game_id);