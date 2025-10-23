// src/types.ts
export type GameState = {
status: 'lobby' | 'in-round' | 'scoring';
currentRoundId: string | null;
timerEnabled: boolean;
timerSec: number; // seconds chosen for next round
roundEndsAt?: number | null; // epoch ms during active round
reveal: boolean; // show answers on display
roundIndex: number; // 0-based
};


export type Player = {
name: string;
score: number;
joinedAt: number; // epoch ms
isActive: boolean;
};


export type RoundDoc = {
id?: string;
index: number;
questionText: string;
createdAt: number; // epoch ms
closedAt?: number | null;
};


export type Answer = {
playerId: string; // same as player doc id
name: string;
answerText: string;
submittedAt: number; // epoch ms
};


export type Question = {
text: string;
addedAt: number;
};