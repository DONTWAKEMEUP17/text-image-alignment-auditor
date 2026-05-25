import { useEffect, useRef } from 'react'
import { PROMPTS, CONCEPT_DATA, PALETTE, scoreColor, scoreBarColor, seededRng } from './data'

// ── fakeImg canvas renderer ─────────────────────────────────
// TODO: replace with <img src={item.image_url}> once backend is ready
function drawFakeImg(canvas, idx, score, isFlux) {
  if (!canvas) return
  const W = canvas.width  = canvas.offsetWidth  || 72
  const H = canvas.height = canvas.offsetHeight || 72
  const ctx = canvas.getContext('2d')
  const col = PALETTE[idx % PALETTE.length]
  const ri = parseInt(col.slice(1,3),16), gi = parseInt(col.slice(3,5),16), bi = parseInt(col.slice(5,7),16)
  const rng = seededRng(idx*17 + (isFlux?5000:0) + 3)
  ctx.fillStyle = `rgb(${Math.round(ri*.2)},${Math.round(gi*.2)},${Math.round(bi*.2)})`
  ctx.fillRect(0,0,W,H)
  for (let i=0; i < (isFlux?7:5); i++) {
    ctx.fillStyle = `rgba(${ri},${gi},${bi},${(rng()*.5+.12).toFixed(2)})`
    ctx.beginPath(); ctx.arc(rng()*W, rng()*H, 14+rng()*28, 0, Math.PI*2); ctx.fill()
  }
  if (score >= 0.65) {
    ctx.fillStyle = `rgba(255,255,255,${(rng()*.18+.05).toFixed(2)})`
    ctx.beginPath(); ctx.arc(W*.25+rng()*W*.5, H*.25+rng()*H*.5, 8+rng()*16, 0, Math.PI*2); ctx.fill()
  }
}

// ── Single gallery card ─────────────────────────────────────
function GalleryCard({ idx, score, isFlux, isSelected, onClick }) {
  const canvasRef = useRef(null)
  const sc = scoreColor(score)
  useEffect(() => {
    requestAnimationFrame(() => drawFakeImg(canvasRef.current, idx, score, isFlux))
  }, [idx, score, isFlux])
  return (
    <div className={`gc${isSelected?' selected':''}`} onClick={onClick}>
      <canvas ref={canvasRef} width={72} height={72} />
      <span className="sb" style={{ background:sc.bg, color:sc.tx }}>{score.toFixed(2)}</span>
      <span className={`mb-tag ${isFlux?'m-new':'m-old'}`}>{isFlux?'FLUX':'SD1'}</span>
    </div>
  )
}

// ── ImageGallery — main gallery for RQ1+2 ──────────────────
// Props: model, brushBin, selectedImg, onSelect
export function ImageGallery({ model, brushBin, selectedImg, onSelect }) {
  const isFlux = model === 'flux'
  const items  = PROMPTS.map((_, i) => ({
    idx: i,
    score: isFlux ? 0.42 + Math.sin(i)*.18 + .1 : 0.35 + Math.sin(i)*.18,
  }))
  const visible = brushBin === null ? items
    : items.filter(({ score }) => Math.floor(score*10) === brushBin)

  return (
    <div className="gal">
      {visible.map(({ idx, score }) => (
        <GalleryCard key={idx} idx={idx} score={score} isFlux={isFlux}
          isSelected={selectedImg===idx} onClick={() => onSelect(idx)} />
      ))}
      {visible.length === 0 && (
        <div style={{ gridColumn:'1/-1', padding:'24px 0', textAlign:'center',
          fontSize:12, color:'var(--color-text-tertiary)' }}>
          No images in this score range
        </div>
      )}
    </div>
  )
}

// ── CompareGallery — SD1 | FLUX pairs for RQ4 ──────────────
export function CompareGallery() {
  return (
    <div className="gal">
      {PROMPTS.slice(0,5).flatMap((_, i) => [
        <GalleryCard key={`sd1-${i}`} idx={i}    score={0.35+Math.sin(i)*.1} isFlux={false} isSelected={false} onClick={()=>{}} />,
        <GalleryCard key={`fx-${i}`}  idx={i+50} score={0.52+Math.sin(i)*.1} isFlux={true}  isSelected={false} onClick={()=>{}} />,
      ])}
    </div>
  )
}

// ── DetailPanel — per-concept scores for selected image ─────
// Props: selectedImg number|null, model string
export function DetailPanel({ selectedImg, model }) {
  if (selectedImg === null) {
    return (
      <div className="detail-empty">
        <span>Select an image</span>
        <span style={{ fontSize:10 }}>to see per-concept scores</span>
      </div>
    )
  }
  const isFlux   = model === 'flux'
  const concepts = CONCEPT_DATA[selectedImg % CONCEPT_DATA.length]
  const scored   = concepts.map(c => ({
    ...c,
    s: Math.min(.99, c.s + (c.cat==='spatial' && isFlux ? .12 : isFlux ? .04 : 0)),
  }))
  const maxS = Math.max(...scored.map(c => c.s))
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:8, lineHeight:1.5 }}>
        {PROMPTS[selectedImg]?.slice(0,72)}…
      </div>
      {scored.map((c,i) => (
        <div key={i} className="cbar-row">
          <span className="cbl">{c.t}</span>
          <div className="cbt"><div className="cbf" style={{ width:`${Math.round((c.s/maxS)*100)}%`, background:scoreBarColor(c.s) }} /></div>
          <span className="cbv">{c.s.toFixed(2)}</span>
          {c.s < 0.45 && <span className="fail-tag">fail</span>}
        </div>
      ))}
    </div>
  )
}
