/**
 * Centralized API client.
 * Base URL switches automatically between local dev and Railway production
 * via the VITE_API_URL environment variable.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Generic fetch wrapper ─────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json() as Promise<T>;
}

// ── Scraper endpoints ─────────────────────────────────────────────────────

export const scraperApi = {
  runAll: (limitPerSource = 30) =>
    request<{ task_id: string }>("/api/scrape/run", {
      method: "POST",
      body: JSON.stringify({ limit_per_source: limitPerSource }),
    }),

  runOne: (source: string, limit = 30) =>
    request<{ task_id: string }>(`/api/scrape/${source}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),

  getStatus: () =>
    request<Record<string, { status: string; jobs_found: number; last_run: string }>>(
      "/api/scrape/status"
    ),
};

// ── Jobs endpoints ────────────────────────────────────────────────────────

export const jobsApi = {
  getAll: (page = 1, limit = 25) =>
    request<{ jobs: Job[]; total: number }>(`/api/jobs?page=${page}&limit=${limit}`),

  search: (query: string, source?: string) =>
    request<{ jobs: Job[] }>(`/api/jobs/search?q=${query}${source ? `&source=${source}` : ""}`),

  delete: (jobId: string) =>
    request<void>(`/api/jobs/${jobId}`, { method: "DELETE" }),

  rerunNlp: (jobId: string) =>
    request<void>(`/api/jobs/${jobId}/nlp`, { method: "POST" }),
};

// ── NLP endpoints ─────────────────────────────────────────────────────────

export const nlpApi = {
  processAll: () => request<{ processed: number }>("/api/nlp/process", { method: "POST" }),
};

// ── Health ────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => request<{ status: string }>("/health"),
};

// ── Types ─────────────────────────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  source: string;
  url: string;
  scraped_at: string;
  skills?: string[];
}

// ── Profile & Recommendations ─────────────────────────────────────────────
export const getUserProfile = (userId: string) => request<{ skills: string[] }>(`/api/user/profile/${userId}`);

export const saveUserProfile = (data: { user_id: string; name?: string; skills: string[]; email?: string }) => request<{ status: string; id: string }>('/api/user/profile', { method: 'POST', body: JSON.stringify(data) });

export const getRecommendations = (userId: string) => request<{ recommendations: any[]; total_scanned: number }>(`/api/recommend/${userId}`);
