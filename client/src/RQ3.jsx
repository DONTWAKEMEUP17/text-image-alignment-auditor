import { useState, useEffect } from 'react'
import { CFGLineChart, GainBarChart } from './Charts'
import { api } from './api'
import { CFG_CAT_COLORS, CFG_CAT_LABELS, CFG_BIN_ORDER } from './data'

// RQ3 is SD 1.x only — FLUX.1 is a distilled model that ignores CFG
export default function RQ3View() {
  const [rawData,    setRawData]    = useState([])   // [{cfg_bin, concept_category, n, mean_score}]
  const [maxBinIdx,  setMaxBinIdx]  = useState(5)    // slider: how many bins to show (0-based)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    setLoading(true)
    api.cfgByConcept()
      .then(data => {
        setRawData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Resolve bins in canonical order (only include bins present in data)
  const binsInData = new Set(rawData.map(d => d.cfg_bin))
  const bins = CFG_BIN_ORDER.filter(b => binsInData.has(b))

  // Resolve categories from data
  const categories = [...new Set(rawData.map(d => d.concept_category))]

  // Pivot: [{category, label, color, scores: (number|null)[]}]
  const lines = categories.map(cat => ({
    category: cat,
    label:    CFG_CAT_LABELS[cat] ?? cat,
    color:    CFG_CAT_COLORS[cat] ?? '#888',
    scores:   bins.map(bin => {
      const row = rawData.find(d => d.cfg_bin === bin && d.concept_category === cat)
      return row ? row.mean_score : null
    }),
  }))

  // Gains: (last bin score) - (first bin score) per category, sorted descending
  const gains = lines.map(l => {
    const valid = l.scores.filter(s => s != null)
    return {
      label: l.label,
      color: l.color,
      gain:  valid.length >= 2 ? valid[valid.length - 1] - valid[0] : 0,
    }
  }).sort((a, b) => b.gain - a.gain)

  const safeMax = Math.max(0, bins.length - 1)

  return (
    <div className="view v-rq3 active">

      {/* CFG × alignment line chart */}
      <div className="panel">
        <div className="ph">
          <span className="pt">CFG scale × alignment score</span>
          <span className="rq-badge rq3">RQ3</span>
          <span className="ps">SD 1.x only — FLUX ignores CFG</span>
        </div>
        {loading
          ? <div style={{ fontSize:12, color:'var(--color-text-tertiary)', padding:16 }}>Loading…</div>
          : <CFGLineChart lines={lines} bins={bins} maxBinIdx={Math.min(maxBinIdx, safeMax)} />
        }
        {lines.length > 0 && (
          <div className="legend-row" style={{ marginTop:8 }}>
            {lines.map(l => (
              <div key={l.category} className="leg">
                <div className="ld" style={{ background:l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CFG gain bar */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Alignment gain: CFG min → max</span>
          <span className="rq-badge rq3">RQ3</span>
        </div>
        {gains.length > 0 && <GainBarChart gains={gains} />}
        <div className="finding" style={{ marginTop:10 }}>
          <strong>Key finding:</strong> Adjectives improve less than noun chunks across the full CFG range —
          increasing CFG cannot resolve concept-level grounding failures for abstract modifiers. The failure is architectural.
        </div>
      </div>

      {/* CFG range slider */}
      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">CFG range</span>
          <span className="ps">
            {bins.length === 0
              ? 'loading…'
              : maxBinIdx >= safeMax
                ? `Showing all bins (${bins[0]} – ${bins[safeMax]})`
                : `Showing up to ${bins[maxBinIdx]}`}
          </span>
        </div>
        {bins.length > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{bins[0]}</span>
            <input type="range" min={0} max={safeMax} value={Math.min(maxBinIdx, safeMax)}
              style={{ flex:1 }}
              onChange={e => setMaxBinIdx(parseInt(e.target.value))} />
            <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{bins[safeMax]}</span>
          </div>
        )}
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:6 }}>
          Drag left to restrict the CFG range shown. Flat lines indicate parameter tuning cannot fix the failure.
        </div>
      </div>

    </div>
  )
}
