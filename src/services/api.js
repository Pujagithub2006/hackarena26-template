// ─── api.js ───────────────────────────────────────────────────────
// Centralized API service for NutriSync

export async function calculatePhysiology(data) {
  const response = await fetch("http://localhost:5000/api/physiology", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return await response.json();
}
