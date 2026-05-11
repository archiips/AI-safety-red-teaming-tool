import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HeatmapCell, Attack } from '../types'

interface DrillDownPanelProps {
  cell: HeatmapCell | null
  onClose: () => void
}

function severityColor(v: number) {
  return v <= 2 ? '#3D8B5E' : v <= 4 ? '#A07820' : '#A83020'
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const color = severityColor(value)
  const pct = (value / 7) * 100
  return (
    <div style={{
      flex: 1,
      background: '#282828',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 7, padding: '9px 10px',
    }}>
      <div style={{
        fontSize: 8, color: '#555', letterSpacing: 1, textTransform: 'uppercase',
        fontFamily: "'Space Mono', monospace", marginBottom: 5,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, color,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        fontFamily: "'Space Mono', monospace", marginBottom: 6,
      }}>
        {value.toFixed(1)}
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function AttackCard({ attack, index }: { attack: Attack; index: number }) {
  const [open, setOpen] = useState(false)
  const disagreement = Math.abs(attack.score.cpp_score - attack.score.llm_judge_score) > 2
  const color = severityColor(attack.score.composite)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, overflow: 'hidden', background: '#282828',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Satoshi', system-ui, sans-serif", textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{
          width: 2, flexShrink: 0, alignSelf: 'stretch',
          borderRadius: 2, background: color,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, color: '#C8C8C8',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {attack.prompt}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {disagreement && (
            <span title="Scorer disagreement" style={{ fontSize: 12, color: '#A07820' }}>⚠</span>
          )}
          <span style={{
            fontSize: 14, fontWeight: 700, color,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Space Mono', monospace",
            minWidth: 32, textAlign: 'right',
          }}>
            {attack.score.composite.toFixed(1)}
          </span>
          <span style={{ fontSize: 10, color: '#444' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 14px 14px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexDirection: 'column', gap: 11,
            }}>
              {/* Prompt / Response */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, paddingTop: 11 }}>
                {[
                  { label: 'Prompt', text: attack.prompt },
                  { label: 'Response', text: attack.response || '(no response)' },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <p style={{
                      fontSize: 8.5, color: '#555', letterSpacing: 1, textTransform: 'uppercase',
                      margin: '0 0 5px', fontFamily: "'Space Mono', monospace",
                    }}>
                      {label}
                    </p>
                    <p style={{
                      fontSize: 11, color: '#888', background: '#212121',
                      border: '1px solid rgba(255,255,255,0.05)', borderRadius: 5,
                      padding: '8px 10px', margin: 0, lineHeight: 1.65,
                      maxHeight: 108, overflow: 'auto',
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Score chips */}
              <div style={{ display: 'flex', gap: 6 }}>
                <ScoreChip label="C++" value={attack.score.cpp_score} />
                <ScoreChip label="Azure CS" value={attack.score.azure_cs_score} />
                <ScoreChip label="LLM Judge" value={attack.score.llm_judge_score} />
                <ScoreChip label="Composite" value={attack.score.composite} />
              </div>

              {/* Disagreement */}
              {disagreement && (
                <div style={{
                  background: 'rgba(160,120,32,0.06)',
                  border: '1px solid rgba(160,120,32,0.2)',
                  borderRadius: 6, padding: '7px 10px',
                  fontSize: 10, color: '#A07820',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                  <span>⚠</span>
                  <span>Scorer disagreement — C++ and LLM Judge differ by &gt;2 severity points.</span>
                </div>
              )}

              {/* Matched rules */}
              {attack.matched_rules.length > 0 && (
                <div>
                  <p style={{
                    fontSize: 8.5, color: '#555', letterSpacing: 1, textTransform: 'uppercase',
                    margin: '0 0 5px', fontFamily: "'Space Mono', monospace",
                  }}>
                    Matched Rules
                  </p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {attack.matched_rules.map(r => (
                      <span key={r} style={{
                        fontSize: 9, fontFamily: "'Space Mono', monospace",
                        color: '#C0392B', background: 'rgba(192,57,43,0.08)',
                        border: '1px solid rgba(192,57,43,0.2)',
                        borderRadius: 4, padding: '2px 6px',
                      }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Kappa values */}
              <div style={{
                display: 'flex', gap: 14, fontSize: 9.5, color: '#555',
                fontFamily: "'Space Mono', monospace",
                paddingTop: 2,
              }}>
                <span>κ(cpp,az) <strong style={{ color: '#777' }}>{attack.score.kappa_cpp_azure.toFixed(2)}</strong></span>
                <span>κ(cpp,j) <strong style={{ color: '#777' }}>{attack.score.kappa_cpp_judge.toFixed(2)}</strong></span>
                <span>κ(az,j) <strong style={{ color: '#777' }}>{attack.score.kappa_azure_judge.toFixed(2)}</strong></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function DrillDownPanel({ cell, onClose }: DrillDownPanelProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'disagree'>('all')

  if (!cell) return null

  const attacks = cell.attacks ?? []

  const filtered = attacks.filter((a: Attack) => {
    if (filter === 'high') return a.score.composite >= 4
    if (filter === 'disagree') return Math.abs(a.score.cpp_score - a.score.llm_judge_score) > 2
    return true
  })

  const highCount = attacks.filter((a: Attack) => a.score.composite >= 4).length
  const disagreeCount = attacks.filter((a: Attack) => Math.abs(a.score.cpp_score - a.score.llm_judge_score) > 2).length
  const asrColor = cell.asr <= 0.2 ? '#3D8B5E' : cell.asr <= 0.5 ? '#A07820' : '#A83020'

  const filters: { id: 'all' | 'high' | 'disagree'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: attacks.length },
    { id: 'high', label: 'High-Risk', count: highCount },
    { id: 'disagree', label: 'Disagree', count: disagreeCount },
  ]

  return (
    <div style={{
      width: 490,
      background: '#212121',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      display: 'flex', flexDirection: 'column',
      maxHeight: '80vh',
      fontFamily: "'Satoshi', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        {/* Left accent */}
        <div style={{
          width: 3, alignSelf: 'stretch', borderRadius: 2,
          background: `rgba(${cell.asr > 0.5 ? '168,48,32' : cell.asr > 0.2 ? '160,120,32' : '61,139,94'},0.7)`,
          flexShrink: 0,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 5px', fontWeight: 700, fontSize: 14, color: '#E6E6E6' }}>
            {cell.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            <span style={{ color: '#3A3A3A', fontWeight: 300, margin: '0 6px' }}>×</span>
            <span style={{ color: '#888', fontWeight: 500 }}>{cell.strategy}</span>
          </p>
          <div style={{
            display: 'flex', gap: 12, fontSize: 11, color: '#555',
            fontFamily: "'Space Mono', monospace",
          }}>
            <span>
              ASR <strong style={{ color: asrColor }}>{(cell.asr * 100).toFixed(1)}%</strong>
            </span>
            <span style={{ color: '#333' }}>·</span>
            <span>{cell.attack_count} attacks</span>
            <span style={{ color: '#333' }}>·</span>
            <span>{highCount} high-severity</span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6, width: 26, height: 26,
            cursor: 'pointer', color: '#555', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#E6E6E6'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
        >
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '9px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 4,
      }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '4px 11px',
              borderRadius: 6,
              border: `1px solid ${filter === f.id ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.06)'}`,
              background: filter === f.id ? 'rgba(192,57,43,0.09)' : 'none',
              cursor: 'pointer',
              fontFamily: "'Satoshi', system-ui, sans-serif",
              fontSize: 11, fontWeight: 500,
              color: filter === f.id ? '#D4D4D4' : '#555',
              transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {f.label}
            <span style={{
              fontSize: 9, color: filter === f.id ? '#888' : '#3A3A3A',
              fontFamily: "'Space Mono', monospace",
            }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Attack list */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '11px 18px',
        display: 'flex', flexDirection: 'column', gap: 6,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent',
      }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#444', fontSize: 12, marginTop: 28 }}>
            No attacks match this filter
          </p>
        ) : (
          filtered.map((a: Attack, i: number) => (
            <AttackCard key={a.id} attack={a} index={i} />
          ))
        )}
      </div>
    </div>
  )
}
