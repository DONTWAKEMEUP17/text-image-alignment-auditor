import { useState, useEffect } from 'react'
import { HistogramChart, ConceptFailureBar } from './Charts'
import { ImageGallery, DetailPanel } from './Gallery'
import { api } from './api'
import { conceptScoreBarColor, CFG_CAT_LABELS } from './data'

const Hint = ({ children }) => (
  <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:8, lineHeight:1.5 }}>
    {children}
  </div>
)

export default function RQ12View({
  model, brushBin, onBrush,
  selectedCat, onSelectCat,
  selectedImg, onSelectImg,
}) {
  const [histData,    setHistData]    = useState([])
  const [catData,     setCatData]     = useState([])
  const [stats,       setStats]       = useState(null)
  const [topFailures, setTopFailures] = useState([])

  useEffect(() => {
    api.distribution(model).then(setHistData).catch(console.error)
  }, [model])

  useEffect(() => {
    api.byCategory(model).then(setCatData).catch(console.error)
  }, [model])

  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCat) { setTopFailures([]); return }
    api.topFailures(model, selectedCat, 8).then(setTopFailures).catch(console.error)
  }, [selectedCat, model])

  const totalImages = stats
    ? (model === 'flux' ? stats.flux_images : stats.sd_images)?.toLocaleString()
    : '…'

  const brushDesc = brushBin !== null
    ? `score ${brushBin.toFixed(2)}–${(brushBin + 0.02).toFixed(2)}`
    : ''

  return (
    <div className="view v-rq12 active">

      {/* RQ1 — Histogram */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Alignment score distribution</span>
          <span className="rq-badge rq1">RQ1</span>
          <span className="ps">{totalImages} images</span>
        </div>
        <Hint>
          Each bar = how many images scored in that range. Higher score = the model rendered the prompt more accurately.
          {brushBin === null
            ? ' Click a bar to filter the gallery below to that score range.'
            : ' Gallery filtered — click the same bar again to clear.'}
        </Hint>
        <HistogramChart data={histData} brushBin={brushBin} onBrush={onBrush} />
      </div>

      {/* RQ2 — Concept category bars + top failures */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Concept category scores</span>
          <span className="rq-badge rq2">RQ2</span>
          <span className="ps">
            {selectedCat ? `click to clear · ${CFG_CAT_LABELS[selectedCat] ?? selectedCat}` : 'click to inspect'}
          </span>
        </div>
        <Hint>
          How well the model renders each type of word in the prompt.
          {selectedCat
            ? ' Worst individual concepts shown below ↓'
            : '  Click a category to see which specific words the model fails at most.'}
        </Hint>
        <ConceptFailureBar cats={catData} selected={selectedCat} onSelect={onSelectCat} />

        {topFailures.length > 0 && (
          <div style={{ marginTop:12, borderTop:'1px solid var(--color-border)', paddingTop:10 }}>
            <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginBottom:6 }}>
              Worst-scoring concepts — {CFG_CAT_LABELS[selectedCat] ?? selectedCat}
            </div>
            {topFailures.map((f, i) => (
              <div key={i} className="cbar-row">
                <span className="cbl" title={f.concept_text}>{f.concept_text}</span>
                <div className="cbt">
                  <div className="cbf" style={{
                    width:`${Math.round((f.concept_clip_score / 0.40) * 100)}%`,
                    background: conceptScoreBarColor(f.concept_clip_score),
                  }} />
                </div>
                <span className="cbv">{f.concept_clip_score.toFixed(3)}</span>
                {f.concept_clip_score < 0.18 && <span className="fail-tag">fail</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Image gallery</span>
          {brushDesc && <span className="ps">{brushDesc}</span>}
        </div>
        <Hint>
          {brushBin !== null
            ? `Showing images with alignment score ${brushDesc}. `
            : 'Showing all images sorted by lowest score first. '}
           Click any image to see how well each part of its prompt was rendered.
        </Hint>
        <ImageGallery
          model={model}
          brushBin={brushBin}
          selectedImg={selectedImg}
          onSelect={onSelectImg}
        />
      </div>

      {/* Detail panel */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Concept breakdown</span>
          <span className="ps">per-concept CLIP scores</span>
        </div>
        <Hint>
          {selectedImg
            ? 'Each bar = one word or phrase from the prompt. Red = model missed it. Green = model got it right.'
            : 'Select an image to see which words the model rendered well and which it missed.'}
        </Hint>
        <DetailPanel selectedImg={selectedImg} model={model} />
      </div>

    </div>
  )
}