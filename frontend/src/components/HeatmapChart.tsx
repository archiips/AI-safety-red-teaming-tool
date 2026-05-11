import { useState, useCallback } from 'react'
import type { HeatmapCell, HarmCategory, AttackStrategy } from '../types'

const CATEGORIES: HarmCategory[] = [
  'violence', 'hate', 'sexual', 'self_harm', 'deception',
  'manipulation', 'radicalization', 'privacy', 'cyberweapons', 'bioweapons',
]

const STRATEGIES: AttackStrategy[] = ['easy', 'moderate', 'difficult']

const STRATEGY_COLOR: Record<AttackStrategy, string> = {
  easy: '#10b981',
  moderate: '#f59e0b',
  difficult: '#ef4444',
}

const STRATEGY_LABEL: Record<AttackStrategy, string> = {
  easy: 'EASY',
  moderate: 'MODERATE',
  difficult: 'DIFFICULT',
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

function asrToColor(asr: number): string {
  if (asr <= 0) return '#11141f'
  if (asr <= 0.5) {
    const t = asr / 0.5
    const r = Math.round(17 + t * (245 - 17))
    const g = Math.round(20 + t * (158 - 20))
    const b = Math.round(31 + t * (11 - 31))
    return `rgb(${r},${g},${b})`
  }
  const t = (asr - 0.5) / 0.5
  const r = Math.round(245 + t * (239 - 245))
  const g = Math.round(158 + t * (68 - 158))
  const b = Math.round(11 + t * (68 - 11))
  return `rgb(${r},${g},${b})`
}

function asrToTextColor(asr: number): string {
  return asr > 0.15 ? 'rgba(255,255,255,0.95)' : '#3d4260'
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
    const rect = (e.currentTarget as HTMLElement).closest('.hm-grid-root')?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      cell,
      strategy: strat,
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 8,
    })
  }, [])

  return (
    <div className="hm-grid-root" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@700;800&display=swap');

        .hm-cell {
          border-radius: 6px;
          transition: transform 0.15s, box-shadow 0.15s;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .hm-cell:hover {
          transform: scale(1.04);
          z-index: 2;
        }

        .hm-cell.selected {
          box-shadow: 0 0 0 2px #6366f1, 0 0 20px rgba(99,102,241,0.4);
          z-index: 3;
        }

        .hm-cell-inner {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 8px 4px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }

        .hm-cell .depth-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(255,255,255,0.2);
          border-radius: 0 0 6px 0;
          transition: width 0.3s ease;
        }

        .hm-tooltip {
          position: absolute;
          pointer-events: none;
          z-index: 50;
          background: #1a1d2e;
          border: 1px solid #2e3347;
          border-radius: 8px;
          padding: 10px 12px;
          min-width: 160px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          font-size: 11px;
          line-height: 1.6;
        }
      `}</style>

      <div
        className="hm-grid-root"
        style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${STRATEGIES.length}, 1fr)`,
          gap: 4,
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Header row */}
        <div />
        {STRATEGIES.map(s => (
          <div key={s} style={{
            padding: '8px 0',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: STRATEGY_COLOR[s],
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {STRATEGY_LABEL[s]}
          </div>
        ))}

        {/* Data rows */}
        {CATEGORIES.map(cat => (
          <>
            <div key={`label-${cat}`} style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 500,
              paddingRight: 12,
              letterSpacing: 0.5,
            }}>
              {CAT_LABELS[cat]}
            </div>

            {STRATEGIES.map(strat => {
              const cell = getCell(cat, strat)
              const cmp = getCompare(cat, strat)
              const asr = cell?.asr ?? 0
              const bg = asrToColor(asr)
              const textColor = asrToTextColor(asr)
              const isSelected = selectedCell?.category === cat && selectedCell?.strategy === strat
              const delta = showDiff && cmp !== undefined ? asr - cmp.asr : null

              return (
                <div
                  key={`${cat}-${strat}`}
                  className={`hm-cell${isSelected ? ' selected' : ''}`}
                  style={{ background: bg, aspectRatio: '1.2' }}
                  onMouseMove={cell ? e => handleMouseMove(e, cell, strat) : undefined}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <button
                    className="hm-cell-inner"
                    onClick={() => cell && onCellClick(cell)}
                    disabled={!cell}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: textColor }}>
                      {cell ? `${(asr * 100).toFixed(0)}%` : '—'}
                    </span>
                    {cell && (
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                        {cell.attack_count} attacks
                      </span>
                    )}
                    {delta !== null && Math.abs(delta) > 0.01 && (
                      <span style={{
                        fontSize: 9,
                        color: delta > 0 ? '#ef4444' : '#10b981',
                        fontWeight: 600,
                      }}>
                        {delta > 0 ? '▲' : '▼'}{(Math.abs(delta) * 100).toFixed(0)}%
                      </span>
                    )}
                  </button>
                  {cell && (
                    <div
                      className="depth-bar"
                      style={{ width: `${(cell.attack_count / maxAttacks) * 100}%` }}
                    />
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>

      {/* Custom hover tooltip */}
      {tooltip && (
        <div
          className="hm-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div style={{ fontWeight: 700, color: '#f1f3f9', marginBottom: 4, fontSize: 12 }}>
            {CAT_LABELS_FULL[tooltip.cell.category as HarmCategory]} × {tooltip.strategy}
          </div>
          <div style={{ color: '#a5b4fc' }}>
            ASR: <strong style={{ color: '#f1f3f9' }}>{(tooltip.cell.asr * 100).toFixed(1)}%</strong>
          </div>
          <div style={{ color: '#6b7280' }}>
            Attacks: <strong style={{ color: '#9ca3af' }}>{tooltip.cell.attack_count}</strong>
          </div>
          {tooltip.cell.asr > 0 && (
            <div style={{ color: '#6b7280' }}>
              Hits: <strong style={{ color: '#9ca3af' }}>
                {Math.round(tooltip.cell.asr * tooltip.cell.attack_count)}
              </strong>
            </div>
          )}
          <div style={{
            marginTop: 6, paddingTop: 6,
            borderTop: '1px solid #2e3347',
            fontSize: 9, color: '#374151', letterSpacing: 0.5,
          }}>
            CLICK TO DRILL DOWN
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#374151', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Attack Success Rate
        </span>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 180, height: 8, borderRadius: 4,
            background: 'linear-gradient(90deg, #11141f 0%, #f59e0b 50%, #ef4444 100%)',
          }} />
          {/* Tick marks */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 4, fontSize: 9, color: '#4b5280',
          }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
