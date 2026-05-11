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
      background: '#1C1C1C',
      fontFamily: "'Satoshi', system-ui, sans-serif",
    }}>
      <style>{`
        * { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .nav-tab {
          padding: 6px 16px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: none;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.5px;
          color: #888;
          transition: all 0.15s;
        }

        .nav-tab.active {
          background: rgba(192,57,43,0.1);
          border-color: rgba(192,57,43,0.25);
          color: #E8E8E8;
        }

        .nav-tab:hover:not(.active) {
          color: #D4D4D4;
          border-color: rgba(255,255,255,0.07);
        }

        .panel {
          background: #232323;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          padding: 14px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #E8E8E8;
          letter-spacing: 0.1px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Top nav */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: '#232323',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, background: '#C0392B',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            ⚗
          </div>
          <span style={{
            fontFamily: "'Satoshi', system-ui, sans-serif", fontWeight: 700,
            fontSize: 16, color: '#E8E8E8', letterSpacing: -0.3,
          }}>
            Crucible
          </span>
          <span style={{
            fontSize: 9, color: '#555', letterSpacing: 2,
            fontFamily: "'Space Mono', monospace",
          }}>
            RED-TEAM
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
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
            fontSize: 11, color: '#888',
            fontFamily: "'Space Mono', monospace",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: activeRun.status === 'running' ? '#B8860B' : '#4A9060',
              animation: activeRun.status === 'running' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span>{activeRun.target_model}</span>
            <span style={{ color: '#3A3A3A' }}>|</span>
            <span>
              ASR:{' '}
              <strong style={{
                color: activeRun.asr > 0.5 ? '#B03020' : activeRun.asr > 0.25 ? '#B8860B' : '#4A9060',
              }}>
                {(activeRun.asr * 100).toFixed(1)}%
              </strong>
            </span>
          </div>
        )}
      </header>

      <main style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
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
                        width: 7, height: 7, borderRadius: '50%',
                        background: activeRun?.status === 'running' ? '#B8860B' : '#4A9060',
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
                                  border: `1px solid ${showDiff ? 'rgba(184,134,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                  background: showDiff ? 'rgba(184,134,11,0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 10,
                                  fontFamily: "'Space Mono', monospace",
                                  color: showDiff ? '#B8860B' : '#888',
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
                                  border: '1px solid rgba(255,255,255,0.07)',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 10,
                                  fontFamily: "'Space Mono', monospace",
                                  color: '#888',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => {
                                  (e.target as HTMLElement).style.color = '#E8E8E8'
                                  ;(e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'
                                }}
                                onMouseLeave={e => {
                                  (e.target as HTMLElement).style.color = '#888'
                                  ;(e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'
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
                  padding: '80px 32px', borderRadius: 8,
                  border: '1px dashed rgba(255,255,255,0.08)',
                  color: '#555', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 36 }}>⚗</span>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: '#666' }}>
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
                  <span style={{ fontSize: 11, color: '#888', fontWeight: 400, marginLeft: 8 }}>
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
