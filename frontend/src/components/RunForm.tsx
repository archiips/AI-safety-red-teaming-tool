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

const STRATEGIES: { id: AttackStrategy; label: string; color: string; glow: string }[] = [
  { id: 'easy',      label: 'Easy',     color: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  { id: 'moderate',  label: 'Moderate', color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  { id: 'difficult', label: 'Difficult',color: '#ef4444', glow: 'rgba(239,68,68,0.25)'  },
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
    <form onSubmit={handleSubmit} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

        .crucible-form {
          background: #0f1117;
          border: 1px solid #1e2235;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .crucible-form::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(99,102,241,0.012) 2px,
            rgba(99,102,241,0.012) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .form-header {
          padding: 20px 28px 16px;
          border-bottom: 1px solid #1e2235;
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 800;
          color: #f1f3f9;
          letter-spacing: -0.5px;
          margin: 0;
        }

        .status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .form-body {
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
          z-index: 1;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .field-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
          color: #4b5280;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .field-label span {
          display: inline-block;
          width: 16px; height: 1px;
          background: #2e3347;
        }

        .model-input-wrap {
          position: relative;
          display: flex;
          gap: 8px;
        }

        .model-input {
          flex: 1;
          background: #131620;
          border: 1px solid #1e2235;
          border-radius: 8px;
          padding: 10px 14px;
          font-family: inherit;
          font-size: 13px;
          color: #e2e4f0;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .model-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }

        .model-input::placeholder { color: #3d4260; }

        .model-datalist-btn {
          background: #131620;
          border: 1px solid #1e2235;
          border-radius: 8px;
          padding: 0 12px;
          cursor: pointer;
          color: #4b5280;
          font-size: 11px;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .model-datalist-btn:hover { border-color: #6366f1; color: #6366f1; }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        .cat-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 8px;
          border-radius: 7px;
          border: 1px solid #1e2235;
          background: #131620;
          cursor: pointer;
          font-family: inherit;
          font-size: 10.5px;
          font-weight: 500;
          color: #4b5280;
          transition: all 0.15s;
          user-select: none;
          white-space: nowrap;
          overflow: hidden;
        }

        .cat-pill:hover:not(.active) {
          border-color: #2e3347;
          color: #8890b0;
        }

        .cat-pill.active {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.1);
          color: #a5b4fc;
          box-shadow: 0 0 12px rgba(99,102,241,0.12);
        }

        .cat-icon {
          font-size: 11px;
          flex-shrink: 0;
        }

        .select-all-link {
          font-size: 10px;
          color: #4b5280;
          cursor: pointer;
          letter-spacing: 0.5px;
          text-decoration: underline;
          text-underline-offset: 3px;
          background: none;
          border: none;
          font-family: inherit;
          padding: 0;
          transition: color 0.1s;
          align-self: flex-end;
        }

        .select-all-link:hover { color: #6366f1; }

        .strategy-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .strategy-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 0;
          border-radius: 8px;
          border: 1px solid #1e2235;
          background: #131620;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          color: #4b5280;
          transition: all 0.2s;
          user-select: none;
          letter-spacing: 0.5px;
        }

        .strategy-dot {
          width: 7px; height: 7px;
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
          align-items: center;
        }

        .slider-value {
          font-size: 22px;
          font-weight: 700;
          color: #6366f1;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .slider-sub {
          font-size: 10px;
          color: #3d4260;
        }

        .range-track {
          position: relative;
          height: 4px;
          background: #1e2235;
          border-radius: 4px;
        }

        .range-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #4f46e5, #818cf8);
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

        .range-thumb-track {
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .seed-input {
          background: #131620;
          border: 1px solid #1e2235;
          border-radius: 8px;
          padding: 10px 14px;
          font-family: inherit;
          font-size: 13px;
          color: #e2e4f0;
          outline: none;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
          -moz-appearance: textfield;
        }

        .seed-input::-webkit-inner-spin-button,
        .seed-input::-webkit-outer-spin-button { -webkit-appearance: none; }

        .seed-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #1e2235 20%, #1e2235 80%, transparent);
        }

        .launch-btn {
          width: 100%;
          padding: 14px;
          border-radius: 9px;
          border: none;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          position: relative;
          overflow: hidden;
          transition: all 0.2s;
        }

        .launch-btn:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5, #6366f1, #818cf8);
          color: #fff;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        }

        .launch-btn:not(:disabled):hover {
          box-shadow: 0 6px 28px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }

        .launch-btn:not(:disabled):active {
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(99,102,241,0.3);
        }

        .launch-btn:disabled {
          background: #1e2235;
          color: #3d4260;
          cursor: not-allowed;
        }

        .launch-btn .shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          transform: translateX(-100%);
          animation: shimmer 2.5s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .spinner {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: -3px;
          margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .validation-hint {
          font-size: 10px;
          color: #3d4260;
          letter-spacing: 0.5px;
          text-align: center;
          margin-top: 4px;
        }
      `}</style>

      <div className="crucible-form">
        <div className="form-header">
          <div className="status-dot" />
          <p className="form-title">Crucible — Attack Config</p>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2e3347', letterSpacing: 2 }}>
            v0.1.0
          </span>
        </div>

        <div className="form-body">
          {/* Target Model */}
          <div className="field-group">
            <label className="field-label">
              <span />
              Target Model
            </label>
            <div className="model-input-wrap">
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
          </div>

          <div className="divider" />

          {/* Categories */}
          <div className="field-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="field-label">
                <span />
                Harm Categories
                <span style={{ color: '#2e3347', fontWeight: 400 }}>
                  ({categories.size}/10)
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
            <label className="field-label">
              <span />
              Attack Strategies
            </label>
            <div className="strategy-row">
              {STRATEGIES.map(({ id, label, color, glow }) => {
                const active = strategies.has(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className="strategy-pill"
                    onClick={() => toggleStrategy(id)}
                    style={active ? {
                      borderColor: color,
                      color,
                      background: glow,
                      boxShadow: `0 0 14px ${glow}`,
                    } : {}}
                  >
                    <span
                      className="strategy-dot"
                      style={{ background: active ? color : '#2e3347' }}
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
              <label className="field-label">
                <span />
                Objectives
              </label>
              <div className="slider-wrap">
                <div className="slider-header">
                  <span className="slider-value">{numObjectives}</span>
                  <span className="slider-sub">attacks / category</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#2e3347' }}>
                  <span>1</span><span>20</span>
                </div>
              </div>
            </div>

            {/* Seed */}
            <div className="field-group">
              <label className="field-label">
                <span />
                Random Seed
              </label>
              <input
                type="number"
                className="seed-input"
                value={seed}
                onChange={e => setSeed(Number(e.target.value))}
                min={0}
                max={999999}
              />
              <span style={{ fontSize: 10, color: '#2e3347', letterSpacing: 0.5 }}>
                for reproducibility
              </span>
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
              {!isLoading && canSubmit && <span className="shimmer" />}
              {isLoading
                ? <><span className="spinner" />Scanning…</>
                : '⚡ Launch Scan'
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
