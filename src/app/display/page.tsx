"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import type { Answer, GameState, Player, RoundDoc } from "@/types";

const STATE_DOC_ID = "global";

export default function DisplayPage() {
  const [gs, setGs] = useState<GameState | null>(null);
  const [roundQ, setRoundQ] = useState<string>("");
  const [players, setPlayers] = useState<{ id: string; data: Player }[]>([]);
  const [answers, setAnswers] = useState<{ id: string; data: Answer }[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "state", STATE_DOC_ID), (d) => {
      const data = d.data() as GameState | undefined;
      setGs(data ?? null);

      if (data?.currentRoundId) {
        const rUnsub = onSnapshot(
          doc(db, "rounds", data.currentRoundId),
          (rd) => {
            const r = rd.data() as RoundDoc | undefined;
            setRoundQ(r?.questionText ?? "");
          }
        );
        const aUnsub = onSnapshot(
          query(
            collection(db, "rounds", data.currentRoundId, "answers"),
            orderBy("submittedAt", "asc")
          ),
          (snap) => {
            setAnswers(
              snap.docs.map((x) => ({ id: x.id, data: x.data() as Answer }))
            );
          }
        );
        return () => {
          rUnsub();
          aUnsub();
        };
      } else {
        setRoundQ("");
        setAnswers([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const qPlayers = query(collection(db, "players"), orderBy("joinedAt", "asc"));
    return onSnapshot(qPlayers, (snap) => {
      setPlayers(
        snap.docs.map((d) => ({ id: d.id, data: d.data() as Player }))
      );
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remainingSec = useMemo(() => {
    if (!gs?.timerEnabled || !gs.roundEndsAt || gs.status !== "in-round")
      return null;
    const diff = Math.max(0, Math.ceil((gs.roundEndsAt - now) / 1000));
    return diff;
  }, [gs, now]);

  return (
    <main className="min-h-screen p-8 text-white" style={{ background: "#0b1020" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-end justify-between">
          <h1 className="text-3xl font-bold">Trivia Night</h1>
          <div className="text-right">
            <div className="text-sm opacity-80">
              Round {gs?.roundIndex != null ? gs.roundIndex + 1 : "-"} •{" "}
              {gs?.status ?? "—"}
            </div>
            {remainingSec != null && (
              <div className="text-4xl font-bold">{remainingSec}</div>
            )}
          </div>
        </header>

        {/* Question */}
        <section className="bg-white/10 rounded-xl p-6 min-h-24">
          <div className="text-xl">
            {gs?.status === "in-round" || gs?.status === "scoring"
              ? roundQ
              : "Waiting to begin…"}
          </div>
        </section>

        {/* Players & (optional) answers */}
        <section className="bg-white/5 rounded-xl p-6">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-300">
                <th className="py-2">Player</th>
                <th className="py-2">Score</th>
                <th className="py-2">Answer</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const ans = answers.find((a) => a.id === p.id);
                return (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2 font-medium">{p.data.name}</td>
                    <td className="py-2">{p.data.score}</td>
                    <td className="py-2 italic text-gray-200">
                      {gs?.reveal
                        ? ans?.data.answerText ?? "—"
                        : gs?.status === "in-round"
                        ? "(hidden)"
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
