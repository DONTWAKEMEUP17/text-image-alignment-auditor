import { useState, useEffect } from 'react'
import { GroupedBarChart, DeltaList, PairedScatterChart } from './Charts'
import { CompareGallery } from './Gallery'
import { api } from './api'
import { CFG_CAT_LABELS } from './data'

export default function RQ4View() {
  const [summary,      setSummary]      = useState(null)
  const [byCat,        setByCat]        = useState([])
  const [scatter,      setScatter]      = useState([])
  const [loading,      setLoading]      = useState(false)
  const [selectedPoint,setSelectedPoint]= useState(null)

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

  // Pivot byCat → [{label, sd1, flux}]  (noun_chunk / adjective)
  const cats = [...new Set(byCat.map(d => d.concept_category))].map(cat => {
    const sdRow   = byCat.find(d => d.concept_category === cat && d.model === 'sd1x')
    const fluxRow = byCat.find(d => d.concept_category === cat && d.model === 'flux1')
    return {
      label: CFG_CAT_LABELS[cat] ?? cat,
      sd1:   sdRow?.mean_score   ?? 0,
      flux:  fluxRow?.mean_score ?? 0,
    }
  })

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

      {/* ── Summary stat cards ───────────────────────────────── */}
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

      {/* ── Section A: spaCy concept-level analysis ──────────── */}
      {/* Section label spanning full width */}
      <div style={{
        gridColumn: '1 / -1',
        fontSize: 11, fontWeight: 600, letterSpacing: '.5px',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        padding: '4px 2px', borderBottom: '1px solid var(--color-border)',
      }}>
        A — Concept-level breakdown &nbsp;·&nbsp; 6 categories: content noun · style · quality · artist · emotion · other
      </div>

      {/* Grouped bar */}
      <div className="panel">
        <div className="ph">
          <span className="pt">SD 1.x vs FLUX.1 by concept category</span>
          <span className="rq-badge rq4">RQ4</span>
        </div>
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:8 }}>
          Average alignment score for each concept type. Longer bar = model renders that word type more accurately. Blue = SD 1.x, green = FLUX.1.
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
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:8 }}>
          How much FLUX.1 gained (or lost) vs SD 1.x per concept type. Green = FLUX improved. Red = SD actually did better.
        </div>
        <DeltaList deltas={deltas} />
      </div>

      {/* ── Section B: image-level prompt type analysis ───────── */}
      <div style={{
        gridColumn: '1 / -1',
        fontSize: 11, fontWeight: 600, letterSpacing: '.5px',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        padding: '4px 2px', borderBottom: '1px solid var(--color-border)',
      }}>
        B — Image-level prompt type &nbsp;·&nbsp; categories: object / abstract / scene / style
      </div>

      {/* Paired scatter — full width */}
      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">Per-prompt score scatter</span>
          <span className="ps">above diagonal → FLUX better · below → SD better · scroll to zoom · drag to pan</span>
          <span className="rq-badge rq4">RQ4</span>
        </div>
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:8 }}>
          Each dot = one prompt run through both models. X = SD 1.x score, Y = FLUX.1 score. Dots above the dashed line = FLUX did better on that prompt. Colored by the overall type of prompt. 👆 Click any dot to see the prompt and both images side by side.
        </div>
        <div className="legend-row" style={{ marginBottom:8 }}>
          <div className="leg"><div className="ld" style={{ background:'#7F77DD' }} /><span>Character</span></div>
          <div className="leg"><div className="ld" style={{ background:'#378ADD' }} /><span>Object</span></div>
          <div className="leg"><div className="ld" style={{ background:'#1D9E75' }} /><span>Scene</span></div>
          <div className="leg"><div className="ld" style={{ background:'#D85A30' }} /><span>Abstract</span></div>
          <div className="leg"><div className="ld" style={{ background:'#BA7517' }} /><span>Style only</span></div>
        </div>
        <PairedScatterChart
          data={scatter}
          onPointClick={p => setSelectedPoint(prev => prev?.sd_image === p.sd_image ? null : p)}
          selectedPoint={selectedPoint}
        />
      </div>

      {/* Selected point detail */}
      {selectedPoint && (
        <div className="panel panel-full">
          <div className="ph">
            <span className="pt">Selected prompt</span>
            <span className="ps" style={{ cursor:'pointer', color:'var(--color-accent)' }}
              onClick={() => setSelectedPoint(null)}>✕ clear</span>
          </div>
          <div style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:12, lineHeight:1.6 }}>
            {selectedPoint.prompt}
          </div>
          <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>
                SD 1.x — <strong style={{ color:'var(--color-text-primary)' }}>{selectedPoint.sd_score.toFixed(3)}</strong>
              </div>
              <img src={selectedPoint.sd_image_url ?? ''} width={140} height={140}
                style={{ objectFit:'cover', borderRadius:6, display:'block' }}
                onError={e => { e.target.style.cssText='width:140px;height:140px;background:#E8E6E0;border-radius:6px'; e.target.src='' }}
              />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:4 }}>
                FLUX.1 — <strong style={{ color:'var(--color-text-primary)' }}>{selectedPoint.flux_score.toFixed(3)}</strong>
              </div>
              <img src={selectedPoint.flux_image_url ?? ''} width={140} height={140}
                style={{ objectFit:'cover', borderRadius:6, display:'block' }}
                onError={e => { e.target.style.cssText='width:140px;height:140px;background:#E8E6E0;border-radius:6px'; e.target.src='' }}
              />
            </div>
            <div style={{ fontSize:13, lineHeight:2 }}>
              <div>
                <span style={{ color:'var(--color-text-tertiary)' }}>Δ (FLUX − SD) </span>
                <strong style={{ color: selectedPoint.flux_score > selectedPoint.sd_score ? '#1D9E75' : '#D85A30' }}>
                  {selectedPoint.flux_score - selectedPoint.sd_score >= 0 ? '+' : ''}
                  {(selectedPoint.flux_score - selectedPoint.sd_score).toFixed(4)}
                </strong>
              </div>
              <div>
                <span style={{ color:'var(--color-text-tertiary)' }}>Winner </span>
                <strong>{selectedPoint.flux_score > selectedPoint.sd_score ? 'FLUX.1' : 'SD 1.x'}</strong>
              </div>
              <div>
                <span style={{ color:'var(--color-text-tertiary)' }}>Prompt type </span>
                <strong>{selectedPoint.concept_type}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare gallery */}
      <div className="panel panel-full">
        <div className="ph">
          <span className="pt">Sample pairs — largest score gap</span>
          <span className="ps">SD 1.x left · FLUX.1 right</span>
        </div>
        <CompareGallery pairs={scatter.slice(0, 50)} />
      </div>

    </div>
  )
}