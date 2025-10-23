"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

const PLAY_KEY = "47-pass-to-play@";

export default function Home() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthed(!!u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (key.trim() !== PLAY_KEY) {
      setError("Incorrect Key");
      return;
    }
    try {
      await signInAnonymously(auth); // persists on device
    } catch {
      setError("Sign-in failed. Try again.");
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6">Games</h1>

      <ul className="space-y-3 list-disc pl-5 mb-10">
        <li><Link className="underline" href="/trivia">Trivia</Link></li>
        {/* future games go here */}
      </ul>

      <section className="mt-auto border rounded p-4 space-y-3">
        <div className="text-sm text-gray-600">
          {ready ? (authed ? <span className="text-green-600">Authorized</span> : "Not Authorized to Play")
                 : "Checking…"}
        </div>

        {!authed && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="password"
              className="border rounded px-3 py-2 w-full"
              placeholder="Enter play key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
            <button className="bg-black text-white px-4 py-2 rounded">Enter</button>
          </form>
        )}

        {error && <div className="text-red-600 text-sm">{error}</div>}
      </section>
    </main>
  );
}
