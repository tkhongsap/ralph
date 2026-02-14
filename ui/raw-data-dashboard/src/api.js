const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

async function requestJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Request failed (${response.status}): ${message}`);
  }
  return response.json();
}

export function getSummary() {
  return requestJson(`${API_BASE}/api/raw/dashboard/summary`);
}

export function getFilePreview(fileName, rows = 20) {
  const encoded = encodeURIComponent(fileName);
  return requestJson(`${API_BASE}/api/raw/dashboard/file/${encoded}?rows=${rows}`);
}
