import type { Run, RunConfig, RunReport } from '../types'

const API_BASE = ''

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('crucible_token') ?? 'dev-token'
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

export const api = {
  createRun: (config: RunConfig) =>
    request<{ run_id: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getRun: (id: string) => request<Run>(`/runs/${id}`),

  getReport: (id: string) => request<RunReport>(`/runs/${id}/report`),

  getManifest: (id: string) => request<string>(`/runs/${id}/manifest`),

  listRuns: () => request<Run[]>('/runs'),

  reloadPolicies: () =>
    request<{ status: string }>('/policies/reload', { method: 'POST' }),
}
