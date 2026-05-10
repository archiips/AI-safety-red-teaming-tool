import { useState, useCallback } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { api } from './api/client'
import RunForm from './components/RunForm'
import LiveStream from './components/LiveStream'
import HeatmapChart from './components/HeatmapChart'
import DrillDownPanel from './components/DrillDownPanel'
import RunHistory from './components/RunHistory'
import type { RunConfig, Run, HeatmapCell, RunReport } from './types'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

function AppInner() {
  const [view, setView] = useState<'new' | 'history'>('new')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null)
  const [compareRunId, setCompareRunId] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(true)

  const downloadReport = useCallback((report: RunReport) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `crucible-report-${report.run_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const { data: runs = [], refetch: refetchRuns } = useQuery({
    queryKey: ['runs'],
    queryFn: () => api.listRuns(),
    refetchInterval: activeRunId ? 5000 : false,
  })

  const { data: report } = useQuery<RunReport>({
    queryKey: ['report', activeRunId],
    queryFn: () => api.getReport(activeRunId!),
    enabled: !!activeRunId,
    // React Query v5: refetchInterval callback receives the Query object
    refetchInterval: (query) =>
      (query.state.data as RunReport | undefined)?.status === 'completed' ? false : 4000,
  })

  const { data: compareReport } = useQuery({
    queryKey: ['report', compareRunId],
    queryFn: () => api.getReport(compareRunId!),
    enabled: !!compareRunId,
  })

  const createRun = useMutation({
    mutationFn: (cfg: RunConfig) => api.createRun(cfg),
    onSuccess: ({ run_id }) => {
      setActiveRunId(run_id)
      setView('new')
      refetchRuns()
    },
  })

  const activeRun = runs.find((r: Run) => r.id === activeRunId)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c12',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

        * { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2235; border-radius: 4px; }

        .nav-tab {
          padding: 6px 16px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4b5280;
          transition: all 0.15s;
        }

        .nav-tab.active {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.3);
          color: #a5b4fc;
        }

        .nav-tab:hover:not(.active) {
          color: #6b7280;
          border-color: #1e2235;
        }

        .panel {
          background: #131620;
          border: 1px solid #1e2235;
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-header {
          padding: 14px 20px;
          border-bottom: 1px solid #1e2235;
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 800;
          color: #f1f3f9;
          letter-spacing: -0.3px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Top nav */}
      <header style={{
        borderBottom: '1px solid #131620',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: '#0f1117',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
            borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, boxShadow: '0 0 14px rgba(99,102,241,0.4)',
          }}>
            ⚗
          </div>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 17, color: '#f1f3f9', letterSpacing: -0.5,
          }}>
            Crucible
          </span>
          <span style={{ fontSize: 9, color: '#2e3347', letterSpacing: 2 }}>
            RED-TEAM
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginLeft: 32 }}>
          <button className={`nav-tab${view === 'new' ? ' active' : ''}`} onClick={() => setView('new')}>
            New Scan
          </button>
          <button className={`nav-tab${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>
            History ({runs.length})
          </button>
        </div>

        {activeRun && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 10, color: '#4b5280',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: activeRun.status === 'running' ? '#6366f1' : '#10b981',
              boxShadow: `0 0 8px ${activeRun.status === 'running' ? '#6366f1' : '#10b981'}`,
              animation: activeRun.status === 'running' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span>{activeRun.target_model}</span>
            <span style={{ color: '#2e3347' }}>|</span>
            <span>
              ASR:{' '}
              <strong style={{
                color: activeRun.asr > 0.5 ? '#ef4444' : activeRun.asr > 0.25 ? '#f59e0b' : '#10b981',
              }}>
                {(activeRun.asr * 100).toFixed(1)}%
              </strong>
            </span>
          </div>
        )}
      </header>

      <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {view === 'new' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Left: form */}
            <RunForm
              onSubmit={cfg => createRun.mutate(cfg)}
              isLoading={createRun.isPending}
            />

            {/* Right: live stream + heatmap */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeRunId && (
                <>
                  <div className="panel">
                    <div className="panel-header">
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: activeRun?.status === 'running' ? '#6366f1' : '#10b981',
                        boxShadow: `0 0 8px ${activeRun?.status === 'running' ? '#6366f1' : '#10b981'}`,
                        animation: activeRun?.status === 'running' ? 'pulse 1.5s infinite' : 'none',
                      }} />
                      Live Attack Stream
                    </div>
                    <LiveStream
                      runId={activeRunId}
                      onComplete={() => refetchRuns()}
                    />
                  </div>

                  {report?.heatmap && report.heatmap.length > 0 && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div className="panel" style={{ flex: 1 }}>
                        <div className="panel-header">
                          Severity Heatmap
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {compareRunId && (
                              <button
                                onClick={() => setShowDiff(v => !v)}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: 5,
                                  border: `1px solid ${showDiff ? '#f59e0b66' : '#2e3347'}`,
                                  background: showDiff ? 'rgba(245,158,11,0.1)' : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 9,
                                  fontFamily: 'inherit',
                                  fontWeight: 600,
                                  letterSpacing: 1,
                                  color: showDiff ? '#f59e0b' : '#4b5280',
                                }}
                              >
                                ▲▼ DIFF {showDiff ? 'ON' : 'OFF'}
                              </button>
                            )}
                            {report.status === 'completed' && (
                              <button
                                onClick={() => downloadReport(report)}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: 5,
                                  border: '1px solid #1e2235',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 9,
                                  fontFamily: 'inherit',
                                  fontWeight: 600,
                                  letterSpacing: 1,
                                  color: '#4b5280',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => {
                                  (e.target as HTMLElement).style.color = '#a5b4fc'
                                  ;(e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)'
                                }}
                                onMouseLeave={e => {
                                  (e.target as HTMLElement).style.color = '#4b5280'
                                  ;(e.target as HTMLElement).style.borderColor = '#1e2235'
                                }}
                              >
                                ↓ REPORT
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ padding: 20 }}>
                          <HeatmapChart
                            cells={report.heatmap}
                            onCellClick={setSelectedCell}
                            selectedCell={selectedCell}
                            compareData={compareReport?.heatmap}
                            showDiff={showDiff}
                          />
                        </div>
                      </div>

                      {selectedCell && (
                        <DrillDownPanel
                          cell={selectedCell}
                          onClose={() => setSelectedCell(null)}
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              {!activeRunId && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 16,
                  padding: '80px 32px', borderRadius: 12,
                  border: '1px dashed #1e2235',
                  color: '#2e3347', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 40 }}>⚗</span>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                    Configure and launch a scan<br />to see live results here
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <div className="panel-header">Run History</div>
              <div style={{ padding: '12px 0' }}>
                <RunHistory
                  runs={runs}
                  onSelectRun={(run: Run) => {
                    setActiveRunId(run.id)
                    setView('new')
                  }}
                  compareRunId={compareRunId ?? undefined}
                  onCompare={(id: string) => setCompareRunId(prev => prev === id ? null : id)}
                />
              </div>
            </div>

            {compareRunId && compareReport?.heatmap && (
              <div className="panel">
                <div className="panel-header">
                  Baseline Heatmap
                  <span style={{ fontSize: 10, color: '#4b5280', fontWeight: 400, marginLeft: 8 }}>
                    {compareReport.target_model}
                  </span>
                </div>
                <div style={{ padding: 20 }}>
                  <HeatmapChart
                    cells={compareReport.heatmap}
                    onCellClick={setSelectedCell}
                    selectedCell={selectedCell}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  )
}
