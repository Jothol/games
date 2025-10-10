"use client";
import { useSearchParams } from "next/navigation";

export default function PlayerPage() {
  const params = useSearchParams();
  const name = params.get("name");

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Player</h1>
      <p>Hello {name ?? "Player"} — placeholder player screen.</p>
    </main>
  );
}
