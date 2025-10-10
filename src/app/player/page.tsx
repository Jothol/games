"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import type { GameState, Player } from "@/types";

const STATE_DOC_ID = "global";

function PlayerInner() {
  const params = useSearchParams();
  const nameParam = (params.get("name") || "").trim();
  const playerId = nameParam.toLowerCase();

  const [player, setPlayer] = useState<Player | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [answer, setAnswer] = useState("");
  const [submittedForRound, setSubmittedForRound] = useState<string | null>(null);

  // Register / load player
  useEffect(() => {
    if (!playerId) return;
    (async () => {
      const pref = doc(db, "players", playerId);
      const snap = await getDoc(pref);
      if (!snap.exists()) {
        await setDoc(pref, {
          name: nameParam,
          score: 0,
          joinedAt: Date.now(),
          isActive: true,
        } as Player);
      }
    })();
  }, [playerId, nameParam]);

  // Subscribe to player document
  useEffect(() => {
    if (!playerId) return;
    const unsub = onSnapshot(doc(db, "players", playerId), (d) => {
      if (d.exists()) setPlayer(d.data() as Player);
    });
    return () => unsub();
  }, [playerId]);

  // Subscribe to game state and my answer for current round
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "state", STATE_DOC_ID), (d) => {
      const data = d.data() as GameState | undefined;
      setGs(data ?? null);

      if (!data?.currentRoundId) {
        setSubmittedForRound(null);
        return;
      }
      const aUnsub = onSnapshot(
        doc(db, "rounds", data.currentRoundId, "answers", playerId),
        (ad) => {
          if (ad.exists()) setSubmittedForRound(data.currentRoundId);
          else setSubmittedForRound(null);
        }
      );
      return () => aUnsub();
    });
    return () => unsub();
  }, [playerId]);

  const canSubmit =
    gs?.status === "in-round" &&
    gs.currentRoundId &&
    submittedForRound !== gs.currentRoundId;

  async function submitAnswer() {
    if (!gs?.currentRoundId || !playerId) return;
    const text = answer.trim();
    await setDoc(doc(db, "rounds", gs.currentRoundId, "answers", playerId), {
      playerId,
      name: player?.name ?? nameParam,
      answerText: text,
      submittedAt: Date.now(),
    });
    setAnswer("");
  }

  return (
    <main className="min-h-screen p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Player</h1>
      <div className="mb-4">
        Hello <span className="font-semibold">{player?.name ?? nameParam}</span>{" "}
        — Score: {player?.score ?? 0}
      </div>

      {gs?.status === "lobby" && (
        <p className="text-gray-600">Waiting for the game to begin…</p>
      )}

      {gs?.status === "in-round" && (
        <div className="space-y-3">
          {canSubmit ? (
            <>
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Type your answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <button
                className="bg-black text-white px-4 py-2 rounded"
                onClick={submitAnswer}
              >
                Submit
              </button>
            </>
          ) : (
            <div className="italic text-gray-600">Submitted</div>
          )}
        </div>
      )}

      {gs?.status === "scoring" && (
        <p className="text-gray-600">Scoring in progress…</p>
      )}
    </main>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen p-6">Loading…</main>}>
      <PlayerInner />
    </Suspense>
  );
}
