import { motion } from 'framer-motion'
import type { Run } from '../types'

interface RunHistoryProps {
  runs: Run[]
  onSelectRun: (run: Run) => void
  compareRunId?: string
  onCompare?: (runId: string) => void
}

const STATUS_MAP = {
  pending:   { color: '#A07820', bg: 'rgba(160,120,32,0.1)',  dot: '#A07820', label: 'PENDING'   },
  running:   { color: '#A07820', bg: 'rgba(160,120,32,0.1)',  dot: '#A07820', label: 'RUNNING'   },
  completed: { color: '#3D8B5E', bg: 'rgba(61,139,94,0.1)',   dot: '#3D8B5E', label: 'DONE'      },
  failed:    { color: '#A83020', bg: 'rgba(168,48,32,0.1)',   dot: '#A83020', label: 'FAILED'    },
}

function StatusBadge({ status }: { status: Run['status'] }) {
  const s = STATUS_MAP[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
      color: s.color, background: s.bg,
      border: `1px solid ${s.color}30`,
      borderRadius: 5, padding: '3px 8px',
      fontFamily: "'Space Mono', monospace",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0,
        animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
      }} />
      {s.label}
    </span>
  )
}

function asrColor(asr: number) {
  if (asr <= 0.2) return '#3D8B5E'
  if (asr <= 0.5) return '#A07820'
  return '#A83020'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function duration(run: Run): string {
  if (!run.completed_at) return '—'
  const ms = new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function RunHistory({ runs, onSelectRun, compareRunId, onCompare }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div style={{ padding: '56px 24px', textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 13, margin: 0 }}>
          No runs yet — launch a scan to get started.
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

        .run-row {
          display: grid;
          grid-template-columns: 110px 1fr 90px 80px 70px 90px;
          align-items: center;
          gap: 12px;
          padding: 12px 22px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.12s;
        }

        .run-row:last-child { border-bottom: none; }

        .run-row:hover {
          background: rgba(255,255,255,0.02);
        }

        .run-row.compare-active {
          background: rgba(160,120,32,0.04);
          border-left: 2px solid rgba(160,120,32,0.35);
          padding-left: 20px;
        }

        .compare-btn {
          font-size: 9px;
          font-weight: 600;
          font-family: 'Space Mono', monospace;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.07);
          background: none;
          color: #555;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .compare-btn:not(:disabled):hover {
          border-color: rgba(160,120,32,0.4);
          color: #A07820;
        }

        .compare-btn.active {
          border-color: rgba(160,120,32,0.4);
          background: rgba(160,120,32,0.08);
          color: #A07820;
        }

        .compare-btn:disabled {
          opacity: 0.35;
          cursor: default;
        }
      `}</style>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 90px 80px 70px 90px',
        gap: 12,
        padding: '8px 22px 8px',
        fontSize: 9, color: '#444', letterSpacing: 1.5,
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'Space Mono', monospace",
      }}>
        <span>Date</span>
        <span>Model</span>
        <span>Status</span>
        <span>ASR</span>
        <span>Time</span>
        <span>Baseline</span>
      </div>

      {runs.map((run, i) => (
        <motion.div
          key={run.id}
          className={`run-row${compareRunId === run.id ? ' compare-active' : ''}`}
          onClick={() => onSelectRun(run)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.4) }}
        >
          {/* Date */}
          <span style={{
            fontSize: 11, color: '#555',
            fontFamily: "'Space Mono', monospace",
            whiteSpace: 'nowrap',
          }}>
            {formatDate(run.created_at)}
          </span>

          {/* Model */}
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 13, color: '#D4D4D4',
              fontWeight: 500, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {run.target_model}
            </p>
            <p style={{
              margin: 0, fontSize: 10, color: '#555',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {run.categories?.slice(0, 3).join(', ')}
              {(run.categories?.length ?? 0) > 3 ? ` +${run.categories.length - 3}` : ''}
            </p>
          </div>

          {/* Status */}
          <div><StatusBadge status={run.status} /></div>

          {/* ASR */}
          <div>
            {run.status === 'completed' ? (
              <div>
                <span style={{
                  fontSize: 16, fontWeight: 700,
                  color: asrColor(run.asr),
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: "'Space Mono', monospace",
                  display: 'block', lineHeight: 1.2,
                }}>
                  {(run.asr * 100).toFixed(1)}%
                </span>
                <div style={{
                  marginTop: 3, height: 2, borderRadius: 2,
                  background: 'rgba(255,255,255,0.07)', overflow: 'hidden',
                  width: 48,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${run.asr * 100}%`,
                    background: asrColor(run.asr),
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ) : (
              <span style={{ color: '#3A3A3A', fontSize: 13, fontFamily: "'Space Mono', monospace" }}>—</span>
            )}
          </div>

          {/* Duration */}
          <span style={{
            fontSize: 11, color: '#555',
            fontFamily: "'Space Mono', monospace",
          }}>
            {duration(run)}
          </span>

          {/* Compare */}
          <button
            className={`compare-btn${compareRunId === run.id ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onCompare?.(run.id) }}
            disabled={run.status !== 'completed'}
          >
            {compareRunId === run.id ? '✓ Set' : 'Set Base'}
          </button>
        </motion.div>
      ))}
    </div>
  )
}
