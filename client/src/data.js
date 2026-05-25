// ── Palette ────────────────────────────────────────────────────
export const PALETTE = [
  '#378ADD','#D4537E','#1D9E75','#7F77DD',
  '#BA7517','#185FA5','#D85A30','#993556','#0F6E56','#3B6D11',
]

// ── Dark-mode helpers ──────────────────────────────────────────
export const isDark    = () => window.matchMedia('(prefers-color-scheme:dark)').matches
export const textColor = () => isDark() ? '#c2c0b6' : '#5F5E5A'
export const gridColor = () => isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

// ── Image-level clip_score: real range ≈ 0.10 – 0.45 ──────────
export function scoreBarColor(s) {
  return s >= 0.35 ? '#1D9E75' : s >= 0.25 ? '#BA7517' : '#D85A30'
}
export function scoreColor(s) {
  const dark = isDark()
  if (s >= 0.35) return dark ? { bg:'#085041', tx:'#9FE1CB' } : { bg:'#E1F5EE', tx:'#0F6E56' }
  if (s >= 0.25) return dark ? { bg:'#633806', tx:'#FAC775' } : { bg:'#FAEEDA', tx:'#854F0B' }
  return               dark ? { bg:'#712B13', tx:'#F5C4B3' } : { bg:'#FAECE7', tx:'#993C1D' }
}

// ── Concept-level clip_score: real range ≈ 0.03 – 0.40 ────────
export function conceptScoreBarColor(s) {
  return s >= 0.28 ? '#1D9E75' : s >= 0.18 ? '#BA7517' : '#D85A30'
}

// ── CFG chart metadata (RQ3) ───────────────────────────────────
export const CFG_CAT_COLORS = {
  adjective:  '#D85A30',
  noun_chunk: '#378ADD',
}
export const CFG_CAT_LABELS = {
  adjective:  'Adjective',
  noun_chunk: 'Noun chunk',
}
// Canonical CFG bin order from the backend
export const CFG_BIN_ORDER = ['01-05','06-08','09-10','11-12','13-15','16+']
