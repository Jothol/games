"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { GameState, Player, RoundDoc, Answer, Question } from "@/app/trivia/types";

const STATE_DOC_ID = "global"; // /trivia/{triviaId}/state/global
const TRIVIA_ID = "default";   // TODO: swap to dynamic (e.g., from URL or settings)

export default function AdminPage() {
  const [players, setPlayers] = useState<{ id: string; data: Player }[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [questions, setQuestions] = useState<{ id: string; data: Question }[]>(
    []
  );
  const [gs, setGs] = useState<GameState | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSec, setTimerSec] = useState(30);
  const [answers, setAnswers] = useState<{ id: string; data: Answer }[]>([]);
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());

  async function endGameAndWipe() {
    if (!confirm("This will delete all players, rounds, answers, questions, and reset state. Continue?")) return;

    // Delete subcollections (answers) under each round
    const roundsSnap = await getDocs(collection(db, "trivia", TRIVIA_ID, "rounds"));
    for (const r of roundsSnap.docs) {
      const ansSnap = await getDocs(collection(db, "trivia", TRIVIA_ID, "rounds", r.id, "answers"));
      for (const a of ansSnap.docs) {
        await deleteDoc(a.ref);
      }
      await deleteDoc(r.ref);
    }

    // Delete nested top-level (within trivia/{triviaId})
    const playersSnap = await getDocs(collection(db, "trivia", TRIVIA_ID, "players"));
    for (const p of playersSnap.docs) await deleteDoc(p.ref);

    const questionsSnap = await getDocs(collection(db, "trivia", TRIVIA_ID, "questions"));
    for (const q of questionsSnap.docs) await deleteDoc(q.ref);

    // Reset state/global
    await setDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), {
      status: "lobby",
      currentRoundId: null,
      timerEnabled: false,
      timerSec: 30,
      roundEndsAt: null,
      reveal: false,
      roundIndex: 0,
    } as GameState);

    alert("Game reset complete.");
    setCorrectIds(new Set());
  }

  // Live players list
  useEffect(() => {
    const q = query(
      collection(db, "trivia", TRIVIA_ID, "players"),
      orderBy("joinedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, data: d.data() as Player })));
    });
  }, []);

  // Live questions list
  useEffect(() => {
    const q = query(
      collection(db, "trivia", TRIVIA_ID, "questions"),
      orderBy("addedAt", "asc")
    );
    return onSnapshot(q, (snap) => {
      setQuestions(
        snap.docs.map((d) => ({ id: d.id, data: d.data() as Question }))
      );
    });
  }, []);

  // Live game state
  useEffect(() => {
    const unsubState = onSnapshot(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), (d) => {
      const data = d.data() as GameState | undefined;
      if (!data) {
        const init: GameState = {
          status: "lobby",
          currentRoundId: null,
          timerEnabled: false,
          timerSec: 30,
          roundEndsAt: null,
          reveal: false,
          roundIndex: 0,
        };
        setDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), init);
        return;
      }
      setGs(data);
      setTimerEnabled(data.timerEnabled);
      setTimerSec(data.timerSec);
    });

    return () => {
      unsubState();
    };
  }, []);

  // subscribe to answers for the current round
  useEffect(() => {
    if (!gs?.currentRoundId) {
      setAnswers([]);
      return;
    }
    const q = query(
      collection(db, "trivia", TRIVIA_ID, "rounds", gs.currentRoundId, "answers"),
      orderBy("submittedAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAnswers(
        snap.docs.map((dd) => ({ id: dd.id, data: dd.data() as Answer }))
      );
    });
    return () => unsub();
  }, [gs?.currentRoundId]);

  const currentRoundId = useMemo(
    () => gs?.currentRoundId ?? null,
    [gs?.currentRoundId]
  );

  async function handleAddQuestion() {
    const text = questionInput.trim();
    if (!text) return;
    await addDoc(collection(db, "trivia", TRIVIA_ID, "questions"), {
      text,
      addedAt: Date.now(),
    } as Question);
    setQuestionInput("");
  }

  async function beginGame() {
    // pull next question (first in queue)
    const qsSnap = await getDocs(
      query(collection(db, "trivia", TRIVIA_ID, "questions"), orderBy("addedAt", "asc"))
    );
    if (qsSnap.empty) {
      alert("Add at least one question first.");
      return;
    }
    const first = qsSnap.docs[0];

    // create round
    const roundRef = await addDoc(collection(db, "trivia", TRIVIA_ID, "rounds"), {
      index: 0,
      questionText: (first.data() as Question).text,
      createdAt: Date.now(),
      closedAt: null,
    } as RoundDoc);

    // consume the question from queue
    await deleteDoc(first.ref);

    const endsAt = timerEnabled ? Date.now() + timerSec * 1000 : null;

    const newState: GameState = {
      status: "in-round",
      currentRoundId: roundRef.id,
      timerEnabled,
      timerSec,
      roundEndsAt: endsAt,
      reveal: false,
      roundIndex: 0,
    };
    await setDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), newState);
  }

  async function endRound() {
    if (!gs?.currentRoundId) return;
    await updateDoc(doc(db, "trivia", TRIVIA_ID, "rounds", gs.currentRoundId), {
      closedAt: Date.now(),
    });
    await updateDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), {
      status: "scoring",
      roundEndsAt: null,
    });
  }

  function toggleCorrect(id: string) {
    setCorrectIds((prev) => {
      const cp = new Set(prev);
      if (cp.has(id)) cp.delete(id);
      else cp.add(id);
      return cp;
    });
  }

  async function applyScores() {
    // +1 point per selected correct answer
    const batch = players
      .filter((p) => correctIds.has(p.id))
      .map((p) =>
        updateDoc(doc(db, "trivia", TRIVIA_ID, "players", p.id), {
          score: (p.data.score || 0) + 1,
        })
      );
    await Promise.all(batch);
    // reveal on display
    await updateDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), { reveal: true });
  }

  async function nextRound() {
    if (!gs) return;
    const nextIndex = (gs.roundIndex ?? 0) + 1;

    const qsSnap = await getDocs(
      query(collection(db, "trivia", TRIVIA_ID, "questions"), orderBy("addedAt", "asc"))
    );
    if (qsSnap.empty) {
      alert("No more questions in queue.");
      return;
    }
    const first = qsSnap.docs[0];

    const roundRef = await addDoc(collection(db, "trivia", TRIVIA_ID, "rounds"), {
      index: nextIndex,
      questionText: (first.data() as Question).text,
      createdAt: Date.now(),
      closedAt: null,
    } as RoundDoc);

    await deleteDoc(first.ref);

    const endsAt = timerEnabled ? Date.now() + timerSec * 1000 : null;

    const newState: GameState = {
      status: "in-round",
      currentRoundId: roundRef.id,
      timerEnabled,
      timerSec,
      roundEndsAt: endsAt,
      reveal: false,
      roundIndex: nextIndex,
    };
    await setDoc(doc(db, "trivia", TRIVIA_ID, "state", STATE_DOC_ID), newState);
    setCorrectIds(new Set());
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* Add to question bank */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Add Question to Bank (usable any time)</h2>
        <div className="flex gap-2">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Type a question and press Add"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
          />
          <button
            className="bg-black text-white px-4 py-2 rounded"
            onClick={handleAddQuestion}
          >
            Add
          </button>
        </div>
        <p className="text-sm text-gray-500">Queue size: {questions.length}</p>
      </section>

      {/* Players */}
      <section className="border rounded p-4 space-y-2">
        <h2 className="font-semibold">Players ({players.length})</h2>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <span key={p.id} className="px-3 py-1 rounded border">
              {p.data.name} — {p.data.score}
            </span>
          ))}
        </div>
      </section>

      {/* Timer Controls */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Timer</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
          />
          Enable timer
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="border rounded px-3 py-2 w-24"
            value={timerSec}
            min={5}
            onChange={(e) => setTimerSec(parseInt(e.target.value || "0", 10))}
          />
          <span>seconds</span>
        </div>
        <p className="text-sm text-gray-500">
          Timer value is captured when you start a round.
        </p>
      </section>

      {/* Round Controls */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Round Controls</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={beginGame}
          >
            Begin Game / Start Round
          </button>
          <button
            className="bg-orange-600 text-white px-4 py-2 rounded"
            onClick={endRound}
          >
            End Round
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={applyScores}
          >
            Score (apply + reveal)
          </button>
          <button
            className="bg-purple-700 text-white px-4 py-2 rounded"
            onClick={nextRound}
          >
            Begin Next Round
          </button>
          <button
            className="bg-red-700 text-white px-4 py-2 rounded"
            onClick={endGameAndWipe}
          >
            End Game (wipe & reset)
          </button>
        </div>
        <div className="text-sm text-gray-600">
          <div>Status: {gs?.status ?? "—"}</div>
          <div>Round: {gs?.roundIndex != null ? gs.roundIndex + 1 : "—"}</div>
          <div>Current Round Id: {currentRoundId ?? "—"}</div>
        </div>
      </section>

      {/* Scoring table */}
      {gs?.status === "scoring" && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-semibold">Mark correct answers</h2>
          <div className="space-y-2">
            {players.map((p) => {
              const a = answers.find((x) => x.id === p.id);
              return (
                <label key={p.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={correctIds.has(p.id)}
                    onChange={() => toggleCorrect(p.id)}
                  />
                  <span className="font-medium w-48">{p.data.name}</span>
                  <span className="text-gray-700">
                    {a?.data?.answerText ?? (
                      <em className="text-gray-400">— no answer —</em>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
