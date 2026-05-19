import { useState } from 'react'
import { CFGLineChart, GainBarChart } from './Charts'
import { CFG_CAT_LINES } from './data'

export default function RQ3View({ model }) {
  const [cfgMax, setCfgMax] = useState(20)
  return (
    <div className="view v-rq3 active">

      <div className="panel">
        <div className="ph"><span className="pt">CFG scale × alignment score</span><span className="rq-badge rq3">RQ3</span></div>
        <CFGLineChart cfgMax={cfgMax} model={model} />
        <div className="legend-row">
          {CFG_CAT_LINES.map(c => (
            <div key={c.key} className="leg">
              <div className="ld" style={{ background:c.color }} /><span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="pt">Total gain: CFG 1 → 20</span><span className="rq-badge rq3">RQ3</span></div>
        <GainBarChart />
        <div className="finding" style={{ marginTop:10 }}>
          <strong>Key finding:</strong> Emotion adjectives and spatial relationships improve by only
          +0.09 and +0.07 — adjusting CFG cannot fix concept-level grounding failures. This is architectural.
        </div>
      </div>

      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">CFG slider</span>
          <span className="ps">{cfgMax===20 ? 'Showing all CFG values' : `Showing CFG ≤ ${cfgMax}`}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>1</span>
          <input type="range" min={1} max={20} value={cfgMax} style={{ flex:1 }}
            onChange={e => setCfgMax(parseInt(e.target.value))} />
          <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>20</span>
        </div>
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:6 }}>
          Drag left to restrict the CFG range. Flat lines = parameter tuning can't fix the failure.
        </div>
      </div>

    </div>
  )
}
