import { useEffect, useState } from 'react';
import { authenticate, nakamaSession, nakamaSocket, nakamaClient } from './nakama';
import { useGameStore, sendMove, Mark } from './store';
import './index.css';

function App() {
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "authenticated">("idle");
  const [matchmaking, setMatchmaking] = useState(false);
  const [timerText, setTimerText] = useState("");

  const state = useGameStore();

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

  const findMatch = async (fast: boolean) => {
    setMatchmaking(true);
    try {
      const result = await nakamaClient.rpc(nakamaSession!, "find_match_js", { fast, ai: false });
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
            <div className="mode-selectors" style={{ marginTop: '20px' }}>
              <div className="mode-card" onClick={() => findMatch(false)}>
                <h3>Classic</h3>
                <p>Normal time per turn</p>
              </div>
              <div className="mode-card" onClick={() => findMatch(true)}>
                <h3>Blitz</h3>
                <p>Fast paced 10s turns</p>
              </div>
            </div>
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
        </div>

        <div className="player-info">
          <span>Opponent</span>
          <span className="player-score" style={{ color: state.ourMark === Mark.X ? 'var(--mark-o)' : 'var(--mark-x)' }}>
            {state.ourMark === Mark.X ? 'O' : 'X'}
          </span>
        </div>
      </div>

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
          <button className="btn-primary" onClick={() => useGameStore.getState().resetGame()}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
