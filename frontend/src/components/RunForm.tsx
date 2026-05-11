import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RunConfig, HarmCategory, AttackStrategy } from '../types'

interface RunFormProps {
  onSubmit: (config: RunConfig) => void
  isLoading: boolean
}

const ALL_CATEGORIES: { id: HarmCategory; label: string }[] = [
  { id: 'violence',       label: 'Violence'    },
  { id: 'hate',           label: 'Hate'        },
  { id: 'sexual',         label: 'Sexual'      },
  { id: 'self_harm',      label: 'Self-Harm'   },
  { id: 'deception',      label: 'Deception'   },
  { id: 'manipulation',   label: 'Manipulation'},
  { id: 'radicalization', label: 'Radical.'    },
  { id: 'privacy',        label: 'Privacy'     },
  { id: 'cyberweapons',   label: 'Cyber'       },
  { id: 'bioweapons',     label: 'Bio'         },
]

const STRATEGIES: { id: AttackStrategy; label: string; desc: string; color: string; bg: string }[] = [
  { id: 'easy',      label: 'Easy',      desc: 'Direct prompts',     color: '#3D8B5E', bg: 'rgba(61,139,94,0.09)'  },
  { id: 'moderate',  label: 'Moderate',  desc: 'Roleplay & framing', color: '#A07820', bg: 'rgba(160,120,32,0.09)' },
  { id: 'difficult', label: 'Difficult', desc: 'Jailbreaks & DAN',   color: '#A83020', bg: 'rgba(168,48,32,0.09)'  },
]

const TARGET_MODELS = [
  'ollama/phi4-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'azure/phi-4-mini-instruct',
]

function SectionLabel({ children, count }: { children: React.ReactNode; count?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
        color: '#666', fontFamily: "'Space Mono', monospace",
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <span style={{
          display: 'inline-block', width: 3, height: 11, borderRadius: 2,
          background: 'rgba(192,57,43,0.5)', flexShrink: 0,
        }} />
        {children}
      </span>
      {count && (
        <span style={{
          fontSize: 9, color: '#555', fontFamily: "'Space Mono', monospace",
        }}>{count}</span>
      )}
    </div>
  )
}

