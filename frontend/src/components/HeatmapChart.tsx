import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { HeatmapCell, HarmCategory, AttackStrategy } from '../types'

const CATEGORIES: HarmCategory[] = [
  'violence', 'hate', 'sexual', 'self_harm', 'deception',
  'manipulation', 'radicalization', 'privacy', 'cyberweapons', 'bioweapons',
]

const STRATEGIES: AttackStrategy[] = ['easy', 'moderate', 'difficult']

const STRATEGY_COLOR: Record<AttackStrategy, string> = {
  easy: '#3D8B5E',
  moderate: '#A07820',
  difficult: '#A83020',
}

const STRATEGY_LABEL: Record<AttackStrategy, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
}

const CAT_LABELS: Record<HarmCategory, string> = {
  violence: 'Violence',
  hate: 'Hate',
  sexual: 'Sexual',
  self_harm: 'Self-Harm',
  deception: 'Deception',
  manipulation: 'Manipulation',
  radicalization: 'Radical.',
  privacy: 'Privacy',
  cyberweapons: 'Cyber',
  bioweapons: 'Bio',
}

const CAT_LABELS_FULL: Record<HarmCategory, string> = {
  violence: 'Violence',
  hate: 'Hate Speech',
  sexual: 'Sexual Content',
  self_harm: 'Self-Harm',
  deception: 'Deception',
  manipulation: 'Manipulation',
  radicalization: 'Radicalization',
  privacy: 'Privacy Violation',
  cyberweapons: 'Cyberweapons',
  bioweapons: 'Bioweapons',
}

// Warm dark → muted amber → muted deep red
function asrToColor(asr: number): string {
  if (asr <= 0) return '#252525'
  if (asr <= 0.5) {
    const t = asr / 0.5
    const r = Math.round(37 + t * (172 - 37))
    const g = Math.round(37 + t * (92 - 37))
    const b = Math.round(37 + t * (12 - 37))
    return `rgb(${r},${g},${b})`
  }
  const t = (asr - 0.5) / 0.5
  const r = Math.round(172 + t * (160 - 172))
  const g = Math.round(92  + t * (32  - 92))
  const b = Math.round(12  + t * (22  - 12))
  return `rgb(${r},${g},${b})`
}

function asrToTextColor(asr: number): string {
  return asr > 0.12 ? 'rgba(255,255,255,0.88)' : '#555'
}

interface TooltipState {
  cell: HeatmapCell
  strategy: AttackStrategy
  x: number
  y: number
}

interface HeatmapChartProps {
  cells: HeatmapCell[]
  onCellClick: (cell: HeatmapCell) => void
  selectedCell?: HeatmapCell | null
  compareData?: HeatmapCell[]
  showDiff?: boolean
}

