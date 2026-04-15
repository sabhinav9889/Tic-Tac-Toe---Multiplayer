import { useEffect, useState } from 'react';
import { authenticate, nakamaSession, nakamaSocket, nakamaClient } from './nakama';
import { useGameStore, sendMove, sendRematch, Mark } from './store';
import './index.css';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

function App() {
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "authenticated">("idle");
  const [matchmaking, setMatchmaking] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [usernameInput, setUsernameInput] = useState(() => localStorage.getItem("ttt_username") || "");
  const [usernameError, setUsernameError] = useState("");

  const state = useGameStore();

  useEffect(() => {
    if (authStatus === "authenticated" && !state.match) {
      nakamaClient.listLeaderboardRecords(nakamaSession!, "tictactoe_wins")
        .then(res => setLeaderboard(res.records || []))
        .catch(err => console.error("Leaderboard fetch error:", err));
    }
  }, [authStatus, state.match]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (state.playing && state.deadline > 0) {
        const now = Math.floor(Date.now() / 1000);
        const remaining = state.deadline - now;
        if (remaining > 0) {
          setTimerText(`${remaining}s`);
        } else {
          setTimerText("Time's up!");
        }
      } else {
        setTimerText("");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.playing, state.deadline]);

  const handleLogin = async () => {
    const trimmed = usernameInput.trim();
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError("3\u201316 characters, letters, numbers, or underscores only");
      return;
    }
    setUsernameError("");

    try {
      setAuthStatus("loading");
      localStorage.setItem("ttt_username", trimmed);
      const session = await authenticate(trimmed);

      useGameStore.getState().updateState({ ourUsername: session.username || trimmed });

      nakamaSocket!.onmatchdata = (result) => {
        const opCode = result.op_code;
        const data = result.data ? JSON.parse(new TextDecoder().decode(result.data)) : null;

        if (opCode === 1) {
          const ourMark = data.marks[session.user_id as string] || Mark.UNDEFINED;
          useGameStore.getState().updateState({
            board: data.board,
            marks: data.marks,
            ourMark,
            currentTurn: data.mark,
            deadline: data.deadline,
            playing: true,
            rematchRequested: false,
            opponentRematchRequested: false,
            winner: null,
            winnerPositions: null,
          });
          setMatchmaking(false);

          // Look up opponent username
          const opponentId = Object.keys(data.marks).find(id => id !== session.user_id);
          if (opponentId) {
            if (opponentId === "ai-user-id") {
              useGameStore.getState().updateState({ opponentUsername: "AI Bot" });
            } else {
              nakamaClient.getUsers(nakamaSession!, [opponentId])
                .then(res => {
                  const opponent = res.users?.[0];
                  const name = opponent?.username || opponentId.substring(0, 8);
                  useGameStore.getState().updateState({ opponentUsername: name });
                })
                .catch(() => {
                  useGameStore.getState().updateState({ opponentUsername: opponentId.substring(0, 8) });
                });
            }
          }
        } else if (opCode === 2) {
          useGameStore.getState().updateState({
            board: data.board,
            currentTurn: data.mark,
            deadline: data.deadline,
          });
        } else if (opCode === 3) {
          useGameStore.getState().updateState({
            board: data.board,
            playing: false,
            winner: data.winner,
            winnerPositions: data.winnerPositions,
          });
        }
      };

      nakamaSocket!.onmatchmakermatched = async (matched) => {
        const match = await nakamaSocket!.joinMatch(matched.match_id, matched.token);
        useGameStore.getState().setMatch(match);
      };

      setAuthStatus("authenticated");
    } catch (error) {
      console.error(error);
      setAuthStatus("idle");
    }
  };

  const findMatch = async (fast: boolean, ai: boolean = false) => {
    setMatchmaking(true);
    try {
      const result = await nakamaClient.rpc(nakamaSession!, "find_match_js", { fast, ai });
      const payloadObj = result.payload as any;
      const matchIds = payloadObj.matchIds || [];
      if (matchIds && matchIds.length > 0) {
        const match = await nakamaSocket!.joinMatch(matchIds[0]);
        useGameStore.getState().setMatch(match);
      } else {
        setMatchmaking(false);
      }
    } catch (err) {
      console.error("Matchmaking error", err);
      setMatchmaking(false);
    }
  };

  const createMatch = async () => {
    try {
      const result = await nakamaClient.rpc(nakamaSession!, "create_match_js", { fast: false });
      const payloadObj = result.payload as any;
      if (payloadObj.matchId) {
        const match = await nakamaSocket!.joinMatch(payloadObj.matchId);
        useGameStore.getState().setMatch(match);
      }
    } catch (err) {
      console.error("Error creating match", err);
    }
  };

  const joinCustomMatch = async () => {
    if (!joinCode) return;
    try {
      const match = await nakamaSocket!.joinMatch(joinCode);
      useGameStore.getState().setMatch(match);
      setJoinCode("");
    } catch (err) {
      console.error("Error joining match", err);
      alert("Failed to join match! Please check the code.");
    }
  };

  const handleCellClick = (index: number) => {
    if (!state.playing || state.board[index] !== null || state.currentTurn !== state.ourMark) return;
    const newBoard = [...state.board];
    newBoard[index] = state.ourMark;
    useGameStore.getState().updateState({ board: newBoard });
    sendMove(index);
  };

  /* ── Auth Screen ── */
  if (authStatus !== "authenticated") {
    return (
      <div className="auth-container">
        <div className="glass-panel">
          <h1>LILA TIC-TAC-TOE</h1>
          <p>Multiplayer Server Authoritative Arena</p>
          <div className="username-field">
            <input
              type="text"
              className="username-input"
              placeholder="Enter username"
              value={usernameInput}
              onChange={(e) => {
                setUsernameInput(e.target.value);
                setUsernameError("");
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              maxLength={16}
            />
            {usernameError && <span className="username-error">{usernameError}</span>}
          </div>
          <button
            className="btn-primary"
            onClick={handleLogin}
            disabled={authStatus === 'loading'}
          >
            {authStatus === 'loading' ? 'Authenticating...' : 'Enter Arena'}
          </button>
        </div>
      </div>
    );
  }

  /* ── Matchmaking Screen ── */
  if (!state.match) {
    return (
      <div className="matchmaking-hub">
        <div className="glass-panel">
          <h2>Select Game Mode</h2>
          {matchmaking ? (
            <div style={{ marginTop: '20px' }}>
              <p className="turn-indicator">Searching for opponent...</p>
            </div>
          ) : (
            <>
              <div className="mode-selectors">
                <div className="mode-card" onClick={() => findMatch(false)}>
                  <h3>Classic</h3>
                  <p>Normal time per turn</p>
                </div>
                <div className="mode-card" onClick={() => findMatch(true)}>
                  <h3>Blitz</h3>
                  <p>Fast paced 10s turns</p>
                </div>
                <div className="mode-card" onClick={() => findMatch(false, true)}>
                  <h3>vs AI</h3>
                  <p>Play against bot</p>
                </div>
                <div className="mode-card" onClick={createMatch}>
                  <h3>Create Room</h3>
                  <p>Play with a friend</p>
                </div>
              </div>

              <div className="join-section">
                <input
                  type="text"
                  className="join-input"
                  placeholder="Enter Match ID to join"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <button className="btn-primary" onClick={joinCustomMatch}>Join Room</button>
              </div>

              <div className="leaderboard-section">
                <h3>Top Players</h3>
                {leaderboard.length === 0 ? (
                  <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>No records yet.</p>
                ) : (
                  <table className="leaderboard-table">
                    <tbody>
                      {leaderboard.map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ width: '30px', opacity: 0.5 }}>#{idx + 1}</td>
                          <td>{r.username || r.owner_id.substring(0, 8)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{r.score} wins</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Game Screen ── */
  return (
    <div className="game-container">
      <div className="header-info">
        <div className="player-info">
          <span className="player-name">{state.ourUsername || 'You'}</span>
          <span className="player-score" style={{ color: state.ourMark === Mark.X ? 'var(--mark-x)' : 'var(--mark-o)' }}>
            {state.ourMark === Mark.X ? 'X' : 'O'}
          </span>
        </div>

        <div className="player-info">
          {state.playing && (
            <>
              <div className="turn-indicator" style={{ visibility: state.currentTurn === state.ourMark ? 'visible' : 'hidden' }}>
                Your Turn
              </div>
              <div className="timer-text">{timerText}</div>
            </>
          )}
          {!state.playing && state.winner !== null && (
            <div className="turn-indicator" style={{ color: 'white', animation: 'none' }}>Game Over</div>
          )}
          {!state.playing && state.winner === null && (
            <div className="turn-indicator" style={{ color: 'white', opacity: 0.8 }}>Waiting...</div>
          )}
        </div>

        <div className="player-info">
          <span className="player-name">{state.opponentUsername || 'Opponent'}</span>
          <span className="player-score" style={{ color: state.ourMark === Mark.X ? 'var(--mark-o)' : 'var(--mark-x)' }}>
            {state.ourMark === Mark.X ? 'O' : 'X'}
          </span>
        </div>
      </div>

      {!state.playing && state.winner === null && (
        <div className="match-id-share">
          <p>Share this Match ID with your friend:</p>
          <code>{state.match.match_id}</code>
        </div>
      )}

      <div className="board">
        {state.board.map((cellMark, i) => {
          let markClass = '';
          if (cellMark === Mark.X) markClass = 'mark-1 occupied';
          if (cellMark === Mark.O) markClass = 'mark-2 occupied';

          return (
            <div
              key={i}
              className={`cell ${markClass}`}
              onClick={() => handleCellClick(i)}
            >
              {cellMark === Mark.X ? 'X' : cellMark === Mark.O ? 'O' : ''}
            </div>
          );
        })}
      </div>

      {!state.playing && state.winner !== null && (
        <div className="winner-overlay">
          <div className="winner-title">
            {state.winner === state.ourMark ? 'VICTORY' : state.winner === Mark.UNDEFINED ? 'DRAW' : 'DEFEAT'}
          </div>
          <div className="winner-actions">
            <button className="btn-primary" onClick={() => sendRematch()}>
              {state.rematchRequested ? 'Waiting...' : 'Rematch'}
            </button>
            <button className="btn-primary" onClick={() => {
              if (state.match) nakamaSocket!.leaveMatch(state.match.match_id);
              useGameStore.getState().resetGame();
            }}>
              Leave Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
