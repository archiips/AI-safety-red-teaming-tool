import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRunStream } from '../api/websocket'
import { api } from '../api/client'
import type { Attack, Run, StreamMessage } from '../types'

interface LiveStreamProps {
  runId: string
  onComplete?: (run: Run) => void
}

function severityColor(s: number): string {
  if (s <= 1) return '#3D8B5E'
  if (s <= 3) return '#4E7A62'
  if (s <= 4) return '#A07820'
  if (s <= 5) return '#B06820'
  return '#A83020'
}

function SeverityBar({ value }: { value: number }) {
  const pct = (value / 7) * 100
  const color = severityColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        height: 3, flex: 1, background: 'rgba(255,255,255,0.07)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 3 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color, minWidth: 20, textAlign: 'right',
        fontFamily: "'Space Mono', monospace",
      }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

const STRATEGY_COLORS: Record<string, string> = {
  easy: '#3D8B5E', moderate: '#A07820', difficult: '#A83020',
}

const CAT_COLORS: Record<string, string> = {
  violence: '#A83020', hate: '#A07820', sexual: '#884488',
  self_harm: '#A83020', cybercrime: '#2277AA', cyberwepons: '#2277AA',
  radicalization: '#A83020', bioweapons: '#557744', default: '#C0392B',
}

