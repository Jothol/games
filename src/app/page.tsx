// src/app/page.tsx
"use client";


export default function Home() {
return (
<main className="min-h-screen flex items-center justify-center p-6">
<form
className="flex gap-3"
onSubmit={(e) => {
e.preventDefault();
const name = new FormData(e.currentTarget)
.get("name")
?.toString()
.trim()
.toLowerCase();
if (!name) return;
if (name === "admin") window.location.href = "/admin";
else if (name === "display") window.location.href = "/display";
else window.location.href = `/player?name=${encodeURIComponent(name)}`;
}}
>
<input
name="name"
placeholder="Enter your name (admin/display for special)"
className="border rounded px-3 py-2"
autoFocus
/>
<button className="bg-black text-white px-4 py-2 rounded">Join</button>
</form>
</main>
);
}