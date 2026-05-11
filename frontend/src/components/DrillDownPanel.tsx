import { useState } from 'react'
import type { HeatmapCell, Attack } from '../types'

interface DrillDownPanelProps {
  cell: HeatmapCell | null
  onClose: () => void
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const color = value <= 2 ? '#4A9060' : value <= 4 ? '#B8860B' : '#B03020'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 6, padding: '8px 10px', minWidth: 64,
    }}>
      <span style={{
        fontSize: 8, color: '#666', letterSpacing: 1, textTransform: 'uppercase',
        fontFamily: "'Space Mono', monospace",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 20, fontWeight: 700, color,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        fontFamily: "'Space Mono', monospace",
      }}>
        {value.toFixed(1)}
      </span>
      <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${(value / 7) * 100}%`,
          background: color, borderRadius: 2,
        }} />
      </div>
    </div>
  )
}

function AttackCard({ attack }: { attack: Attack }) {
  const [open, setOpen] = useState(false)
  const disagreement = Math.abs(attack.score.cpp_score - attack.score.llm_judge_score) > 2

  const compositeColor = attack.score.composite <= 2 ? '#4A9060'
    : attack.score.composite <= 4 ? '#B8860B' : '#B03020'

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 7,
      overflow: 'hidden',
      background: '#2A2A2A',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 13px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Satoshi', system-ui, sans-serif", textAlign: 'left',
        }}
      >
        <div style={{
          width: 3, flexShrink: 0, alignSelf: 'stretch',
          borderRadius: 2, background: compositeColor,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, color: '#D4D4D4',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {attack.prompt}
          </p>
        </div>
        {disagreement && (
          <span title="Scorer disagreement" style={{ fontSize: 13, flexShrink: 0, color: '#B8860B' }}>⚠</span>
        )}
        <span style={{
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          color: compositeColor,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 28, textAlign: 'right',
          fontFamily: "'Space Mono', monospace",
        }}>
          {attack.score.composite.toFixed(1)}
        </span>
        <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          padding: '0 13px 13px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 10 }}>
            {[
              { label: 'Prompt', text: attack.prompt },
              { label: 'Response', text: attack.response || '(no response)' },
            ].map(({ label, text }) => (
              <div key={label}>
                <p style={{
                  fontSize: 9, color: '#666', letterSpacing: 1,
                  textTransform: 'uppercase', margin: '0 0 5px',
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 11, color: '#999', background: '#232323',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5,
                  padding: '8px 10px', margin: 0, lineHeight: 1.6,
                  maxHeight: 110, overflow: 'auto',
                  scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <ScoreChip label="C++ Engine" value={attack.score.cpp_score} />
            <ScoreChip label="Azure CS" value={attack.score.azure_cs_score} />
            <ScoreChip label="LLM Judge" value={attack.score.llm_judge_score} />
            <ScoreChip label="Composite" value={attack.score.composite} />
          </div>

          {disagreement && (
            <div style={{
              background: 'rgba(184,134,11,0.06)',
              border: '1px solid rgba(184,134,11,0.2)',
              borderRadius: 5, padding: '7px 10px',
              fontSize: 10, color: '#B8860B',
            }}>
              ⚠ Scorer disagreement — C++ Engine and LLM Judge differ by more than 2 severity points. Review manually.
            </div>
          )}

          {attack.matched_rules.length > 0 && (
            <div>
              <p style={{
                fontSize: 9, color: '#666', letterSpacing: 1,
                textTransform: 'uppercase', margin: '0 0 5px',
                fontFamily: "'Space Mono', monospace",
              }}>
                Matched Rules
              </p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {attack.matched_rules.map(r => (
                  <span key={r} style={{
                    fontSize: 9, fontFamily: "'Space Mono', monospace",
                    color: '#C0392B', background: 'rgba(192,57,43,0.08)',
                    border: '1px solid rgba(192,57,43,0.25)',
                    borderRadius: 4, padding: '2px 6px',
                  }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 14, fontSize: 10, color: '#666',
            fontFamily: "'Space Mono', monospace",
          }}>
            <span>κ(cpp,azure): <strong style={{ color: '#999' }}>{attack.score.kappa_cpp_azure.toFixed(2)}</strong></span>
            <span>κ(cpp,judge): <strong style={{ color: '#999' }}>{attack.score.kappa_cpp_judge.toFixed(2)}</strong></span>
            <span>κ(azure,judge): <strong style={{ color: '#999' }}>{attack.score.kappa_azure_judge.toFixed(2)}</strong></span>
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
      width: 500,
      background: '#232323',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '80vh',
      fontFamily: "'Satoshi', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <style>{`
        .filter-tab {
          padding: 4px 12px;
          border-radius: 5px;
          border: 1px solid rgba(255,255,255,0.07);
          background: none;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: #666;
          transition: all 0.12s;
        }

        .filter-tab.active {
          background: rgba(192,57,43,0.1);
          border-color: rgba(192,57,43,0.3);
          color: #E8E8E8;
        }

        .filter-tab:hover:not(.active) {
          border-color: rgba(255,255,255,0.12);
          color: #D4D4D4;
        }
      `}</style>

      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{
            margin: '0 0 4px',
            fontFamily: "'Satoshi', system-ui, sans-serif",
            fontWeight: 700, fontSize: 14,
            color: '#E8E8E8',
          }}>
            {cell.category.replace('_', ' ').toUpperCase()}
            <span style={{ color: '#3A3A3A', fontWeight: 400 }}> × </span>
            {cell.strategy}
          </p>
          <div style={{
            display: 'flex', gap: 14, fontSize: 11, color: '#666',
            fontFamily: "'Space Mono', monospace",
          }}>
            <span>ASR <strong style={{ color: '#C0392B' }}>{(meanAsr * 100).toFixed(1)}%</strong></span>
            <span>{cell.attack_count} attacks</span>
            <span>{highCount} high-severity</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 5, width: 26, height: 26,
            cursor: 'pointer', color: '#666', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '9px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', gap: 5,
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
        flex: 1, overflow: 'auto', padding: '10px 18px',
        display: 'flex', flexDirection: 'column', gap: 6,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>
        {filtered.length === 0 ? (
          <p style={{
            textAlign: 'center', color: '#555',
            fontSize: 12, marginTop: 24,
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