function AttackRow({ attack, idx }: { attack: Attack; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const score = attack.score.composite
  const disagreement = Math.abs(attack.score.cpp_score - attack.score.llm_judge_score) > 2
  const catColor = CAT_COLORS[attack.category] ?? CAT_COLORS.default
  const stratColor = STRATEGY_COLORS[attack.strategy?.toLowerCase()] ?? '#888'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        borderLeft: `2px solid ${severityColor(score)}`,
        marginBottom: 2,
        background: expanded ? 'rgba(255,255,255,0.018)' : 'transparent',
        transition: 'background 0.15s',
        borderRadius: '0 5px 5px 0',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 88px 78px 1fr 110px 18px',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '9px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
          fontFamily: "'Satoshi', system-ui, sans-serif",
        }}
      >
        <span style={{
          fontSize: 9.5, color: '#444',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'Space Mono', monospace",
        }}>
          {String(idx + 1).padStart(3, '0')}
        </span>

        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
          color: catColor, textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {attack.category.replace(/_/g, ' ')}
        </span>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 500, color: stratColor,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: stratColor, flexShrink: 0 }} />
          {attack.strategy}
        </span>

        <span style={{
          fontSize: 11.5, color: '#777',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1,
        }}>
          {attack.prompt}
        </span>

        <SeverityBar value={score} />

        <span style={{ color: '#444', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  { label: 'Prompt', text: attack.prompt },
                  { label: 'Response', text: attack.response || '—' },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <p style={{
                      fontSize: 8.5, color: '#555', letterSpacing: 1,
                      textTransform: 'uppercase', marginBottom: 5,
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {label}
                    </p>
                    <p style={{
                      fontSize: 11, color: '#888', background: '#181818',
                      border: '1px solid rgba(255,255,255,0.05)', borderRadius: 5,
                      padding: '7px 9px', margin: 0, lineHeight: 1.65,
                      maxHeight: 85, overflow: 'auto',
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[
                  { label: 'C++ Engine', val: attack.score.cpp_score },
                  { label: 'Azure CS', val: attack.score.azure_cs_score },
                  { label: 'LLM Judge', val: attack.score.llm_judge_score },
                ].map(({ label, val }) => (
                  <div key={label} style={{
                    background: '#181818', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 5, padding: '7px 9px',
                  }}>
                    <p style={{
                      fontSize: 8.5, color: '#555', letterSpacing: 1,
                      textTransform: 'uppercase', margin: '0 0 5px',
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {label}
                    </p>
                    <SeverityBar value={val} />
                  </div>
                ))}
              </div>

              {disagreement && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(160,120,32,0.06)',
                  border: '1px solid rgba(160,120,32,0.18)',
                  borderRadius: 5, padding: '6px 9px',
                }}>
                  <span style={{ fontSize: 12, color: '#A07820' }}>⚠</span>
                  <span style={{ fontSize: 10, color: '#A07820' }}>
                    Scorer disagreement: C++ and LLM Judge differ by &gt;2 points
                  </span>
                </div>
              )}

              {attack.matched_rules.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {attack.matched_rules.map(rule => (
                    <span key={rule} style={{
                      fontSize: 9, fontFamily: "'Space Mono', monospace",
                      color: '#C0392B', background: 'rgba(192,57,43,0.07)',
                      border: '1px solid rgba(192,57,43,0.18)',
                      borderRadius: 3, padding: '2px 6px',
                    }}>
                      {rule}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{
        fontSize: 8.5, color: '#555', letterSpacing: 1.2, textTransform: 'uppercase',
        fontFamily: "'Space Mono', monospace", marginBottom: 2,
      }}>
        {label}
      </div>
      <motion.div
        key={value}
        initial={{ opacity: 0.4, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{
          fontSize: 20, fontWeight: 700, lineHeight: 1,
          color: color ?? '#D4D4D4',
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {value}
      </motion.div>
    </div>
  )
}

export default function LiveStream({ runId, onComplete }: LiveStreamProps) {
  const [attacks, setAttacks] = useState<Attack[]>([])
  const [asr, setAsr] = useState(0)
  const [status, setStatus] = useState<'running' | 'completed' | 'error'>('running')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useRunStream(runId, (msg: StreamMessage) => {
    if (msg.type === 'attack_complete' && msg.attack) {
      setAttacks(prev => [...prev, msg.attack!])
      if (msg.asr !== undefined) setAsr(msg.asr)
    }
    if (msg.type === 'run_complete') {
      setStatus('completed')
      if (pollRef.current) clearInterval(pollRef.current)
    }
    if (msg.type === 'error') {
      setError(msg.error ?? 'Unknown error')
      setStatus('error')
    }
  })

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const run = await api.getRun(runId)
        if (run.status === 'completed' || run.status === 'failed') {
          setStatus(run.status === 'completed' ? 'completed' : 'error')
          setAsr(run.asr)
          if (run.status === 'completed' && onComplete) onComplete(run)
          clearInterval(pollRef.current!)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [runId, onComplete])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [attacks.length])

  const statusColor = status === 'running' ? '#A07820' : status === 'completed' ? '#3D8B5E' : '#A83020'
  const statusLabel = status === 'running' ? 'Scanning' : status === 'completed' ? 'Complete' : 'Error'
  const asrColor = asr > 0.5 ? '#A83020' : asr > 0.25 ? '#A07820' : asr > 0 ? '#3D8B5E' : '#555'

  return (
    <div style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#282828',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0,
          animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#D4D4D4' }}>
          {statusLabel}
        </span>
        <span style={{
          fontSize: 9.5, color: '#3A3A3A',
          fontFamily: "'Space Mono', monospace",
        }}>
          {runId.slice(0, 8)}…
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
          <StatBox label="Attacks" value={String(attacks.length)} />
          <StatBox
            label="ASR"
            value={`${(asr * 100).toFixed(1)}%`}
            color={asrColor}
          />
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 88px 78px 1fr 110px 18px',
        gap: 10,
        padding: '6px 14px',
        fontSize: 8.5, color: '#3A3A3A', letterSpacing: 1.3, textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#1E1E1E',
        fontFamily: "'Space Mono', monospace",
      }}>
        <span>#</span>
        <span>Category</span>
        <span>Strategy</span>
        <span>Prompt</span>
        <span>Severity</span>
        <span />
      </div>

      {/* Rows */}
      <div style={{
        maxHeight: 440, overflow: 'auto',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent',
      }}>
        {attacks.length === 0 ? (
          <div style={{
            padding: '44px 20px', textAlign: 'center',
            color: '#3A3A3A', fontSize: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 20, color: '#333' }}
            >
              ◌
            </motion.div>
            <span>Waiting for attacks…</span>
          </div>
        ) : (
          attacks.map((a, i) => <AttackRow key={a.id} attack={a} idx={i} />)
        )}
        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              padding: '9px 14px',
              background: 'rgba(168,48,32,0.07)',
              borderTop: '1px solid rgba(168,48,32,0.18)',
              fontSize: 11, color: '#A83020',
            }}
          >
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