export default function HeatmapChart({
  cells,
  onCellClick,
  selectedCell,
  compareData,
  showDiff = true,
}: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  function getCell(cat: HarmCategory, strat: AttackStrategy): HeatmapCell | undefined {
    return cells.find(c => c.category === cat && c.strategy === strat)
  }

  function getCompare(cat: HarmCategory, strat: AttackStrategy): HeatmapCell | undefined {
    return compareData?.find(c => c.category === cat && c.strategy === strat)
  }

  const maxAttacks = Math.max(...cells.map(c => c.attack_count), 1)

  const handleMouseMove = useCallback((
    e: React.MouseEvent,
    cell: HeatmapCell,
    strat: AttackStrategy,
  ) => {
    const root = (e.currentTarget as HTMLElement).closest('.hm-root') as HTMLElement
    if (!root) return
    const rect = root.getBoundingClientRect()
    setTooltip({
      cell, strategy: strat,
      x: e.clientX - rect.left + 14,
      y: e.clientY - rect.top - 10,
    })
  }, [])

  let cellIdx = 0

  return (
    <div className="hm-root" style={{ fontFamily: "'Space Mono', monospace", position: 'relative' }}>
      <style>{`
        .hm-cell {
          border-radius: 6px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          border: 1px solid rgba(255,255,255,0.04);
        }

        .hm-cell:hover {
          transform: scale(1.05);
          z-index: 2;
          border-color: rgba(255,255,255,0.1);
        }

        .hm-cell.selected {
          box-shadow: 0 0 0 2px #C0392B;
          z-index: 3;
          border-color: transparent;
        }

        .hm-cell-btn {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 2px; padding: 8px 4px;
          border: none; background: none;
          cursor: pointer; font-family: inherit;
        }

        .hm-depth-bar {
          position: absolute; bottom: 0; left: 0;
          height: 2px; background: rgba(255,255,255,0.18);
          border-radius: 0 0 0 6px;
          transition: width 0.3s ease;
        }

        .hm-tooltip {
          position: absolute;
          pointer-events: none;
          z-index: 50;
          background: #1E1E1E;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 11px 14px;
          min-width: 168px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
          animation: fadeIn 0.12s ease;
        }

        @keyframes fadeIn { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Grid */}
      <div
        className="hm-root"
        style={{
          display: 'grid',
          gridTemplateColumns: `104px repeat(${STRATEGIES.length}, 1fr)`,
          gap: 5,
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Header row */}
        <div />
        {STRATEGIES.map(s => (
          <div key={s} style={{
            padding: '6px 0 8px',
            textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: STRATEGY_COLOR[s], flexShrink: 0 }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color: STRATEGY_COLOR[s],
              letterSpacing: 0.5,
            }}>
              {STRATEGY_LABEL[s]}
            </span>
          </div>
        ))}

        {/* Data rows */}
        {CATEGORIES.map(cat => (
          <>
            <div key={`label-${cat}`} style={{
              display: 'flex', alignItems: 'center',
              fontSize: 11.5, color: '#888', fontWeight: 400,
              paddingRight: 10, letterSpacing: 0.2,
              fontFamily: "'Satoshi', system-ui, sans-serif",
            }}>
              {CAT_LABELS[cat]}
            </div>

            {STRATEGIES.map(strat => {
              const cell = getCell(cat, strat)
              const cmp = getCompare(cat, strat)
              const asr = cell?.asr ?? 0
              const bg = cell ? asrToColor(asr) : '#1E1E1E'
              const textColor = asrToTextColor(asr)
              const isSelected = selectedCell?.category === cat && selectedCell?.strategy === strat
              const delta = showDiff && cmp !== undefined ? asr - cmp.asr : null
              const idx = cellIdx++

              return (
                <motion.div
                  key={`${cat}-${strat}`}
                  className={`hm-cell${isSelected ? ' selected' : ''}`}
                  style={{ background: bg, aspectRatio: '1.15' }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.012 }}
                  onMouseMove={cell ? e => handleMouseMove(e, cell, strat) : undefined}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <button
                    className="hm-cell-btn"
                    onClick={() => cell && onCellClick(cell)}
                    disabled={!cell}
                  >
                    <span style={{
                      fontSize: cell ? 15 : 11, fontWeight: 700,
                      color: cell ? textColor : '#333',
                      lineHeight: 1,
                    }}>
                      {cell ? `${(asr * 100).toFixed(0)}%` : '·'}
                    </span>
                    {cell && (
                      <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.3 }}>
                        {cell.attack_count}
                      </span>
                    )}
                    {delta !== null && Math.abs(delta) > 0.01 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: delta > 0 ? '#A83020' : '#3D8B5E',
                      }}>
                        {delta > 0 ? '▲' : '▼'}{(Math.abs(delta) * 100).toFixed(0)}%
                      </span>
                    )}
                  </button>
                  {cell && (
                    <div
                      className="hm-depth-bar"
                      style={{ width: `${(cell.attack_count / maxAttacks) * 100}%` }}
                    />
                  )}
                </motion.div>
              )
            })}
          </>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="hm-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div style={{ fontWeight: 600, color: '#E6E6E6', marginBottom: 6, fontSize: 12 }}>
            {CAT_LABELS_FULL[tooltip.cell.category as HarmCategory]}
            <span style={{ color: '#3A3A3A', fontWeight: 400 }}> / </span>
            {tooltip.strategy}
          </div>
          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.9 }}>
            <div>
              ASR{' '}
              <strong style={{
                color: asrToColor(tooltip.cell.asr) === '#252525' ? '#3D8B5E'
                  : tooltip.cell.asr > 0.5 ? '#A83020' : '#A07820',
              }}>
                {(tooltip.cell.asr * 100).toFixed(1)}%
              </strong>
            </div>
            <div>Attacks <strong style={{ color: '#999' }}>{tooltip.cell.attack_count}</strong></div>
            {tooltip.cell.asr > 0 && (
              <div>Hits <strong style={{ color: '#999' }}>
                {Math.round(tooltip.cell.asr * tooltip.cell.attack_count)}
              </strong></div>
            )}
          </div>
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 8.5, color: '#3A3A3A', letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            Click to drill down
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <span style={{ fontSize: 9, color: '#444', letterSpacing: 1.2, textTransform: 'uppercase' }}>ASR</span>
        <div>
          <div style={{
            width: 150, height: 5, borderRadius: 3,
            background: 'linear-gradient(90deg, #252525 0%, rgb(172,92,12) 50%, rgb(160,32,22) 100%)',
          }} />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 4, fontSize: 8.5, color: '#444',
          }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
