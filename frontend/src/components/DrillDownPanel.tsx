import { useState } from 'react'
import type { HeatmapCell, Attack } from '../types'

interface DrillDownPanelProps {
  cell: HeatmapCell | null
  onClose: () => void
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const color = value <= 2 ? '#10b981' : value <= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, background: '#0f1117', border: '1px solid #1e2235',
      borderRadius: 7, padding: '8px 10px', minWidth: 64,
    }}>
      <span style={{ fontSize: 8, color: '#3d4260', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontSize: 20, fontWeight: 700, color,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {value.toFixed(1)}
      </span>
      <div style={{ width: '100%', height: 3, background: '#1e2235', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${(value / 7) * 100}%`,
          background: color, borderRadius: 2,
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
    </div>
  )
}

function AttackCard({ attack }: { attack: Attack }) {
  const [open, setOpen] = useState(false)
  const disagreement = Math.abs(attack.score.cpp_score - attack.score.llm_judge_score) > 2

  return (
    <div style={{
      border: '1px solid #1e2235',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#0f1117',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 6, flexShrink: 0, alignSelf: 'stretch',
          borderRadius: 3,
          background: attack.score.composite <= 2 ? '#10b981'
            : attack.score.composite <= 4 ? '#f59e0b' : '#ef4444',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 11, color: '#c9ccd6',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {attack.prompt}
          </p>
        </div>
        {disagreement && (
          <span title="Scorer disagreement" style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
        )}
        <span style={{
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          color: attack.score.composite <= 2 ? '#10b981'
            : attack.score.composite <= 4 ? '#f59e0b' : '#ef4444',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 28, textAlign: 'right',
        }}>
          {attack.score.composite.toFixed(1)}
        </span>
        <span style={{ fontSize: 11, color: '#2e3347', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          padding: '0 14px 14px',
          borderTop: '1px solid #1e2235',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12 }}>
            {[
              { label: 'Prompt', text: attack.prompt },
              { label: 'Response', text: attack.response || '(no response)' },
            ].map(({ label, text }) => (
              <div key={label}>
                <p style={{
                  fontSize: 9, color: '#3d4260', letterSpacing: 1,
                  textTransform: 'uppercase', margin: '0 0 6px',
                }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 11, color: '#9ca3af', background: '#131620',
                  border: '1px solid #1e2235', borderRadius: 6,
                  padding: '8px 10px', margin: 0, lineHeight: 1.6,
                  maxHeight: 120, overflow: 'auto',
                  scrollbarWidth: 'thin', scrollbarColor: '#1e2235 transparent',
                }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ScoreChip label="C++ Engine" value={attack.score.cpp_score} />
            <ScoreChip label="Azure CS" value={attack.score.azure_cs_score} />
            <ScoreChip label="LLM Judge" value={attack.score.llm_judge_score} />
            <ScoreChip label="Composite" value={attack.score.composite} />
          </div>

          {disagreement && (
            <div style={{
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 6, padding: '8px 10px',
              fontSize: 10, color: '#f59e0b',
            }}>
              ⚠ Scorer disagreement — C++ Engine and LLM Judge differ by more than 2 severity points.
              Review manually.
            </div>
          )}

          {attack.matched_rules.length > 0 && (
            <div>
              <p style={{
                fontSize: 9, color: '#3d4260', letterSpacing: 1,
                textTransform: 'uppercase', margin: '0 0 6px',
              }}>
                Matched Rules
              </p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {attack.matched_rules.map(r => (
                  <span key={r} style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: '#6366f1', background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 4, padding: '2px 7px',
                  }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#3d4260' }}>
            <span>κ(cpp,azure): <strong style={{ color: '#6b7280' }}>{attack.score.kappa_cpp_azure.toFixed(2)}</strong></span>
            <span>κ(cpp,judge): <strong style={{ color: '#6b7280' }}>{attack.score.kappa_cpp_judge.toFixed(2)}</strong></span>
            <span>κ(azure,judge): <strong style={{ color: '#6b7280' }}>{attack.score.kappa_azure_judge.toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DrillDownPanel({ cell, onClose }: DrillDownPanelProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'disagree'>('all')

  if (!cell) return null

  const filtered = cell.attacks.filter((a: Attack) => {
    if (filter === 'high') return a.score.composite >= 4
    if (filter === 'disagree') return Math.abs(a.score.cpp_score - a.score.llm_judge_score) > 2
    return true
  })

  const meanAsr = cell.asr
  const highCount = cell.attacks.filter((a: Attack) => a.score.composite >= 4).length

  return (
    <div style={{
      width: 520,
      background: '#131620',
      border: '1px solid #1e2235',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '80vh',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@700;800&display=swap');

        .filter-tab {
          padding: 5px 12px;
          border-radius: 5px;
          border: 1px solid #1e2235;
          background: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4b5280;
          transition: all 0.15s;
        }

        .filter-tab.active {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
          color: #a5b4fc;
        }

        .filter-tab:hover:not(.active) {
          border-color: #2e3347;
          color: #6b7280;
        }
      `}</style>

      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #1e2235',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: '0 0 2px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800, fontSize: 15,
            color: '#f1f3f9',
          }}>
            {cell.category.replace('_', ' ').toUpperCase()}
            <span style={{ color: '#2e3347' }}> × </span>
            {cell.strategy}
          </p>
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#4b5280' }}>
            <span>ASR <strong style={{ color: '#6366f1' }}>{(meanAsr * 100).toFixed(1)}%</strong></span>
            <span>{cell.attack_count} attacks</span>
            <span>{highCount} high-severity</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #1e2235',
            borderRadius: 6, width: 28, height: 28,
            cursor: 'pointer', color: '#4b5280', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid #1e2235',
        display: 'flex', gap: 6,
      }}>
        {(['all', 'high', 'disagree'] as const).map(f => (
          <button
            key={f}
            className={`filter-tab${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `All (${cell.attacks.length})`
              : f === 'high' ? `High-Risk (${highCount})`
              : `Disagree (${cell.attacks.filter((a: Attack) => Math.abs(a.score.cpp_score - a.score.llm_judge_score) > 2).length})`
            }
          </button>
        ))}
      </div>

      {/* Attack list */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '12px 18px',
        display: 'flex', flexDirection: 'column', gap: 8,
        scrollbarWidth: 'thin', scrollbarColor: '#1e2235 transparent',
      }}>
        {filtered.length === 0 ? (
          <p style={{
            textAlign: 'center', color: '#2e3347',
            fontSize: 11, marginTop: 24,
          }}>
            No attacks match this filter
          </p>
        ) : (
          filtered.map((a: Attack) => <AttackCard key={a.id} attack={a} />)
        )}
      </div>
    </div>
  )
}
