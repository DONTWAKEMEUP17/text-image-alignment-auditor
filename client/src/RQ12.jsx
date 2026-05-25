import { useState, useEffect } from 'react'
import { HistogramChart, ConceptFailureBar } from './Charts'
import { ImageGallery, DetailPanel } from './Gallery'
import { api } from './api'

// brushBin:    bin_start float | null
// selectedImg: image object | null
export default function RQ12View({
  model, brushBin, onBrush,
  selectedCat, onSelectCat,
  selectedImg, onSelectImg,
}) {
  const [histData, setHistData] = useState([])
  const [catData,  setCatData]  = useState([])
  const [stats,    setStats]    = useState(null)

  // Fetch histogram on model change
  useEffect(() => {
    api.distribution(model)
      .then(setHistData)
      .catch(console.error)
  }, [model])

  // Fetch category breakdown on model change
  useEffect(() => {
    api.byCategory(model)
      .then(setCatData)
      .catch(console.error)
  }, [model])

  // Fetch dataset stats once
  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
  }, [])

  const totalImages = stats
    ? (model === 'flux' ? stats.flux_images : stats.sd_images)?.toLocaleString()
    : '…'

  const filterDesc = [
    brushBin !== null ? `score ${brushBin.toFixed(2)}–${(brushBin + 0.02).toFixed(2)}` : '',
    selectedCat       ? selectedCat.replace('_', ' ')                                   : '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="view v-rq12 active">

      {/* RQ1 — Score distribution histogram */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Alignment score distribution</span>
          <span className="rq-badge rq1">RQ1</span>
          <span className="ps">{totalImages} images</span>
        </div>
        <HistogramChart data={histData} brushBin={brushBin} onBrush={onBrush} />
      </div>

      {/* RQ2 — Concept category failure bar */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Concept category scores</span>
          <span className="rq-badge rq2">RQ2</span>
          <span className="ps">click to filter gallery</span>
        </div>
        <ConceptFailureBar cats={catData} selected={selectedCat} onSelect={onSelectCat} />
      </div>

      {/* Gallery */}
      <div className="panel">
        <div className="ph">
          <span className="pt">Image gallery</span>
          {filterDesc && <span className="ps">{filterDesc}</span>}
        </div>
        <ImageGallery
          model={model}
          brushBin={brushBin}
          selectedCat={selectedCat}
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
        <DetailPanel selectedImg={selectedImg} model={model} />
      </div>

    </div>
  )
}
