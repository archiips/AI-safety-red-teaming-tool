import { useState } from 'react'
import type { RunConfig, HarmCategory, AttackStrategy } from '../types'

interface RunFormProps {
  onSubmit: (config: RunConfig) => void
  isLoading: boolean
}

const ALL_CATEGORIES: { id: HarmCategory; label: string; icon: string }[] = [
  { id: 'violence',       label: 'Violence',       icon: '⚔' },
  { id: 'hate',           label: 'Hate',           icon: '☣' },
  { id: 'sexual',         label: 'Sexual',         icon: '⛔' },
  { id: 'self_harm',      label: 'Self-Harm',      icon: '⚠' },
  { id: 'deception',      label: 'Deception',      icon: '◈' },
  { id: 'manipulation',   label: 'Manipulation',   icon: '⥁' },
  { id: 'radicalization', label: 'Radical.',        icon: '◉' },
  { id: 'privacy',        label: 'Privacy',        icon: '⊘' },
  { id: 'cyberweapons',   label: 'Cyber',          icon: '⌘' },
  { id: 'bioweapons',     label: 'Bio',            icon: '⚗' },
]

const STRATEGIES: { id: AttackStrategy; label: string; color: string; bg: string }[] = [
  { id: 'easy',      label: 'Easy',      color: '#4A9060', bg: 'rgba(74,144,96,0.1)'  },
  { id: 'moderate',  label: 'Moderate',  color: '#B8860B', bg: 'rgba(184,134,11,0.1)' },
  { id: 'difficult', label: 'Difficult', color: '#B03020', bg: 'rgba(176,48,32,0.1)'  },
]

