import type { Run } from '../types'

interface RunHistoryProps {
  runs: Run[]
  onSelectRun: (run: Run) => void
  compareRunId?: string
  onCompare?: (runId: string) => void
}

function statusBadge(status: Run['status']) {
  const map = {
    pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'PENDING'   },
    running:   { color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'RUNNING'   },
    completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'DONE'      },
    failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'FAILED'    },
  }
  const { color, bg, label } = map[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
      color, background: bg, border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 7px',
    }}>
      {label}
    </span>
  )
}

function asrColor(asr: number) {
  if (asr <= 0.2) return '#10b981'
  if (asr <= 0.5) return '#f59e0b'
  return '#ef4444'
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
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <p style={{ color: '#2e3347', fontSize: 12, margin: 0 }}>
          No runs yet. Launch a scan to get started.
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@700;800&display=swap');

        .run-row {
          display: grid;
          grid-template-columns: 100px 1fr 80px 70px 80px 100px;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          border: 1px solid transparent;
        }

        .run-row:hover {
          background: rgba(99,102,241,0.04);
          border-color: #1e2235;
        }

        .run-row.compare-active {
          background: rgba(245,158,11,0.05);
          border-color: rgba(245,158,11,0.2);
        }

        .compare-btn {
          font-size: 9px;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          border: 1px solid #1e2235;
          background: none;
          color: #4b5280;
          transition: all 0.15s;
        }

        .compare-btn:hover {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .compare-btn.active {
          border-color: #f59e0b;
          background: rgba(245,158,11,0.1);
          color: #f59e0b;
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 80px 70px 80px 100px',
        gap: 16,
        padding: '8px 16px',
        fontSize: 9,
        color: '#2e3347',
        letterSpacing: 2,
        textTransform: 'uppercase',
        borderBottom: '1px solid #1e2235',
        marginBottom: 6,
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
          <span style={{ fontSize: 10, color: '#4b5280' }}>
            {formatDate(run.created_at)}
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#c9ccd6', fontWeight: 600 }}>
              {run.target_model}
            </p>
            <p style={{ margin: 0, fontSize: 9, color: '#3d4260' }}>
              {run.categories?.slice(0, 3).join(', ')}
              {(run.categories?.length ?? 0) > 3 ? ` +${run.categories.length - 3}` : ''}
            </p>
          </div>
          <div>{statusBadge(run.status)}</div>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: run.status === 'completed' ? asrColor(run.asr) : '#2e3347',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {run.status === 'completed' ? `${(run.asr * 100).toFixed(1)}%` : '—'}
          </span>
          <span style={{ fontSize: 10, color: '#4b5280' }}>
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
