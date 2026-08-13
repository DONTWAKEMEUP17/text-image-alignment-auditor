// ── Palette ────────────────────────────────────────────────────
export const PALETTE = [
  '#378ADD','#D4537E','#1D9E75','#7F77DD',
  '#BA7517','#185FA5','#D85A30','#993556','#0F6E56','#3B6D11',
]

// ── Dark-mode helpers ──────────────────────────────────────────
export const isDark    = () => false   // light theme forced
export const textColor = () => '#4A4945'
export const gridColor = () => 'rgba(0,0,0,0.07)'

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

// ── Concept category metadata (RQ2 + RQ3) ─────────────────────
export const CFG_CAT_COLORS = {
  content_noun:     '#378ADD',
  style_modifier:   '#1D9E75',
  artist_reference: '#D85A30',
  quality_tag:      '#7F77DD',
  other_adjective:  '#BA7517',
  emotion:          '#D4537E',
}
export const CFG_CAT_LABELS = {
  content_noun:     'Content noun',
  style_modifier:   'Style modifier',
  artist_reference: 'Artist reference',
  quality_tag:      'Quality tag',
  other_adjective:  'Other adjective',
  emotion:          'Emotion',
}
// Canonical CFG bin order from the backend
export const CFG_BIN_ORDER = ['01-05','06-08','09-10','11-12','13-15','16+']