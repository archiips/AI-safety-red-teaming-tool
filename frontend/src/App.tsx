import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { api } from './api/client'
import RunForm from './components/RunForm'
import LiveStream from './components/LiveStream'
import HeatmapChart from './components/HeatmapChart'
import DrillDownPanel from './components/DrillDownPanel'
import RunHistory from './components/RunHistory'
import type { RunConfig, Run, HeatmapCell, RunReport } from './types'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

import type { Variants } from 'framer-motion'

const viewVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

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
    <div style={{ minHeight: '100vh', background: '#181818', fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <style>{`
        .panel {
          background: #212121;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .panel-header {
          padding: 15px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          font-weight: 600;
          color: #E6E6E6;
          letter-spacing: 0.1px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-tab {
          padding: 6px 16px;
          border-radius: 7px;
          border: 1px solid transparent;
          background: none;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .nav-tab.active {
          background: rgba(192,57,43,0.1);
          border-color: rgba(192,57,43,0.22);
          color: #E6E6E6;
        }

        .nav-tab:hover:not(.active) {
          color: #C8C8C8;
          border-color: rgba(255,255,255,0.07);
        }

        .icon-btn {
          padding: 4px 11px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.07);
          background: transparent;
          cursor: pointer;
          font-size: 11px;
          font-family: 'Space Mono', monospace;
          color: #777;
          transition: color 0.15s, border-color 0.15s;
        }

        .icon-btn:hover {
          color: #E6E6E6;
          border-color: rgba(255,255,255,0.15);
        }
      `}</style>

      {/* Top accent stripe */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #C0392B 0%, #8B1A10 60%, transparent 100%)' }} />

      {/* Header */}
      <header style={{
        padding: '0 32px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: '#212121',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 2, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 28 }}>
          <div style={{
            width: 24, height: 24,
            background: '#C0392B',
            borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, lineHeight: 1,
          }}>⚗</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#E6E6E6', letterSpacing: -0.3 }}>
            Crucible
          </span>
          <span style={{
            fontSize: 8, color: '#444', letterSpacing: 2,
            fontFamily: "'Space Mono', monospace",
            marginLeft: 2,
          }}>
            RED·TEAM
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.07)', marginRight: 20 }} />

        {/* Nav */}
        <div style={{ display: 'flex', gap: 3 }}>
          <button className={`nav-tab${view === 'new' ? ' active' : ''}`} onClick={() => setView('new')}>
            New Scan
          </button>
          <button className={`nav-tab${view === 'history' ? ' active' : ''}`} onClick={() => setView('history')}>
            History
            {runs.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, color: '#555',
                background: 'rgba(255,255,255,0.06)',
                padding: '1px 6px', borderRadius: 10,
                fontFamily: "'Space Mono', monospace",
              }}>
                {runs.length}
              </span>
            )}
          </button>
        </div>

        {/* Active run indicator */}
        {activeRun && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 7,
            fontSize: 11,
            fontFamily: "'Space Mono', monospace",
            color: '#666',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: activeRun.status === 'running' ? '#A07820' : '#3D8B5E',
              animation: activeRun.status === 'running' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span style={{ color: '#999' }}>{activeRun.target_model}</span>
            <span style={{ color: '#3A3A3A' }}>·</span>
            <span>
              ASR{' '}
              <strong style={{
                color: activeRun.asr > 0.5 ? '#A83020' : activeRun.asr > 0.25 ? '#A07820' : '#3D8B5E',
              }}>
                {(activeRun.asr * 100).toFixed(1)}%
              </strong>
            </span>
          </div>
        )}
      </header>

      {/* Main */}
      <main style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          {view === 'new' && (
            <motion.div key="new" {...viewVariants}>
              <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
                <RunForm
                  onSubmit={cfg => createRun.mutate(cfg)}
                  isLoading={createRun.isPending}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {activeRunId ? (
                    <>
                      <motion.div
                        className="panel"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="panel-header">
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: activeRun?.status === 'running' ? '#A07820' : '#3D8B5E',
                            animation: activeRun?.status === 'running' ? 'pulse 1.5s infinite' : 'none',
                          }} />
                          Live Attack Stream
                        </div>
                        <LiveStream runId={activeRunId} onComplete={() => refetchRuns()} />
                      </motion.div>

                      {report?.heatmap && report.heatmap.length > 0 && (
                        <motion.div
                          style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <div className="panel" style={{ flex: 1 }}>
                            <div className="panel-header">
                              Severity Heatmap
                              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {compareRunId && (
                                  <button
                                    className="icon-btn"
                                    onClick={() => setShowDiff(v => !v)}
                                    style={showDiff ? {
                                      color: '#A07820',
                                      borderColor: 'rgba(160,120,32,0.35)',
                                      background: 'rgba(160,120,32,0.07)',
                                    } : {}}
                                  >
                                    ▲▼ DIFF {showDiff ? 'ON' : 'OFF'}
                                  </button>
                                )}
                                {report.status === 'completed' && (
                                  <button
                                    className="icon-btn"
                                    onClick={() => downloadReport(report)}
                                  >
                                    ↓ REPORT
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ padding: 24 }}>
                              <HeatmapChart
                                cells={report.heatmap}
                                onCellClick={setSelectedCell}
                                selectedCell={selectedCell}
                                compareData={compareReport?.heatmap}
                                showDiff={showDiff}
                              />
                            </div>
                          </div>

                          <AnimatePresence>
                            {selectedCell && (
                              <motion.div
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 12 }}
                                transition={{ duration: 0.2 }}
                              >
                                <DrillDownPanel
                                  cell={selectedCell}
                                  onClose={() => setSelectedCell(null)}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 14,
                        padding: '100px 40px',
                        border: '1px dashed rgba(255,255,255,0.07)',
                        borderRadius: 10,
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 32, filter: 'grayscale(1)', opacity: 0.25 }}>⚗</span>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: 14, color: '#555', fontWeight: 500 }}>
                          No active scan
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: '#3A3A3A', lineHeight: 1.7 }}>
                          Configure an attack on the left and launch a scan<br />to see live results here
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="history" {...viewVariants}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="panel">
                  <div className="panel-header">
                    Run History
                    <span style={{
                      marginLeft: 6, fontSize: 10, color: '#555',
                      fontFamily: "'Space Mono', monospace",
                      background: 'rgba(255,255,255,0.05)',
                      padding: '2px 7px', borderRadius: 10,
                    }}>
                      {runs.length} runs
                    </span>
                  </div>
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

                {compareRunId && compareReport?.heatmap && (
                  <motion.div
                    className="panel"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="panel-header">
                      Baseline Heatmap
                      <span style={{ fontSize: 11, color: '#666', fontWeight: 400, marginLeft: 6 }}>
                        {compareReport.target_model}
                      </span>
                    </div>
                    <div style={{ padding: 24 }}>
                      <HeatmapChart
                        cells={compareReport.heatmap}
                        onCellClick={setSelectedCell}
                        selectedCell={selectedCell}
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
