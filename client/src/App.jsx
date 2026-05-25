import { useState } from 'react'
import RQ12View from './RQ12'
import RQ3View  from './RQ3'
import RQ4View  from './RQ4'

export default function App() {
  const [model,       setModel]       = useState('sd1')
  const [activeRQ,    setActiveRQ]    = useState(12)
  const [brushBin,    setBrushBin]    = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedImg, setSelectedImg] = useState(null)

  const isRQ4 = activeRQ === 4

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

      {/* Top bar */}
      <div className="topbar">
        <span className="app-title">Alignment auditor</span>
        <span className="toggle-label">Viewing:</span>

        <div className="model-toggle" style={{ opacity:isRQ4?.35:1, pointerEvents:isRQ4?'none':'auto' }}>
          {['sd1','flux'].map(m => (
            <button key={m} className={`mt-btn${model===m?' active':''}`} onClick={() => setModel(m)}>
              {m==='sd1'?'SD 1.x':'FLUX.1'}
            </button>
          ))}
        </div>

        {isRQ4 && <span className="rq4-note">RQ4 always shows both models</span>}

        <div className="rq-tabs">
          {RQ_TABS.map(({ rq, label }) => (
            <button key={rq} className={`rq-tab${activeRQ===rq?' active':''}`} onClick={() => switchRQ(rq)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active view */}
      {activeRQ===12 && <RQ12View model={model} brushBin={brushBin} onBrush={setBrushBin}
        selectedCat={selectedCat} onSelectCat={setSelectedCat}
        selectedImg={selectedImg} onSelectImg={setSelectedImg} />}
      {activeRQ===3  && <RQ3View  model={model} />}
      {activeRQ===4  && <RQ4View  />}

      {/* Status bar */}
      <div className="statusbar">
        <div className="sc">Viewing <span>{model==='flux'?'FLUX.1':'SD 1.x'}</span></div>
        <div className="sc">RQ <span>{activeRQ===12?'1+2':activeRQ}</span></div>
        <div className="sc">Toggle affects <span>{isRQ4?'N/A (both always shown)':'RQ1, RQ2, RQ3'}</span></div>
      </div>

    </div>
  )
}