const TARGET_MODELS = [
  'ollama/phi4-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'azure/phi-4-mini-instruct',
]

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

  function selectAllCategories() {
    setCategories(new Set(ALL_CATEGORIES.map(c => c.id)))
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

  const canSubmit = targetModel.trim() && categories.size > 0 && strategies.size > 0 && !isLoading

  return (
    <form onSubmit={handleSubmit} style={{ fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <style>{`
        .crucible-form {
          background: #232323;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          overflow: hidden;
        }

        .form-header {
          padding: 18px 24px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .form-title {
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #E8E8E8;
          margin: 0;
          letter-spacing: -0.2px;
        }

        .status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4A9060;
          flex-shrink: 0;
        }

        .form-body {
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .field-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1.5px;
          color: #888;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Space Mono', monospace;
        }

        .model-input {
          width: 100%;
          background: #2A2A2A;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          padding: 9px 12px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #D4D4D4;
          outline: none;
          transition: border-color 0.15s;
        }

        .model-input:focus {
          border-color: rgba(192,57,43,0.5);
        }

        .model-input::placeholder { color: #555; }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
        }

        .cat-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 7px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.07);
          background: #2A2A2A;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 10px;
          font-weight: 500;
          color: #888;
          transition: all 0.12s;
          user-select: none;
          white-space: nowrap;
          overflow: hidden;
        }

        .cat-pill:hover:not(.active) {
          border-color: rgba(255,255,255,0.12);
          color: #D4D4D4;
        }

        .cat-pill.active {
          border-color: rgba(192,57,43,0.4);
          background: rgba(192,57,43,0.08);
          color: #E8E8E8;
        }

        .cat-icon {
          font-size: 10px;
          flex-shrink: 0;
        }

        .select-all-link {
          font-size: 10px;
          color: #666;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          background: none;
          border: none;
          font-family: 'Satoshi', system-ui, sans-serif;
          padding: 0;
          transition: color 0.1s;
        }

        .select-all-link:hover { color: #D4D4D4; }

        .strategy-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }

        .strategy-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 0;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.07);
          background: #2A2A2A;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #888;
          transition: all 0.15s;
          user-select: none;
        }

        .strategy-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .slider-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slider-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .slider-value {
          font-size: 22px;
          font-weight: 700;
          color: #E8E8E8;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          font-family: 'Space Mono', monospace;
        }

        .slider-sub {
          font-size: 10px;
          color: #666;
        }

        .range-thumb-track {
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .range-track {
          position: absolute;
          left: 0; right: 0;
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }

        .range-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 3px;
          background: #C0392B;
          pointer-events: none;
          transition: width 0.1s;
        }

        .range-input {
          position: absolute;
          inset: -8px 0;
          width: 100%;
          opacity: 0;
          cursor: pointer;
          height: calc(100% + 16px);
        }

        .seed-input {
          background: #2A2A2A;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          padding: 9px 12px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #D4D4D4;
          outline: none;
          width: 100%;
          transition: border-color 0.15s;
          -moz-appearance: textfield;
        }

        .seed-input::-webkit-inner-spin-button,
        .seed-input::-webkit-outer-spin-button { -webkit-appearance: none; }

        .seed-input:focus {
          border-color: rgba(192,57,43,0.5);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        .launch-btn {
          width: 100%;
          padding: 13px;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          font-family: 'Satoshi', system-ui, sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.5px;
          transition: all 0.15s;
        }

        .launch-btn:not(:disabled) {
          background: #C0392B;
          color: #fff;
        }

        .launch-btn:not(:disabled):hover {
          background: #A93226;
        }

        .launch-btn:not(:disabled):active {
          background: #922B21;
        }

        .launch-btn:disabled {
          background: rgba(255,255,255,0.05);
          color: #555;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: -2px;
          margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .validation-hint {
          font-size: 10px;
          color: #666;
          text-align: center;
          margin-top: 6px;
          font-family: 'Satoshi', system-ui, sans-serif;
        }
      `}</style>

      <div className="crucible-form">
        <div className="form-header">
          <div className="status-dot" />
          <p className="form-title">Attack Configuration</p>
          <span style={{
            marginLeft: 'auto', fontSize: 9, color: '#555', letterSpacing: 1.5,
            fontFamily: "'Space Mono', monospace",
          }}>
            v0.1.0
          </span>
        </div>

        <div className="form-body">
          {/* Target Model */}
          <div className="field-group">
            <label className="field-label">Target Model</label>
            <input
              className="model-input"
              type="text"
              value={targetModel}
              onChange={e => setTargetModel(e.target.value)}
              placeholder="e.g. gpt-4o, ollama/phi4-mini"
              list="model-suggestions"
              autoComplete="off"
              required
            />
            <datalist id="model-suggestions">
              {TARGET_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div className="divider" />

          {/* Categories */}
          <div className="field-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="field-label">
                Harm Categories
                <span style={{ color: '#555', fontWeight: 400, fontFamily: 'inherit' }}>
                  {categories.size}/10
                </span>
              </label>
              <button type="button" className="select-all-link" onClick={selectAllCategories}>
                select all
              </button>
            </div>
            <div className="category-grid">
              {ALL_CATEGORIES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`cat-pill${categories.has(id) ? ' active' : ''}`}
                  onClick={() => toggleCategory(id)}
                >
                  <span className="cat-icon">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Strategies */}
          <div className="field-group">
            <label className="field-label">Attack Strategies</label>
            <div className="strategy-row">
              {STRATEGIES.map(({ id, label, color, bg }) => {
                const active = strategies.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className="strategy-pill"
                    onClick={() => toggleStrategy(id)}
                    style={active ? {
                      borderColor: color + '80',
                      color,
                      background: bg,
                    } : {}}
                  >
                    <span
                      className="strategy-dot"
                      style={{ background: active ? color : '#444' }}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="divider" />

          <div className="form-row">
            {/* Num Objectives */}
            <div className="field-group">
              <label className="field-label">Objectives</label>
              <div className="slider-wrap">
                <div className="slider-header">
                  <span className="slider-value">{numObjectives}</span>
                  <span className="slider-sub">per category</span>
                </div>
                <div className="range-thumb-track">
                  <div className="range-track">
                    <div
                      className="range-fill"
                      style={{ width: `${((numObjectives - 1) / 19) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    className="range-input"
                    min={1}
                    max={20}
                    value={numObjectives}
                    onChange={e => setNumObjectives(Number(e.target.value))}
                  />
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 9, color: '#555',
                  fontFamily: "'Space Mono', monospace",
                }}>
                  <span>1</span><span>20</span>
                </div>
              </div>
            </div>

            {/* Seed */}
            <div className="field-group">
              <label className="field-label">Random Seed</label>
              <input
                type="number"
                className="seed-input"
                value={seed}
                onChange={e => setSeed(Number(e.target.value))}
                min={0}
                max={999999}
              />
              <span style={{ fontSize: 10, color: '#666' }}>for reproducibility</span>
            </div>
          </div>

          <div className="divider" />

          {/* Submit */}
          <div>
            <button
              type="submit"
              className="launch-btn"
              disabled={!canSubmit}
            >
              {isLoading
                ? <><span className="spinner" />Scanning…</>
                : 'Launch Scan'
              }
            </button>
            {!canSubmit && !isLoading && (
              <p className="validation-hint">
                {!targetModel.trim()
                  ? 'enter a target model to continue'
                  : categories.size === 0
                  ? 'select at least one harm category'
                  : 'select at least one attack strategy'}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
