import { useState } from 'react'
import RQ12View from './RQ12'
import RQ3View  from './RQ3'
import RQ4View  from './RQ4'

export default function App() {
  const [model,       setModel]       = useState('sd1')
  const [activeRQ,    setActiveRQ]    = useState(12)
  const [brushBin,    setBrushBin]    = useState(null)    // bin_start float | null
  const [selectedCat, setSelectedCat] = useState(null)    // concept_category string | null
  const [selectedImg, setSelectedImg] = useState(null)    // image object | null

  const isRQ4 = activeRQ === 4
  const isRQ3 = activeRQ === 3
  const toggleDisabled = isRQ4 || isRQ3

  function switchRQ(rq) {
    setActiveRQ(rq)
    setBrushBin(null); setSelectedCat(null); setSelectedImg(null)
  }

  const RQ_TABS = [
    { rq:12, label:'RQ1+2 — Distribution & failures' },
    { rq:3,  label:'RQ3 — CFG vs alignment' },
    { rq:4,  label:'RQ4 — Model comparison' },
  ]

  return (
    <div className="app">

      <div className="topbar">
        <span className="app-title">Alignment auditor</span>
        <span className="toggle-label">Viewing:</span>

        <div className="model-toggle"
          style={{ opacity: toggleDisabled ? 0.35 : 1, pointerEvents: toggleDisabled ? 'none' : 'auto' }}>
          {['sd1','flux'].map(m => (
            <button key={m} className={`mt-btn${model===m?' active':''}`} onClick={() => setModel(m)}>
              {m==='sd1' ? 'SD 1.x' : 'FLUX.1'}
            </button>
          ))}
        </div>

        {isRQ4 && <span className="rq4-note">RQ4 always shows both models</span>}
        {isRQ3 && <span className="rq4-note">RQ3 is SD 1.x only — FLUX ignores CFG</span>}

        <div className="rq-tabs">
          {RQ_TABS.map(({ rq, label }) => (
            <button key={rq} className={`rq-tab${activeRQ===rq?' active':''}`} onClick={() => switchRQ(rq)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeRQ===12 && (
        <RQ12View
          model={model}
          brushBin={brushBin}      onBrush={setBrushBin}
          selectedCat={selectedCat} onSelectCat={setSelectedCat}
          selectedImg={selectedImg} onSelectImg={setSelectedImg}
        />
      )}
      {activeRQ===3  && <RQ3View />}
      {activeRQ===4  && <RQ4View />}

      <div className="statusbar">
        <div className="sc">Viewing <span>{model==='flux'?'FLUX.1':'SD 1.x'}</span></div>
        <div className="sc">RQ <span>{activeRQ===12?'1+2':activeRQ}</span></div>
        <div className="sc">
          Toggle affects <span>
            {isRQ4 ? 'N/A (both shown)' : isRQ3 ? 'N/A (SD1x only)' : 'RQ1, RQ2'}
          </span>
        </div>
      </div>

    </div>
  )
}
