import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { textColor, gridColor, scoreBarColor, conceptScoreBarColor, CFG_CAT_LABELS } from './data'

// ── Shared ResizeObserver hook ─────────────────────────────────
function useResizeDraw(wrapRef, draw) {
  useEffect(() => { draw() }, [draw])
  useEffect(() => {
    const ro = new ResizeObserver(() => draw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [draw, wrapRef])
}

// ──────────────────────────────────────────────────────────────
// HistogramChart — D3 brushable (RQ1)
// data:     [{bin_start: number, count: number}]
// brushBin: bin_start float | null
// onBrush:  (bin_start | null) => void
// ──────────────────────────────────────────────────────────────
export function HistogramChart({ data, brushBin, onBrush }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)
  const cbRef   = useRef(onBrush)
  useEffect(() => { cbRef.current = onBrush }, [onBrush])

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data?.length) return
    const W = wrapRef.current.clientWidth || 300
    const H = 100, M = { t:8, r:4, b:16, l:4 }
    const cw = W - M.l - M.r, ch = H - M.t - M.b
    const maxVal = d3.max(data, d => d.count)
    const barW   = cw / data.length

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)

    svg.selectAll('rect.bin')
      .data(data, d => d.bin_start)
      .join('rect').attr('class', 'bin')
      .attr('x',       (_, i) => M.l + i * barW + 1)
      .attr('width',   barW - 2)
      .attr('y',       d => M.t + ch - Math.round((d.count / maxVal) * ch))
      .attr('height',  d => Math.round((d.count / maxVal) * ch))
      .attr('rx', 2)
      .attr('fill',    d => scoreBarColor(d.bin_start))
      .attr('opacity', d => brushBin === null || brushBin === d.bin_start ? 0.85 : 0.18)
      .style('cursor', 'pointer')
      .on('click', (_, d) => cbRef.current(brushBin === d.bin_start ? null : d.bin_start))

    // X-axis: first / middle / last bin_start
    const first = data[0].bin_start, last = data[data.length - 1].bin_start
    const mid   = data[Math.floor(data.length / 2)].bin_start
    svg.selectAll('text.xl')
      .data([first, mid, last])
      .join('text').attr('class', 'xl')
      .attr('x', v => M.l + ((v - first) / ((last - first) || 1)) * cw)
      .attr('y', H - 2)
      .attr('text-anchor', (_, i) => i === 0 ? 'start' : i === 2 ? 'end' : 'middle')
      .attr('font-size', 10).attr('fill', textColor())
      .text(v => v.toFixed(2))
  }, [data, brushBin])

  useResizeDraw(wrapRef, draw)

  const binWidth = data?.length >= 2 ? (data[1].bin_start - data[0].bin_start) : 0.02

  return (
    <div ref={wrapRef} style={{ width:'100%' }}>
      <svg ref={svgRef} style={{ width:'100%', display:'block' }} />
      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', textAlign:'center', marginTop:4 }}>
        {brushBin !== null
          ? `Filtered: ${brushBin.toFixed(2)} – ${(brushBin + binWidth).toFixed(2)} · click to clear`
          : 'Click a bar to filter the gallery by score range'}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ConceptFailureBar — sorted worst→best (RQ2)
// cats:     [{concept_category, mean, n}]  (from /api/rq2/by-category)
// selected: concept_category string | null
// onSelect: fn
// ──────────────────────────────────────────────────────────────
export function ConceptFailureBar({ cats, selected, onSelect }) {
  if (!cats?.length) return (
    <div style={{ fontSize:12, color:'var(--color-text-tertiary)', padding:16 }}>Loading…</div>
  )
  const sorted = [...cats].sort((a, b) => a.mean - b.mean)
  const maxVal = Math.max(...sorted.map(d => d.mean), 0.001)
  return (
    <div>
      {sorted.map(d => {
        const s = d.mean
        const label = CFG_CAT_LABELS[d.concept_category] || d.concept_category
        return (
          <div key={d.concept_category}
            className={`bar-row${selected === d.concept_category ? ' selected' : ''}`}
            onClick={() => onSelect?.(selected === d.concept_category ? null : d.concept_category)}>
            <span className="bl">{label}</span>
            <div className="bt">
              <div className="bf" style={{
                width: `${Math.round((s / maxVal) * 100)}%`,
                background: conceptScoreBarColor(s),
              }} />
            </div>
            <span className="bv">{s.toFixed(3)}</span>
            <span className="bv" style={{ fontSize:10, color:'var(--color-text-tertiary)', marginLeft:2 }}>
              (n={d.n?.toLocaleString()})
            </span>
            {s < 0.20 && <span className="fail-tag">fail</span>}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// CFGLineChart — D3 multi-line (RQ3)
// lines:      [{category, label, color, scores: (number|null)[]}]
// bins:       string[]  (cfg_bin labels in display order)
// maxBinIdx:  number    (0-based slider max; show bins[0..maxBinIdx])
// ──────────────────────────────────────────────────────────────
export function CFGLineChart({ lines, bins, maxBinIdx }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !lines?.length || !bins?.length) return
    const n = Math.min(maxBinIdx + 1, bins.length)
    const W = wrapRef.current.clientWidth || 300
    const H = 180, M = { l:44, r:12, t:10, b:28 }
    const cw = W - M.l - M.r, ch = H - M.t - M.b

    const allScores = lines.flatMap(l => l.scores.slice(0, n)).filter(s => s != null)
    if (!allScores.length) return
    const yMin = Math.max(0, d3.min(allScores) - 0.005)
    const yMax = d3.max(allScores) + 0.005

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
      .append('g').attr('transform', `translate(${M.l},${M.t})`)

    // Grid + y-axis
    for (let g = 0; g <= 4; g++) {
      const yFrac = g / 4
      const yv = yMin + yFrac * (yMax - yMin)
      const y  = ch - yFrac * ch
      svg.append('line').attr('x1', 0).attr('y1', y).attr('x2', cw).attr('y2', y)
        .attr('stroke', gridColor()).attr('stroke-width', 0.5)
      svg.append('text').attr('x', -4).attr('y', y + 4).attr('text-anchor', 'end')
        .attr('font-size', 10).attr('fill', textColor()).text(yv.toFixed(3))
    }

    // X-axis labels
    bins.slice(0, n).forEach((b, i) => {
      svg.append('text')
        .attr('x', (i / ((n - 1) || 1)) * cw).attr('y', ch + 20)
        .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', textColor()).text(b)
    })

    const lineGen = d3.line()
      .x((_, i) => (i / ((n - 1) || 1)) * cw)
      .y(d => ch - ((d - yMin) / ((yMax - yMin) || 1)) * ch)
      .defined(d => d != null)
      .curve(d3.curveMonotoneX)

    lines.forEach(cat => {
      const scores = cat.scores.slice(0, n)
      svg.append('path').datum(scores)
        .attr('fill', 'none').attr('stroke', cat.color)
        .attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('d', lineGen)
      const lastValid = scores.map((s, i) => [s, i]).filter(([s]) => s != null).at(-1)
      if (lastValid) {
        const [s, i] = lastValid
        svg.append('circle')
          .attr('cx', (i / ((n - 1) || 1)) * cw)
          .attr('cy', ch - ((s - yMin) / ((yMax - yMin) || 1)) * ch)
          .attr('r', 3.5).attr('fill', cat.color)
      }
    })
  }, [lines, bins, maxBinIdx])

  useResizeDraw(wrapRef, draw)
  return (
    <div ref={wrapRef} style={{ width:'100%' }}>
      <svg ref={svgRef} style={{ width:'100%', display:'block' }} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// GainBarChart — CFG gain per concept category (RQ3)
// gains: [{label, gain, color}]
// ──────────────────────────────────────────────────────────────
export function GainBarChart({ gains }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !gains?.length) return
    const W = wrapRef.current.clientWidth || 300
    const bh = 18, gap = 7, lw = 108, pad = 10
    const H = pad + gains.length * (bh + gap) + pad
    const maxGain = Math.max(...gains.map(d => d.gain), 0.001)
    const avail = W - lw - 44

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)

    gains.forEach((d, i) => {
      const y  = pad + i * (bh + gap)
      const bw = Math.max(3, (d.gain / maxGain) * avail)
      svg.append('text').attr('x', lw - 3).attr('y', y + bh / 2 + 4)
        .attr('text-anchor', 'end').attr('font-size', 11).attr('fill', textColor()).text(d.label)
      svg.append('rect').attr('x', lw).attr('y', y)
        .attr('width', bw).attr('height', bh).attr('rx', 3).attr('fill', d.color)
      svg.append('text').attr('x', lw + bw + 6).attr('y', y + bh / 2 + 4)
        .attr('font-size', 11).attr('font-weight', 500).attr('fill', textColor())
        .text(`+${d.gain.toFixed(4)}`)
    })
  }, [gains])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}

// ──────────────────────────────────────────────────────────────
// DeltaList — FLUX − SD1 deltas (RQ4)
// deltas: [{label, delta}]  (delta = flux_mean - sd_mean)
// ──────────────────────────────────────────────────────────────
export function DeltaList({ deltas }) {
  if (!deltas?.length) return null
  const maxAbs = Math.max(...deltas.map(d => Math.abs(d.delta)), 0.001)
  return (
    <div>
      {deltas.map(d => {
        const pct = Math.round((Math.abs(d.delta) / maxAbs) * 48)
        const pos = d.delta >= 0
        return (
          <div key={d.label} className="delta-row">
            <span className="dc">{d.label}</span>
            <div className="dt">
              <div className="mid-line" />
              <div className={pos ? 'db-pos' : 'db-neg'} style={{ width:`${pct}%` }} />
            </div>
            <span className="dv" style={{ color: pos ? '#1D9E75' : '#D85A30' }}>
              {pos ? '+' : ''}{d.delta.toFixed(4)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// GroupedBarChart — SD1x vs FLUX side by side (RQ4)
// cats: [{label, sd1, flux}]
// ──────────────────────────────────────────────────────────────
export function GroupedBarChart({ cats }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !cats?.length) return
    const W = wrapRef.current.clientWidth || 600
    const bh = 10, gap = 5, grpGap = 14, lw = 112, pad = 10
    const H = pad + cats.length * (bh * 2 + gap + grpGap) + pad
    const maxVal = Math.max(...cats.flatMap(d => [d.sd1, d.flux]), 0.001)
    const avail  = W - lw - 36

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)

    cats.forEach((d, i) => {
      const y = pad + i * (bh * 2 + gap + grpGap)
      svg.append('text').attr('x', lw - 3).attr('y', y + bh + 4)
        .attr('text-anchor', 'end').attr('font-size', 11).attr('fill', textColor()).text(d.label)
      // SD bar
      svg.append('rect').attr('x', lw).attr('y', y)
        .attr('width', (d.sd1 / maxVal) * avail).attr('height', bh).attr('rx', 2).attr('fill', '#378ADD')
      svg.append('text').attr('x', lw + (d.sd1 / maxVal) * avail + 5).attr('y', y + bh / 2 + 4)
        .attr('font-size', 10).attr('fill', textColor()).text(d.sd1.toFixed(4))
      // FLUX bar
      svg.append('rect').attr('x', lw).attr('y', y + bh + gap)
        .attr('width', (d.flux / maxVal) * avail).attr('height', bh).attr('rx', 2).attr('fill', '#1D9E75')
      svg.append('text').attr('x', lw + (d.flux / maxVal) * avail + 5).attr('y', y + bh + gap + bh / 2 + 4)
        .attr('font-size', 10).attr('fill', textColor()).text(d.flux.toFixed(4))
    })
  }, [cats])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}

// ──────────────────────────────────────────────────────────────
// PairedScatterChart — SD score vs FLUX score (RQ4)
// data: [{sd_score, flux_score, concept_type}]
// Points above diagonal → FLUX better; below → SD better
// ──────────────────────────────────────────────────────────────
export function PairedScatterChart({ data }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data?.length) return
    const W = wrapRef.current.clientWidth || 400
    const H = Math.min(Math.round(W * 0.65), 300)
    const M = { l:44, r:16, t:12, b:40 }
    const cw = W - M.l - M.r, ch = H - M.t - M.b

    const allV = data.flatMap(d => [d.sd_score, d.flux_score])
    const mn = Math.max(0, d3.min(allV) - 0.01)
    const mx = d3.max(allV) + 0.01
    const xSc = d3.scaleLinear().domain([mn, mx]).range([0, cw])
    const ySc = d3.scaleLinear().domain([mn, mx]).range([ch, 0])

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
      .append('g').attr('transform', `translate(${M.l},${M.t})`)

    // Grid
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => mn + t * (mx - mn))
    ticks.forEach(v => {
      svg.append('line').attr('x1', 0).attr('y1', ySc(v)).attr('x2', cw).attr('y2', ySc(v))
        .attr('stroke', gridColor()).attr('stroke-width', 0.5)
      svg.append('line').attr('x1', xSc(v)).attr('y1', 0).attr('x2', xSc(v)).attr('y2', ch)
        .attr('stroke', gridColor()).attr('stroke-width', 0.5)
      svg.append('text').attr('x', xSc(v)).attr('y', ch + 16)
        .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', textColor()).text(v.toFixed(2))
      svg.append('text').attr('x', -4).attr('y', ySc(v) + 4)
        .attr('text-anchor', 'end').attr('font-size', 9).attr('fill', textColor()).text(v.toFixed(2))
    })

    // Parity line y = x
    svg.append('line')
      .attr('x1', xSc(mn)).attr('y1', ySc(mn))
      .attr('x2', xSc(mx)).attr('y2', ySc(mx))
      .attr('stroke', '#888').attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,3').attr('opacity', 0.45)

    // Points
    const colorMap = {
      object:   '#378ADD',
      abstract: '#D85A30',
      scene:    '#1D9E75',
      style:    '#7F77DD',
    }
    svg.selectAll('circle.pt').data(data).join('circle').attr('class', 'pt')
      .attr('cx', d => xSc(d.sd_score))
      .attr('cy', d => ySc(d.flux_score))
      .attr('r', 2.5)
      .attr('fill', d => colorMap[d.concept_type] || '#888')
      .attr('opacity', 0.45)

    // Axis labels
    svg.append('text').attr('x', cw / 2).attr('y', ch + 32)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', textColor()).text('SD 1.x clip score')
    svg.append('text')
      .attr('transform', `rotate(-90) translate(${-ch / 2}, ${-34})`)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', textColor()).text('FLUX.1 clip score')
  }, [data])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}
