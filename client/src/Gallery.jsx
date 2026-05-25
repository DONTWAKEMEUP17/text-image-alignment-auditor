import { useState, useEffect } from 'react'
import { api } from './api'
import { scoreColor, conceptScoreBarColor } from './data'

// ── helpers ─────────────────────────────────────────────────────
function imgId(item, model) {
  return model === 'flux' ? item.filename : item.image_name
}

// ── Single gallery card ─────────────────────────────────────────
function GalleryCard({ item, model, isSelected, onClick }) {
  const isFlux = model === 'flux'
  const sc  = scoreColor(item.clip_score ?? 0)
  const src = api.imageUrl(isFlux ? item.filename : item.image_name, model)
  return (
    <div className={`gc${isSelected ? ' selected' : ''}`} onClick={onClick}>
      <img
        src={src}
        alt={item.prompt?.slice(0, 40) ?? ''}
        width={72} height={72}
        style={{ objectFit:'cover', borderRadius:4, display:'block' }}
        onError={e => { e.target.style.cssText = 'width:72px;height:72px;background:#2a2a2a;border-radius:4px'; e.target.src = '' }}
      />
      <span className="sb" style={{ background:sc.bg, color:sc.tx }}>
        {item.clip_score?.toFixed(3) ?? '—'}
      </span>
      <span className={`mb-tag ${isFlux ? 'm-new' : 'm-old'}`}>{isFlux ? 'FLUX' : 'SD1'}</span>
    </div>
  )
}

// ── ImageGallery — main gallery for RQ1+2 ──────────────────────
// brushBin:    bin_start float | null  → filter min_score/max_score
// selectedCat: concept_category string | null → filter concept_type
// selectedImg: image object | null
// onSelect:    (image object | null) => void
export function ImageGallery({ model, brushBin, selectedImg, onSelect }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const opts = { limit: 50, sort: 'clip_score', order: 'asc' }

    if (brushBin !== null && brushBin !== undefined) {
      const binWidth = 0.02
      opts.min_score = brushBin.toFixed(4)
      opts.max_score = (brushBin + binWidth).toFixed(4)
    }

    api.images(model, opts)
      .then(data => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [model, brushBin])

  if (loading) return (
    <div style={{ padding:'24px 0', textAlign:'center', fontSize:12, color:'var(--color-text-tertiary)' }}>
      Loading images…
    </div>
  )

  return (
    <div className="gal">
      {items.map(item => (
        <GalleryCard
          key={imgId(item, model)}
          item={item}
          model={model}
          isSelected={selectedImg && imgId(selectedImg, model) === imgId(item, model)}
          onClick={() => {
            const alreadySelected = selectedImg && imgId(selectedImg, model) === imgId(item, model)
            onSelect(alreadySelected ? null : item)
          }}
        />
      ))}
      {items.length === 0 && (
        <div style={{ gridColumn:'1/-1', padding:'24px 0', textAlign:'center', fontSize:12, color:'var(--color-text-tertiary)' }}>
          No images in this range
        </div>
      )}
    </div>
  )
}

// ── CompareGallery — SD1|FLUX pairs for RQ4 ────────────────────
// pairs: [{sd_image, flux_image, sd_score, flux_score, prompt}]
export function CompareGallery({ pairs }) {
  if (!pairs?.length) return (
    <div style={{ padding:'24px 0', textAlign:'center', fontSize:12, color:'var(--color-text-tertiary)' }}>
      Loading pairs…
    </div>
  )
  return (
    <div className="gal">
      {pairs.slice(0, 10).flatMap((p, i) => [
        <GalleryCard
          key={`sd-${i}`}
          item={{ image_name:p.sd_image, clip_score:p.sd_score, prompt:p.prompt }}
          model="sd1" isSelected={false} onClick={() => {}}
        />,
        <GalleryCard
          key={`fx-${i}`}
          item={{ filename:p.flux_image, clip_score:p.flux_score, prompt:p.prompt }}
          model="flux" isSelected={false} onClick={() => {}}
        />,
      ])}
    </div>
  )
}

// ── DetailPanel — per-concept scores for selected image ─────────
// selectedImg: image object | null
// model:       'sd1' | 'flux'
export function DetailPanel({ selectedImg, model }) {
  const [concepts, setConcepts] = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!selectedImg) { setConcepts([]); return }
    const id = imgId(selectedImg, model)
    setLoading(true)
    api.imageConcepts(id, model)
      .then(data => { setConcepts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedImg, model])

  if (!selectedImg) return (
    <div className="detail-empty">
      <span>Select an image</span>
      <span style={{ fontSize:10 }}>to see per-concept scores</span>
    </div>
  )

  const maxS = concepts.length ? Math.max(...concepts.map(c => c.concept_clip_score)) : 1

  return (
    <div>
      {/* Thumbnail + prompt */}
      <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
        <img
          src={api.imageUrl(imgId(selectedImg, model), model)}
          alt="" width={56} height={56}
          style={{ objectFit:'cover', borderRadius:4, flexShrink:0 }}
          onError={e => { e.target.style.cssText = 'width:56px;height:56px;background:#2a2a2a;border-radius:4px'; e.target.src = '' }}
        />
        <div style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.5 }}>
          {selectedImg.prompt?.slice(0, 100) ?? ''}
          {(selectedImg.prompt?.length ?? 0) > 100 ? '…' : ''}
        </div>
      </div>

      {loading && (
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', padding:'8px 0' }}>
          Loading concepts…
        </div>
      )}

      {concepts.map((c, i) => (
        <div key={i} className="cbar-row">
          <span className="cbl">{c.concept_text}</span>
          <div className="cbt">
            <div className="cbf" style={{
              width:`${Math.round((c.concept_clip_score / maxS) * 100)}%`,
              background: conceptScoreBarColor(c.concept_clip_score),
            }} />
          </div>
          <span className="cbv">{c.concept_clip_score.toFixed(3)}</span>
          {c.concept_clip_score < 0.18 && <span className="fail-tag">fail</span>}
        </div>
      ))}
    </div>
  )
}
