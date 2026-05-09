import { useState, useEffect, useRef } from 'react'
import { useRunStream } from '../api/websocket'
import { api } from '../api/client'
import type { Attack, Run, StreamMessage } from '../types'

interface LiveStreamProps {
  runId: string
  onComplete?: (run: Run) => void
}

function severityColor(s: number): string {
  if (s <= 1) return '#10b981'
  if (s <= 3) return '#34d399'
  if (s <= 4) return '#f59e0b'
  if (s <= 5) return '#fb923c'
  return '#ef4444'
}

function severityBg(s: number): string {
  if (s <= 1) return 'rgba(16,185,129,0.06)'
  if (s <= 3) return 'rgba(52,211,153,0.06)'
  if (s <= 4) return 'rgba(245,158,11,0.07)'
  if (s <= 5) return 'rgba(251,146,60,0.07)'
  return 'rgba(239,68,68,0.08)'
}

function SeverityBar({ value }: { value: number }) {
  const pct = (value / 7) * 100
  const color = severityColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        height: 4, flex: 1, background: '#1e2235', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width 0.4s ease',
          boxShadow: `0 0 8px ${color}`,
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 18, textAlign: 'right' }}>
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
        background: expanded ? severityBg(score) : 'transparent',
        borderLeft: `3px solid ${severityColor(score)}`,
        borderRadius: '0 6px 6px 0',
        marginBottom: 3,
        transition: 'background 0.2s',
        animation: 'rowSlide 0.3s ease forwards',
        animationDelay: `${Math.min(idx * 0.05, 0.5)}s`,
        opacity: 0,
      }}
    >
      <style>{`
        @keyframes rowSlide {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 90px 80px 1fr 120px 20px',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '9px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 10, color: '#3d4260', fontVariantNumeric: 'tabular-nums' }}>
          {String(idx + 1).padStart(3, '0')}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 1,
          color: '#6366f1', textTransform: 'uppercase',
        }}>
          {attack.category.replace('_', ' ')}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 500,
          color: attack.strategy === 'Easy' ? '#10b981' : attack.strategy === 'Moderate' ? '#f59e0b' : '#ef4444',
        }}>
          {attack.strategy}
        </span>
        <span style={{
          fontSize: 11, color: '#6b7280', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {attack.prompt}
        </span>
        <SeverityBar value={score} />
        <span style={{ color: '#3d4260', fontSize: 12 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: '#3d4260', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                Prompt
              </p>
              <p style={{
                fontSize: 11, color: '#9ca3af', background: '#0f1117',
                border: '1px solid #1e2235', borderRadius: 6, padding: '8px 10px',
                margin: 0, lineHeight: 1.6, maxHeight: 100, overflow: 'auto',
              }}>
                {attack.prompt}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#3d4260', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
                Response
              </p>
              <p style={{
                fontSize: 11, color: '#9ca3af', background: '#0f1117',
                border: '1px solid #1e2235', borderRadius: 6, padding: '8px 10px',
                margin: 0, lineHeight: 1.6, maxHeight: 100, overflow: 'auto',
              }}>
                {attack.response || '—'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'C++ Engine', val: attack.score.cpp_score },
              { label: 'Azure CS', val: attack.score.azure_cs_score },
              { label: 'LLM Judge', val: attack.score.llm_judge_score },
            ].map(({ label, val }) => (
              <div key={label} style={{
                background: '#0f1117', border: '1px solid #1e2235',
                borderRadius: 6, padding: '8px 10px',
              }}>
                <p style={{ fontSize: 9, color: '#3d4260', letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 4px' }}>
                  {label}
                </p>
                <SeverityBar value={val} />
              </div>
            ))}
          </div>

          {disagreement && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 6, padding: '7px 10px',
            }}>
              <span style={{ fontSize: 13 }}>⚠</span>
              <span style={{ fontSize: 10, color: '#f59e0b', letterSpacing: 0.5 }}>
                Scorer disagreement: C++ and LLM Judge differ by &gt;2 points
              </span>
            </div>
          )}

          {attack.matched_rules.length > 0 && (
            <div>
              <p style={{ fontSize: 9, color: '#3d4260', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Matched Rules
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {attack.matched_rules.map(rule => (
                  <span key={rule} style={{
                    fontSize: 9, fontFamily: 'monospace', color: '#6366f1',
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 4, padding: '2px 6px',
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

  // Polling fallback in case WS isn't connected yet
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

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 20px', borderBottom: '1px solid #1e2235',
        background: '#0f1117',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status === 'running' ? '#10b981' : status === 'completed' ? '#6366f1' : '#ef4444',
          boxShadow: `0 0 10px ${status === 'running' ? '#10b981' : status === 'completed' ? '#6366f1' : '#ef4444'}`,
          animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#f1f3f9' }}>
          {status === 'running' ? 'SCANNING' : status === 'completed' ? 'COMPLETE' : 'ERROR'}
        </span>
        <span style={{ color: '#2e3347', fontSize: 10 }}>run/{runId.slice(0, 8)}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <span style={{ fontSize: 9, color: '#3d4260', letterSpacing: 1, textTransform: 'uppercase' }}>
              Attacks
            </span>
            <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: '#e2e4f0', lineHeight: 1.2 }}>
              {attacks.length}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 9, color: '#3d4260', letterSpacing: 1, textTransform: 'uppercase' }}>
              ASR
            </span>
            <span style={{
              display: 'block', fontSize: 18, fontWeight: 700, lineHeight: 1.2,
              color: asr > 0.5 ? '#ef4444' : asr > 0.25 ? '#f59e0b' : '#10b981',
            }}>
              {(asr * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '24px 90px 80px 1fr 120px 20px',
        gap: 12,
        padding: '6px 14px',
        fontSize: 9,
        color: '#2e3347',
        letterSpacing: 2,
        textTransform: 'uppercase',
        borderBottom: '1px solid #1e2235',
        background: '#0a0c12',
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
        maxHeight: 480, overflow: 'auto', background: '#0f1117',
        scrollbarWidth: 'thin', scrollbarColor: '#1e2235 transparent',
      }}>
        {attacks.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            color: '#2e3347', fontSize: 12,
          }}>
            <div style={{
              fontSize: 24, marginBottom: 8,
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
          padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
          borderTop: '1px solid rgba(239,68,68,0.2)',
          fontSize: 11, color: '#ef4444',
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
