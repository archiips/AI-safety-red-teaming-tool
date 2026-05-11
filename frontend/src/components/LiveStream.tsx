import { useState, useEffect, useRef } from 'react'
import { useRunStream } from '../api/websocket'
import { api } from '../api/client'
import type { Attack, Run, StreamMessage } from '../types'

interface LiveStreamProps {
  runId: string
  onComplete?: (run: Run) => void
}

function severityColor(s: number): string {
  if (s <= 1) return '#4A9060'
  if (s <= 3) return '#5A8A6A'
  if (s <= 4) return '#B8860B'
  if (s <= 5) return '#C07010'
  return '#B03020'
}

function SeverityBar({ value }: { value: number }) {
  const pct = (value / 7) * 100
  const color = severityColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        height: 3, flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color, minWidth: 18, textAlign: 'right',
        fontFamily: "'Space Mono', monospace",
      }}>
        {value.toFixed(1)}
      </span>
    </div>
  )
}

function AttackRow({ attack, idx }: { attack: Attack; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const score = attack.score.composite
  const disagreement = Math.abs(attack.score.cpp_score - attack.score.llm_judge_score) > 2

  return (
    <div
      style={{
        borderLeft: `2px solid ${severityColor(score)}`,
        borderRadius: '0 5px 5px 0',
        marginBottom: 2,
        background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 90px 80px 1fr 120px 18px',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '8px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: "'Satoshi', system-ui, sans-serif",
        }}
      >
        <span style={{
          fontSize: 10, color: '#555', fontVariantNumeric: 'tabular-nums',
          fontFamily: "'Space Mono', monospace",
        }}>
          {String(idx + 1).padStart(3, '0')}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
          color: '#C0392B', textTransform: 'uppercase',
        }}>
          {attack.category.replace('_', ' ')}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: attack.strategy === 'easy' ? '#4A9060' : attack.strategy === 'moderate' ? '#B8860B' : '#B03020',
        }}>
          {attack.strategy}
        </span>
        <span style={{
          fontSize: 11, color: '#888', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {attack.prompt}
        </span>
        <SeverityBar value={score} />
        <span style={{ color: '#555', fontSize: 11 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={{
                fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 5,
                textTransform: 'uppercase', fontFamily: "'Space Mono', monospace",
              }}>
                Prompt
              </p>
              <p style={{
                fontSize: 11, color: '#999', background: '#1C1C1C',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5,
                padding: '7px 9px', margin: 0, lineHeight: 1.6,
                maxHeight: 90, overflow: 'auto',
                fontFamily: "'Space Mono', monospace",
              }}>
                {attack.prompt}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 5,
                textTransform: 'uppercase', fontFamily: "'Space Mono', monospace",
              }}>
                Response
              </p>
              <p style={{
                fontSize: 11, color: '#999', background: '#1C1C1C',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5,
                padding: '7px 9px', margin: 0, lineHeight: 1.6,
                maxHeight: 90, overflow: 'auto',
                fontFamily: "'Space Mono', monospace",
              }}>
                {attack.response || '—'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
            {[
              { label: 'C++ Engine', val: attack.score.cpp_score },
              { label: 'Azure CS', val: attack.score.azure_cs_score },
              { label: 'LLM Judge', val: attack.score.llm_judge_score },
            ].map(({ label, val }) => (
              <div key={label} style={{
                background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 5, padding: '7px 9px',
              }}>
                <p style={{
                  fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase',
                  margin: '0 0 4px', fontFamily: "'Space Mono', monospace",
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
              background: 'rgba(184,134,11,0.06)', border: '1px solid rgba(184,134,11,0.2)',
              borderRadius: 5, padding: '6px 9px',
            }}>
              <span style={{ fontSize: 12, color: '#B8860B' }}>⚠</span>
              <span style={{ fontSize: 10, color: '#B8860B' }}>
                Scorer disagreement: C++ and LLM Judge differ by &gt;2 points
              </span>
            </div>
          )}

          {attack.matched_rules.length > 0 && (
            <div>
              <p style={{
                fontSize: 9, color: '#666', letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 5,
                fontFamily: "'Space Mono', monospace",
              }}>
                Matched Rules
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {attack.matched_rules.map(rule => (
                  <span key={rule} style={{
                    fontSize: 9, fontFamily: "'Space Mono', monospace", color: '#C0392B',
                    background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
                    borderRadius: 3, padding: '2px 6px',
                  }}>
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
      } catch {
        // ignore poll errors
      }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [runId, onComplete])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [attacks.length])

  const statusColor = status === 'running' ? '#B8860B' : status === 'completed' ? '#4A9060' : '#B03020'

  return (
    <div style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#2A2A2A',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: statusColor,
          animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#E8E8E8' }}>
          {status === 'running' ? 'Scanning' : status === 'completed' ? 'Complete' : 'Error'}
        </span>
        <span style={{
          color: '#555', fontSize: 10,
          fontFamily: "'Space Mono', monospace",
        }}>
          run/{runId.slice(0, 8)}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <span style={{
              fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', display: 'block',
              fontFamily: "'Space Mono', monospace",
            }}>
              Attacks
            </span>
            <span style={{
              fontSize: 18, fontWeight: 700, color: '#D4D4D4', lineHeight: 1.2,
              fontFamily: "'Space Mono', monospace",
            }}>
              {attacks.length}
            </span>
          </div>
          <div>
            <span style={{
              fontSize: 9, color: '#666', letterSpacing: 1, textTransform: 'uppercase', display: 'block',
              fontFamily: "'Space Mono', monospace",
            }}>
              ASR
            </span>
            <span style={{
              fontSize: 18, fontWeight: 700, lineHeight: 1.2,
              color: asr > 0.5 ? '#B03020' : asr > 0.25 ? '#B8860B' : '#4A9060',
              fontFamily: "'Space Mono', monospace",
            }}>
              {(asr * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '24px 90px 80px 1fr 120px 18px',
        gap: 12,
        padding: '5px 14px',
        fontSize: 9,
        color: '#555',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#1C1C1C',
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
        maxHeight: 460, overflow: 'auto', background: '#232323',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>
        {attacks.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            color: '#555', fontSize: 12,
          }}>
            <div style={{
              fontSize: 22, marginBottom: 10, color: '#444',
              animation: 'spin 2s linear infinite',
              display: 'inline-block',
            }}>◌</div>
            <p style={{ margin: 0 }}>Waiting for attacks…</p>
          </div>
        ) : (
          attacks.map((a, i) => <AttackRow key={a.id} attack={a} idx={i} />)
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{
          padding: '9px 14px', background: 'rgba(176,48,32,0.07)',
          borderTop: '1px solid rgba(176,48,32,0.2)',
          fontSize: 11, color: '#B03020',
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
