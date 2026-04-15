import { useEffect, useState } from 'react';
import { authenticate, nakamaSession, nakamaSocket, nakamaClient } from './nakama';
import { useGameStore, sendMove, sendRematch, Mark } from './store';
import './index.css';

function App() {
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "authenticated">("idle");
  const [matchmaking, setMatchmaking] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const state = useGameStore();

  useEffect(() => {
    if (authStatus === "authenticated" && !state.match) {
      nakamaClient.listLeaderboardRecords(nakamaSession!, "tictactoe_wins")
        .then(res => setLeaderboard(res.records || []))
        .catch(err => console.error("Leaderboard fetch error:", err));
    }
  }, [authStatus, state.match]);

  useEffect(() => {
    // Timer Loop
    const interval = setInterval(() => {
      if (state.playing && state.deadline > 0) {
        const now = Math.floor(Date.now() / 1000);
        const remaining = state.deadline - now;
        if (remaining > 0) {
          setTimerText(`Time remaining: ${remaining}s`);
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
    try {
      setAuthStatus("loading");
      const session = await authenticate();

      // Setup socket listeners
      nakamaSocket!.onmatchdata = (result) => {
        const opCode = result.op_code;
        const data = result.data ? JSON.parse(new TextDecoder().decode(result.data)) : null;

        // 1 = START, 2 = UPDATE, 3 = DONE
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
    // Optimistic update
    const newBoard = [...state.board];
    newBoard[index] = state.ourMark;
    useGameStore.getState().updateState({ board: newBoard });
    sendMove(index);
  };

  if (authStatus !== "authenticated") {
    return (
      <div className="auth-container">
        <div className="glass-panel">
          <h1>LILA TIC-TAC-TOE</h1>
          <p>Multiplayer Server Authoritative Arena</p>
          <button className="btn-primary" onClick={handleLogin}>
            {authStatus === 'loading' ? 'Authenticating...' : 'Enter Arena'}
          </button>
        </div>
      </div>
    );
  }

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
              <div className="mode-selectors" style={{ marginTop: '20px' }}>
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

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Match ID"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '5px', width: '80%' }}
                />
                <button className="btn-primary" onClick={joinCustomMatch} style={{ width: '80%' }}>Join Custom Room</button>
              </div>

              <div className="leaderboard-section" style={{ marginTop: '30px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px', marginBottom: '10px' }}>Top Players</h3>
                {leaderboard.length === 0 ? <p style={{ opacity: 0.8 }}>No records yet.</p> : (
                  <table style={{ width: '100%', color: 'white', borderCollapse: 'collapse' }}>
                    <tbody>
                      {leaderboard.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 4px', width: '30px', opacity: 0.6 }}>#{idx + 1}</td>
                          <td style={{ padding: '8px 4px' }}>{r.username || r.owner_id.substring(0, 8)}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 'bold' }}>{r.score} wins</td>
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

  return (
    <div className="game-container">
      <div className="header-info">
        <div className="player-info">
          <span>You</span>
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
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{timerText}</div>
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
          <span>Opponent</span>
          <span className="player-score" style={{ color: state.ourMark === Mark.X ? 'var(--mark-o)' : 'var(--mark-x)' }}>
            {state.ourMark === Mark.X ? 'O' : 'X'}
          </span>
        </div>
      </div>

      {!state.playing && state.winner === null && (
        <div style={{ textAlign: 'center', marginBottom: '20px', color: 'white' }}>
          <p>Share this Match ID with your friend:</p>
          <code style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px', userSelect: 'all', fontSize: '12px' }}>
            {state.match.match_id}
          </code>
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
          <div style={{ display: 'flex', gap: '15px' }}>
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
