import { HistogramChart, ConceptFailureBar } from './Charts'
import { ImageGallery, DetailPanel } from './Gallery'
import { HIST_BINS, CATS, PROMPTS } from './data'

export default function RQ12View({ model, brushBin, onBrush, selectedCat, onSelectCat, selectedImg, onSelectImg }) {
  return (
    <div className="view v-rq12 active">

      <div className="panel">
        <div className="ph"><span className="pt">Score distribution</span><span className="rq-badge rq1">RQ1</span></div>
        <HistogramChart data={HIST_BINS[model]} brushBin={brushBin} onBrush={onBrush} />
      </div>

      <div className="panel">
        <div className="ph"><span className="pt">Concept failure map</span><span className="rq-badge rq2">RQ2</span></div>
        <ConceptFailureBar cats={CATS} model={model} selected={selectedCat} onSelect={onSelectCat} />
      </div>

      <div className="panel">
        <div className="ph">
          <span className="pt">Image gallery</span>
          <span className="ps">{brushBin !== null ? `Filtered to bin ${brushBin}` : `Showing ${PROMPTS.length} pairs`}</span>
        </div>
        <ImageGallery model={model} brushBin={brushBin} selectedImg={selectedImg} onSelect={onSelectImg} />
      </div>

      <div className="panel">
        <div className="ph"><span className="pt">Concept breakdown</span><span className="ps">click an image</span></div>
        <DetailPanel selectedImg={selectedImg} model={model} />
      </div>

    </div>
  )
}
