import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { scoreBarColor, textColor, gridColor, CFG_BINS, CFG_SCORES, CFG_CAT_LINES, CFG_GAINS } from './data'

// ── shared ResizeObserver hook ─────────────────────────────────
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
// Props: data number[], brushBin number|null, onBrush fn
// ──────────────────────────────────────────────────────────────
export function HistogramChart({ data, brushBin, onBrush }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)
  const cbRef   = useRef(onBrush)
  useEffect(() => { cbRef.current = onBrush }, [onBrush])

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !data?.length) return
    const W = wrapRef.current.clientWidth || 300
    const H = 100, M = { t:8, r:4, b:0, l:4 }
    const cw = W - M.l - M.r, ch = H - M.t - M.b
    const maxVal = d3.max(data), barW = cw / data.length

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)

    svg.selectAll('rect.bin')
      .data(data.map((v, i) => ({ v, i })), d => d.i)
      .join('rect').attr('class', 'bin')
      .attr('x',       d => M.l + d.i * barW + 1)
      .attr('width',   barW - 2)
      .attr('y',       d => M.t + ch - Math.round((d.v / maxVal) * ch))
      .attr('height',  d => Math.round((d.v / maxVal) * ch))
      .attr('rx', 2).attr('fill', d => scoreBarColor(d.i / data.length))
      .attr('opacity', d => brushBin === null || brushBin === d.i ? 0.85 : 0.18)
      .style('cursor', 'pointer')
      .on('click', (_, d) => cbRef.current(brushBin === d.i ? null : d.i))

    const labels = ['0.0','0.25','0.5','0.75','1.0']
    svg.selectAll('text.xl').data(labels).join('text').attr('class','xl')
      .attr('x', (d,i) => M.l + [0,.25,.5,.75,1][i] * cw)
      .attr('y', H - 2)
      .attr('text-anchor', (d,i) => i===0?'start':i===4?'end':'middle')
      .attr('font-size', 10).attr('fill', textColor()).text(d => d)
  }, [data, brushBin])

  useResizeDraw(wrapRef, draw)

  return (
    <div ref={wrapRef} style={{ width:'100%' }}>
      <svg ref={svgRef} style={{ width:'100%', display:'block' }} />
      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', textAlign:'center', marginTop:4 }}>
        {brushBin !== null
          ? `Filtered: ${(brushBin*.1).toFixed(1)}–${((brushBin+1)*.1).toFixed(1)} · click to clear`
          : 'Click a bar to filter gallery'}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// ConceptFailureBar — sorted worst→best, fail badges (RQ2)
// Props: cats CATS[], model string, selected string|null, onSelect fn
// ──────────────────────────────────────────────────────────────
export function ConceptFailureBar({ cats, model, selected, onSelect }) {
  const sorted = [...cats].sort((a,b) => (model==='flux'?a.flux:a.sd1) - (model==='flux'?b.flux:b.sd1))
  return (
    <div>
      {sorted.map(d => {
        const s = model === 'flux' ? d.flux : d.sd1
        return (
          <div key={d.id} className={`bar-row${selected===d.id?' selected':''}`}
            onClick={() => onSelect?.(selected===d.id ? null : d.id)}>
            <span className="bl">{d.label}</span>
            <div className="bt"><div className="bf" style={{ width:`${Math.round(s*100)}%`, background:scoreBarColor(s) }} /></div>
            <span className="bv">{s.toFixed(2)}</span>
            {s < 0.45 && <span className="fail-tag">fail</span>}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// CFGLineChart — D3 multi-line, cfgMax slider (RQ3)
// Props: cfgMax number, model string
// ──────────────────────────────────────────────────────────────
export function CFGLineChart({ cfgMax, model }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return
    const W = wrapRef.current.clientWidth || 300
    const H = 160, M = { l:34, r:10, t:10, b:26 }
    const cw = W-M.l-M.r, ch = H-M.t-M.b
    const isFlux = model === 'flux'
    const bins = CFG_BINS.filter(b => b <= cfgMax), n = bins.length

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width',W).attr('height',H)
      .append('g').attr('transform',`translate(${M.l},${M.t})`)

    // grid + y labels
    for (let g=0; g<=4; g++) {
      const y = ch - (g/4)*ch
      svg.append('line').attr('x1',0).attr('y1',y).attr('x2',cw).attr('y2',y)
        .attr('stroke',gridColor()).attr('stroke-width',.5)
      svg.append('text').attr('x',-3).attr('y',y+4).attr('text-anchor','end')
        .attr('font-size',10).attr('fill',textColor()).text((g*.2+.2).toFixed(1))
    }
    // x labels
    bins.forEach((b,i) => svg.append('text')
      .attr('x',(i/(n-1||1))*cw).attr('y',ch+18).attr('text-anchor','middle')
      .attr('font-size',10).attr('fill',textColor()).text(b))

    const line = d3.line()
      .x((_,i) => (i/(n-1||1))*cw)
      .y(d => ch - ((d-.2)/.8)*ch)
      .curve(d3.curveMonotoneX)

    CFG_CAT_LINES.forEach(cat => {
      const scores = CFG_SCORES[cat.key].slice(0,n).map(s => isFlux ? Math.min(.95,s+.04) : s)
      svg.append('path').datum(scores).attr('fill','none')
        .attr('stroke',cat.color).attr('stroke-width',2).attr('stroke-linecap','round').attr('d',line)
      const lx = ((n-1)/(n-1||1))*cw, ly = ch-((scores[n-1]-.2)/.8)*ch
      svg.append('circle').attr('cx',lx).attr('cy',ly).attr('r',3).attr('fill',cat.color)
    })
  }, [cfgMax, model])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}

// ──────────────────────────────────────────────────────────────
// GainBarChart — CFG 1→20 gains (RQ3)
// ──────────────────────────────────────────────────────────────
export function GainBarChart() {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current) return
    const W = wrapRef.current.clientWidth || 300
    const bh=18, gap=7, lw=104, pad=10
    const H = pad + CFG_GAINS.length*(bh+gap) + pad
    const avail = W - lw - 40

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width',W).attr('height',H)

    CFG_GAINS.forEach((d,i) => {
      const y=pad+i*(bh+gap), bw=Math.max(3,(d.gain/0.22)*avail)
      svg.append('text').attr('x',lw-3).attr('y',y+bh/2+4).attr('text-anchor','end')
        .attr('font-size',11).attr('fill',textColor()).text(d.label)
      svg.append('rect').attr('x',lw).attr('y',y).attr('width',bw).attr('height',bh).attr('rx',3).attr('fill',d.color)
      svg.append('text').attr('x',lw+bw+6).attr('y',y+bh/2+4)
        .attr('font-size',11).attr('font-weight',500).attr('fill',textColor()).text(`+${d.gain.toFixed(2)}`)
    })
  }, [])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}

// ──────────────────────────────────────────────────────────────
// DeltaList — FLUX − SD1 deltas (RQ4)
// Props: cats CATS[]
// ──────────────────────────────────────────────────────────────
export function DeltaList({ cats }) {
  return (
    <div>
      {cats.map(d => {
        const delta = d.flux - d.sd1
        const pct   = Math.round((delta / 0.20) * 48)
        return (
          <div key={d.id} className="delta-row">
            <span className="dc">{d.label}</span>
            <div className="dt">
              <div className="mid-line" />
              <div className="db-pos" style={{ width:`${pct}%` }} />
            </div>
            <span className="dv" style={{ color:'#1D9E75' }}>+{delta.toFixed(2)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// GroupedBarChart — SD1 vs FLUX side by side (RQ4)
// Props: cats CATS[]
// ──────────────────────────────────────────────────────────────
export function GroupedBarChart({ cats }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)

  const draw = useCallback(() => {
    if (!svgRef.current || !wrapRef.current || !cats?.length) return
    const W = wrapRef.current.clientWidth || 600
    const bh=10, gap=5, grpGap=12, lw=108, pad=10
    const H = pad + cats.length*(bh*2+gap+grpGap) + pad
    const avail = W - lw - 28

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width',W).attr('height',H)

    cats.forEach((d,i) => {
      const y = pad + i*(bh*2+gap+grpGap)
      svg.append('text').attr('x',lw-3).attr('y',y+bh+4).attr('text-anchor','end')
        .attr('font-size',11).attr('fill',textColor()).text(d.label)
      svg.append('rect').attr('x',lw).attr('y',y).attr('width',d.sd1*avail).attr('height',bh).attr('rx',2).attr('fill','#378ADD')
      svg.append('text').attr('x',lw+d.sd1*avail+4).attr('y',y+bh/2+4).attr('font-size',10).attr('fill',textColor()).text(d.sd1.toFixed(2))
      svg.append('rect').attr('x',lw).attr('y',y+bh+gap).attr('width',d.flux*avail).attr('height',bh).attr('rx',2).attr('fill','#1D9E75')
      svg.append('text').attr('x',lw+d.flux*avail+4).attr('y',y+bh+gap+bh/2+4).attr('font-size',10).attr('fill',textColor()).text(d.flux.toFixed(2))
    })
  }, [cats])

  useResizeDraw(wrapRef, draw)
  return <div ref={wrapRef} style={{ width:'100%' }}><svg ref={svgRef} style={{ width:'100%', display:'block' }} /></div>
}
