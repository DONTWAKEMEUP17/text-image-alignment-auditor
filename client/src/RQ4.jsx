import { useState, useEffect } from 'react'
import { GroupedBarChart, DeltaList, PairedScatterChart } from './Charts'
import { CompareGallery } from './Gallery'
import { api } from './api'
import { CFG_CAT_LABELS } from './data'

export default function RQ4View() {
  const [summary, setSummary] = useState(null)     // {paired_count, sd_mean, flux_mean, mean_delta}
  const [byCat,   setByCat]   = useState([])       // [{concept_category, model, n, mean_score}]
  const [scatter, setScatter] = useState([])       // [{sd_score, flux_score, concept_type, sd_image, flux_image, prompt}]
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.pairedSummary(),
      api.pairedByCategory(),
      api.pairedScatter(500),
    ]).then(([sum, cat, sc]) => {
      setSummary(sum[0] ?? null)
      setByCat(cat)
      setScatter(sc)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Pivot byCat into [{label, sd1, flux}]
  const cats = [...new Set(byCat.map(d => d.concept_category))].map(cat => {
    const sdRow   = byCat.find(d => d.concept_category === cat && d.model === 'sd1x')
    const fluxRow = byCat.find(d => d.concept_category === cat && d.model === 'flux1')
    return {
      label: CFG_CAT_LABELS[cat] ?? cat,
      sd1:   sdRow?.mean_score   ?? 0,
      flux:  fluxRow?.mean_score ?? 0,
    }
  })

  // Deltas sorted descending
  const deltas = cats
    .map(c => ({ label: c.label, delta: c.flux - c.sd1 }))
    .sort((a, b) => b.delta - a.delta)

  if (loading) return (
    <div className="view v-rq4 active"
      style={{ padding:40, textAlign:'center', fontSize:13, color:'var(--color-text-tertiary)' }}>
      Loading comparison data…
    </div>
  )

  return (
    <div className="view v-rq4 active">

      {/* Summary stat cards */}
      {summary && (
        <div className="panel">
          <div className="ph">
            <span className="pt">Paired comparison summary</span>
            <span className="rq-badge rq4">RQ4</span>
          </div>
          <div style={{ display:'flex', gap:28, flexWrap:'wrap', padding:'8px 0' }}>
            {[
              { label:'Paired prompts',    val: summary.paired_count?.toLocaleString() },
              { label:'SD 1.x mean score', val: summary.sd_mean?.toFixed(4) },
              { label:'FLUX.1 mean score', val: summary.flux_mean?.toFixed(4) },
              {
                label:'Mean Δ (FLUX − SD)',
                val:  (summary.mean_delta >= 0 ? '+' : '') + summary.mean_delta?.toFixed(4),
                color: summary.mean_delta >= 0 ? '#1D9E75' : '#D85A30',
              },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:22, fontWeight:600, color: s.color ?? 'var(--color-text-primary)' }}>
                  {s.val}
                </div>
                <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped bar: SD1x vs FLUX per category */}
      <div className="panel">
        <div className="ph">
          <span className="pt">SD 1.x vs FLUX.1 by concept category</span>
          <span className="rq-badge rq4">RQ4</span>
        </div>
        <div className="legend-row" style={{ marginBottom:8 }}>
          <div className="leg"><div className="ld" style={{ background:'#378ADD' }} /><span>SD 1.x</span></div>
          <div className="leg"><div className="ld" style={{ background:'#1D9E75' }} /><span>FLUX.1</span></div>
        </div>
        <GroupedBarChart cats={cats} />
      </div>

      {/* Delta list */}
      <div className="panel">
        <div className="ph">
          <span className="pt">FLUX.1 − SD 1.x delta</span>
          <span className="rq-badge rq4">RQ4</span>
        </div>
        <DeltaList deltas={deltas} />
      </div>

      {/* Paired scatter */}
      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">Per-prompt score scatter</span>
          <span className="ps">above diagonal → FLUX better · below → SD better</span>
          <span className="rq-badge rq4">RQ4</span>
        </div>
        <div className="legend-row" style={{ marginBottom:8 }}>
          <div className="leg"><div className="ld" style={{ background:'#378ADD' }} /><span>Object</span></div>
          <div className="leg"><div className="ld" style={{ background:'#D85A30' }} /><span>Abstract</span></div>
          <div className="leg"><div className="ld" style={{ background:'#1D9E75' }} /><span>Scene</span></div>
          <div className="leg"><div className="ld" style={{ background:'#7F77DD' }} /><span>Style</span></div>
        </div>
        <PairedScatterChart data={scatter} />
      </div>

      {/* Sample pairs gallery — sorted by biggest delta so visually interesting */}
      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">Sample pairs — largest score gap</span>
          <span className="ps">SD 1.x left · FLUX.1 right</span>
        </div>
        <CompareGallery pairs={scatter.slice(0, 10)} />
      </div>

    </div>
  )
}
