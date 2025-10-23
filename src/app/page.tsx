// src/app/page.tsx
"use client";


export default function Home() {
  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Games</h1>
      <ul className="space-y-3 list-disc pl-5">
        <li><a className="underline" href="/trivia">Trivia</a></li>
      </ul>
    </main>
  );
}