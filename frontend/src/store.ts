import { create } from 'zustand';
import type { Match } from '@heroiclabs/nakama-js';
import { nakamaSocket } from './nakama';

export const Mark = {
    UNDEFINED: 0,
    X: 1,
    O: 2,
} as const;
export type Mark = typeof Mark[keyof typeof Mark];

export interface GameState {
    board: (Mark | null)[];
    marks: Record<string, Mark | null>;
    ourMark: Mark;
    currentTurn: Mark;
    deadline: number;
    winner: Mark | null;
    winnerPositions: number[] | null;
    playing: boolean;
    match: Match | null;
    setMatch: (match: Match | null) => void;
    updateState: (update: Partial<GameState>) => void;
    resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    board: Array(9).fill(null),
    marks: {},
    ourMark: Mark.UNDEFINED,
    currentTurn: Mark.UNDEFINED,
    deadline: 0,
    winner: null,
    winnerPositions: null,
    playing: false,
    match: null,

    setMatch: (match) => set({ match }),

    updateState: (update) => set((state) => ({ ...state, ...update })),

    resetGame: () => set({
        board: Array(9).fill(null),
        marks: {},
        ourMark: Mark.UNDEFINED,
        currentTurn: Mark.UNDEFINED,
        deadline: 0,
        winner: null,
        winnerPositions: null,
        playing: false,
        match: null
    }),
}));

export const sendMove = (position: number) => {
    const { match } = useGameStore.getState();
    if (match && nakamaSocket) {
        nakamaSocket.sendMatchState(match.match_id, 4, JSON.stringify({ position })); // 4 is OpCode.MOVE
    }
};
