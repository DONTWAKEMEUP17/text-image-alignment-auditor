import { DeltaList, GroupedBarChart } from './Charts'
import { CompareGallery } from './Gallery'
import { CATS } from './data'

export default function RQ4View() {
  return (
    <div className="view v-rq4 active">

      <div className="panel">
        <div className="ph"><span className="pt">Score delta: FLUX.1 − SD 1.x</span><span className="rq-badge rq4">RQ4</span></div>
        <div className="hint">Green = FLUX.1 improved. Wider bar = bigger gap.</div>
        <DeltaList cats={CATS} />
        <div className="finding" style={{ marginTop:10 }}>
          <strong>Key finding:</strong> Spatial relationships improve most (+0.12) — FLUX.1 better handles
          compositional structure. Emotion adjectives barely improve (+0.03), confirming a fundamental grounding problem.
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="pt">Same prompt, both models</span><span className="rq-badge rq4">RQ4</span></div>
        <div className="hint">Each column pair = one prompt. Left = SD 1.x, right = FLUX.1.</div>
        <CompareGallery />
      </div>

      <div className="panel panel-full">
        <div className="ph"><span className="pt">All concept categories — SD 1.x vs FLUX.1</span><span className="rq-badge rq4">RQ4</span></div>
        <GroupedBarChart cats={CATS} />
        <div className="legend-row">
          <div className="leg"><div className="ld" style={{ background:'#378ADD' }} /><span>SD 1.x</span></div>
          <div className="leg"><div className="ld" style={{ background:'#1D9E75' }} /><span>FLUX.1 [schnell]</span></div>
        </div>
      </div>

    </div>
  )
}
