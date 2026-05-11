import type { Run, RunConfig, RunReport } from '../types'

const API_BASE = ''

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('crucible_token')
    ?? import.meta.env.VITE_DEV_TOKEN
    ?? ''
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// The backend uses run_id as the primary key field name. Map it to id for
// frontend consistency so all components can use run.id uniformly.
function normalizeRun(raw: Record<string, unknown>): Run {
  return { ...raw, id: raw.run_id } as unknown as Run
}

export const api = {
  createRun: (config: RunConfig) =>
    request<{ run_id: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getRun: (id: string) =>
    request<Record<string, unknown>>(`/runs/${id}`).then(normalizeRun),

  getReport: (id: string) => request<RunReport>(`/runs/${id}/report`),

  getManifest: (id: string) => request<string>(`/runs/${id}/manifest`),

  listRuns: () =>
    request<Record<string, unknown>[]>('/runs').then(items => items.map(normalizeRun)),

  reloadPolicies: () =>
    request<{ status: string }>('/policies/reload', { method: 'POST' }),
}