export default function RunForm({ onSubmit, isLoading }: RunFormProps) {
  const [targetModel, setTargetModel] = useState('')
  const [categories, setCategories] = useState<Set<HarmCategory>>(new Set())
  const [strategies, setStrategies] = useState<Set<AttackStrategy>>(new Set(['easy']))
  const [numObjectives, setNumObjectives] = useState(5)
  const [seed, setSeed] = useState(42)

  function toggleCategory(cat: HarmCategory) {
    setCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleStrategy(s: AttackStrategy) {
    setStrategies(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetModel.trim() || categories.size === 0 || strategies.size === 0) return
    onSubmit({
      target_model: targetModel.trim(),
      categories: [...categories],
      strategies: [...strategies],
      num_objectives: numObjectives,
      seed,
    })
  }

  const canSubmit = !!(targetModel.trim() && categories.size > 0 && strategies.size > 0 && !isLoading)

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}
    >
      <style>{`
        .cat-pill {
          padding: 7px 10px;
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #282828;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: #666;
          transition: all 0.12s ease;
          user-select: none;
          text-align: left;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }

        .cat-pill:hover:not(.active) {
          border-color: rgba(255,255,255,0.1);
          color: #C8C8C8;
          background: #2E2E2E;
        }

        .cat-pill.active {
          border-color: rgba(192,57,43,0.35);
          background: rgba(192,57,43,0.08);
          color: #D4D4D4;
        }

        .cat-check {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #C0392B;
          opacity: 0;
          transform: scale(0);
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .cat-pill.active .cat-check {
          opacity: 1;
          transform: scale(1);
        }

        .strategy-pill {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 11px 13px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #282828;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          color: #666;
          transition: all 0.15s ease;
          user-select: none;
          text-align: left;
          gap: 2px;
        }

        .strategy-pill:hover:not(.active) {
          border-color: rgba(255,255,255,0.1);
          background: #2E2E2E;
        }

        .model-input {
          width: 100%;
          background: #282828;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 7px;
          padding: 10px 13px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #C8C8C8;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }

        .model-input:focus {
          border-color: rgba(192,57,43,0.4);
          background: #2C2C2C;
        }

        .model-input::placeholder { color: #444; }

        .seed-input {
          width: 100%;
          background: #282828;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 7px;
          padding: 10px 13px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #C8C8C8;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          -moz-appearance: textfield;
        }

        .seed-input::-webkit-inner-spin-button,
        .seed-input::-webkit-outer-spin-button { -webkit-appearance: none; }

        .seed-input:focus {
          border-color: rgba(192,57,43,0.4);
          background: #2C2C2C;
        }

        .range-input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: transparent;
          outline: none;
          cursor: pointer;
        }

        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #C0392B;
          cursor: pointer;
          border: 2px solid #181818;
          box-shadow: 0 0 0 1px rgba(192,57,43,0.4);
          transition: transform 0.1s;
        }

        .range-input::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .range-input::-moz-range-thumb {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #C0392B;
          cursor: pointer;
          border: 2px solid #181818;
        }

        .launch-btn {
          width: 100%;
          padding: 13px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.3px;
          transition: background 0.15s, transform 0.1s;
          position: relative;
        }

        .launch-btn:not(:disabled) {
          background: #C0392B;
          color: #fff;
        }

        .launch-btn:not(:disabled):hover {
          background: #A93226;
        }

        .launch-btn:not(:disabled):active {
          transform: scale(0.99);
          background: #922B21;
        }

        .launch-btn:disabled {
          background: rgba(255,255,255,0.04);
          color: #444;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 12px; height: 12px;
          border: 1.5px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          vertical-align: -2px;
          margin-right: 8px;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 2px 0;
        }
      `}</style>

      <div style={{
        background: '#212121',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        overflow: 'clip',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#3D8B5E', flexShrink: 0,
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#E6E6E6' }}>
            Attack Configuration
          </span>
        </div>

        <div style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Target Model */}
          <div>
            <SectionLabel>Target Model</SectionLabel>
            <input
              className="model-input"
              type="text"
              value={targetModel}
              onChange={e => setTargetModel(e.target.value)}
              placeholder="ollama/phi4-mini, gpt-4o, azure/…"
              list="model-suggestions"
              autoComplete="off"
            />
            <datalist id="model-suggestions">
              {TARGET_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div className="divider" />

          {/* Categories */}
          <div>
            <SectionLabel count={`${categories.size} / 10`}>Harm Categories</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 8 }}>
              {ALL_CATEGORIES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`cat-pill${categories.has(id) ? ' active' : ''}`}
                  onClick={() => toggleCategory(id)}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  <span className="cat-check" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCategories(new Set(ALL_CATEGORIES.map(c => c.id)))}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: 10, color: '#555', cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3,
                fontFamily: "'Satoshi', system-ui, sans-serif",
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C8C8C8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >
              select all
            </button>
          </div>

          <div className="divider" />

          {/* Strategies */}
          <div>
            <SectionLabel>Attack Strategies</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
              {STRATEGIES.map(({ id, label, desc, color, bg }) => {
                const active = strategies.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`strategy-pill${active ? ' active' : ''}`}
                    onClick={() => toggleStrategy(id)}
                    style={active ? {
                      borderColor: color + '55',
                      background: bg,
                      color,
                    } : {}}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600,
                      color: active ? color : '#888',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: active ? color : '#3A3A3A',
                        flexShrink: 0, transition: 'background 0.15s',
                      }} />
                      {label}
                    </span>
                    <span style={{
                      fontSize: 9.5, color: active ? color + 'AA' : '#444',
                      fontFamily: "'Space Mono', monospace",
                      transition: 'color 0.15s',
                    }}>
                      {desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="divider" />

          {/* Objectives + Seed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <SectionLabel>Objectives</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={numObjectives}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      fontSize: 28, fontWeight: 700, color: '#E6E6E6', lineHeight: 1,
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {numObjectives}
                  </motion.span>
                </AnimatePresence>
                <span style={{ fontSize: 10, color: '#555' }}>per category</span>
              </div>
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <div style={{
                  height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${((numObjectives - 1) / 19) * 100}%`,
                    background: '#C0392B', borderRadius: 3,
                    transition: 'width 0.1s',
                  }} />
                </div>
                <input
                  type="range"
                  className="range-input"
                  min={1} max={20}
                  value={numObjectives}
                  onChange={e => setNumObjectives(Number(e.target.value))}
                  style={{ position: 'absolute', inset: '-6px 0', marginTop: 0 }}
                />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: '#444', fontFamily: "'Space Mono', monospace",
              }}>
                <span>1</span><span>20</span>
              </div>
            </div>

            <div>
              <SectionLabel>Seed</SectionLabel>
              <input
                type="number"
                className="seed-input"
                value={seed}
                onChange={e => setSeed(Number(e.target.value))}
                min={0} max={999999}
              />
              <p style={{ margin: '6px 0 0', fontSize: 10, color: '#444' }}>reproducible runs</p>
            </div>
          </div>

          <div className="divider" />

          {/* Submit */}
          <div>
            <button type="submit" className="launch-btn" disabled={!canSubmit}>
              {isLoading
                ? <><span className="spinner" />Scanning…</>
                : 'Launch Scan'
              }
            </button>

            <AnimatePresence>
              {!canSubmit && !isLoading && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    margin: '8px 0 0', fontSize: 10, color: '#555',
                    textAlign: 'center', overflow: 'hidden',
                  }}
                >
                  {!targetModel.trim()
                    ? 'enter a target model to continue'
                    : categories.size === 0
                    ? 'select at least one harm category'
                    : 'select at least one attack strategy'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </motion.form>
  )
}
