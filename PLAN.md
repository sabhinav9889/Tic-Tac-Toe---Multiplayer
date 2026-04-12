# Tic-Tac-Toe Multiplayer Game - Implementation Plan

## 1. Architecture Overview
- **Frontend**: React.js (using Vite) for a fast, component-driven UI.
- **Styling**: Vanilla CSS with modern, responsive, and premium web design aesthetics (glassmorphism, modern typography, deep vibrant colors, micro-animations).
- **Backend / Game Server**: Nakama game server acting as the real-time, server-authoritative backend.
- **Backend Logic**: TypeScript (compiled to JavaScript) for Nakama's server-side runtime, providing type safety and logic sharing potential.
- **Database**: PostgreSQL (which Nakama uses natively for user data, storage, and leaderboards).
- **Infrastructure**: Docker and Docker Compose for local development (running Nakama + DB in containers).

## 2. Nakama Backend Strategy
- **Authentication**: Simple Device ID or custom username authentication.
- **Matchmaking**: We will use Nakama's built-in Matchmaker. Players will issue a matchmake request, and Nakama will group them and spawn a match.
- **Server-Authoritative Match Handler**:
  - We'll implement a custom Match module (`matchInit`, `matchJoinAttempt`, `matchJoin`, `matchLoop`, `matchTerminate`).
  - **Game State**: Maintained entirely in the server memory for each match (the 3x3 board grid, player IDs, whose turn it is, match status, and turn timers).
  - **Tick Rate**: The `matchLoop` evaluates game states and incoming client moves at a fixed tick rate.
  - **Validation**: All moves pushed by clients are validated against the current board. Invalid moves are rejected. 
  - **End Conditions**: The server evaluates win/draw conditions after every valid move and broadcasts the result to clients.
- **Bonus Implementation: Leaderboards & Timers**:
  - We will set up a global leaderboard using Nakama's Leaderboard API to track wins.
  - Timers will be managed in the `matchLoop`. If a player's turn time exceeds the limit (e.g., 30s), the server forces an automatic forfeit.

## 3. Frontend Strategy
- **Networking**: We'll use `@heroiclabs/nakama-js` for WebSocket-based real-time communication.
- **State Management**: React Context or `useState` for the board and player stats. 
- **Application Flow**:
  1. **Login Screen**: Enter a username to authenticate.
  2. **Main Hub**: Displays player profile, current leaderboard ranking, and buttons to find a match (Classic or Timed).
  3. **Matchmaking Overlay**: "Searching for opponent...".
  4. **Game Board**: The Tic-Tac-Toe playing area, showcasing opponent data, current turn indicator, the board itself, and an active countdown timer (if in Timed Mode).
  5. **Post-Match Screen**: Win/Loss result, updated score, and a "Play Again" button.

## 4. Execution Phases

### Phase 1: Local Environment & Scaffolding
- Initialize the Git repository.
- Create `docker-compose.yml` to spin up Nakama and its Postgres database.
- Initialize the Nakama TypeScript backend project.
- Initialize the Vite React frontend project.

### Phase 2: Nakama Core & Matchmaking Logic
- Set up authentication endpoints via the client.
- Expose basic Matchmaking functions.
- Write the TypeScript Match Handler core (spawning games, keeping 3x3 board state, handling players joining).

### Phase 3: Game Logic & Server Authority
- Implement move validation (is it your turn? is the cell empty?).
- Implement real-time state broadcasting (so clients see X or O appear).
- Write win/draw detection logic.
- Handle abrupt player disconnects gracefully.

### Phase 4: Frontend Development & UI Polish
- Build a premium, mobile-responsive UI using Vanilla CSS.
- Map the frontend UI to the Nakama JS Client and underlying state.
- Add interactions, transitions, and hover details.

### Phase 5: Bonus Features
- Add match modes to properties (finding matches for 'timed' vs 'classic').
- Implement server tick turn countdowns and forfeit handlers.
- Wire up the leaderboards for End-Of-Match win calculations.

### Phase 6: Cloud Deployment
- Containerize the frontend with Nginx.
- Configure Nakama for public access.
- Deploy to a cloud provider (e.g., DigitalOcean, AWS, or GCP).
- Finalize the `README.md` as per requirements.
