import type { Run } from '../types'

interface RunHistoryProps {
  runs: Run[]
  onSelectRun: (run: Run) => void
  compareRunId?: string
  onCompare?: (runId: string) => void
}

function statusBadge(status: Run['status']) {
  const map = {
    pending:   { color: '#B8860B', bg: 'rgba(184,134,11,0.1)',  label: 'PENDING'   },
    running:   { color: '#B8860B', bg: 'rgba(184,134,11,0.1)',  label: 'RUNNING'   },
    completed: { color: '#4A9060', bg: 'rgba(74,144,96,0.1)',   label: 'DONE'      },
    failed:    { color: '#B03020', bg: 'rgba(176,48,32,0.1)',   label: 'FAILED'    },
  }
  const { color, bg, label } = map[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
      color, background: bg, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 7px',
      fontFamily: "'Space Mono', monospace",
    }}>
      {label}
    </span>
  )
}

function asrColor(asr: number) {
  if (asr <= 0.2) return '#4A9060'
  if (asr <= 0.5) return '#B8860B'
  return '#B03020'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function duration(run: Run): string {
  if (!run.completed_at) return '—'
  const ms = new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function RunHistory({ runs, onSelectRun, compareRunId, onCompare }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div style={{
        padding: '48px 24px', textAlign: 'center',
        fontFamily: "'Satoshi', system-ui, sans-serif",
      }}>
        <p style={{ color: '#555', fontSize: 13, margin: 0 }}>
          No runs yet. Launch a scan to get started.
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <style>{`
        .run-row {
          display: grid;
          grid-template-columns: 100px 1fr 80px 70px 80px 100px;
          align-items: center;
          gap: 16px;
          padding: 11px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s;
          border: 1px solid transparent;
        }

        .run-row:hover {
          background: rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.07);
        }

        .run-row.compare-active {
          background: rgba(184,134,11,0.05);
          border-color: rgba(184,134,11,0.18);
        }

        .compare-btn {
          font-size: 9px;
          font-weight: 600;
          font-family: 'Space Mono', monospace;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.07);
          background: none;
          color: #666;
          transition: all 0.12s;
        }

        .compare-btn:hover {
          border-color: rgba(184,134,11,0.4);
          color: #B8860B;
        }

        .compare-btn.active {
          border-color: rgba(184,134,11,0.4);
          background: rgba(184,134,11,0.08);
          color: #B8860B;
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 80px 70px 80px 100px',
        gap: 16,
        padding: '7px 16px',
        fontSize: 9,
        color: '#555',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 4,
        fontFamily: "'Space Mono', monospace",
      }}>
        <span>Date</span>
        <span>Target Model</span>
        <span>Status</span>
        <span>ASR</span>
        <span>Duration</span>
        <span>Compare</span>
      </div>

      {runs.map(run => (
        <div
          key={run.id}
          className={`run-row${compareRunId === run.id ? ' compare-active' : ''}`}
          onClick={() => onSelectRun(run)}
        >
          <span style={{
            fontSize: 11, color: '#666',
            fontFamily: "'Space Mono', monospace",
          }}>
            {formatDate(run.created_at)}
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: '#D4D4D4', fontWeight: 500 }}>
              {run.target_model}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: '#666' }}>
              {run.categories?.slice(0, 3).join(', ')}
              {(run.categories?.length ?? 0) > 3 ? ` +${run.categories.length - 3}` : ''}
            </p>
          </div>
          <div>{statusBadge(run.status)}</div>
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: run.status === 'completed' ? asrColor(run.asr) : '#444',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Space Mono', monospace",
          }}>
            {run.status === 'completed' ? `${(run.asr * 100).toFixed(1)}%` : '—'}
          </span>
          <span style={{
            fontSize: 11, color: '#666',
            fontFamily: "'Space Mono', monospace",
          }}>
            {duration(run)}
          </span>
          <button
            className={`compare-btn${compareRunId === run.id ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onCompare?.(run.id) }}
            disabled={run.status !== 'completed'}
          >
            {compareRunId === run.id ? '✓ Base' : 'Set Base'}
          </button>
        </div>
      ))}
    </div>
  )
}
