// ── Concept categories ─────────────────────────────────────────
export const CATS = [
  { id: 'subject', label: 'Content nouns', sd1: 0.80, flux: 0.84 },
  { id: 'style',   label: 'Style terms',   sd1: 0.72, flux: 0.76 },
  { id: 'atm',     label: 'Atmosphere',    sd1: 0.50, flux: 0.55 },
  { id: 'emotion', label: 'Emotion adj.',  sd1: 0.34, flux: 0.37 },
  { id: 'spatial', label: 'Spatial rel.',  sd1: 0.28, flux: 0.40 },
  { id: 'count',   label: 'Counting/neg.', sd1: 0.20, flux: 0.24 },
]

// ── Histogram (10 bins, score 0→1) ─────────────────────────────
export const HIST_BINS = {
  sd1:  [3200, 7100, 13600, 20300, 17700, 13200, 8800, 4900, 2600,  600],
  flux: [1800, 4500, 10200, 19800, 21300, 16200, 10800, 7400, 4100, 1200],
}

// ── CFG curves (RQ3) ───────────────────────────────────────────
export const CFG_BINS   = [1, 3, 5, 7, 9, 11, 13, 15, 17, 20]
export const CFG_SCORES = {
  subject: [0.62, 0.67, 0.71, 0.75, 0.77, 0.79, 0.80, 0.81, 0.82, 0.82],
  style:   [0.55, 0.60, 0.64, 0.68, 0.70, 0.72, 0.73, 0.74, 0.74, 0.75],
  emotion: [0.28, 0.30, 0.31, 0.33, 0.34, 0.35, 0.35, 0.36, 0.36, 0.37],
  spatial: [0.24, 0.25, 0.27, 0.28, 0.29, 0.30, 0.30, 0.31, 0.31, 0.31],
}
export const CFG_CAT_LINES = [
  { key: 'subject', label: 'Content nouns', color: '#378ADD' },
  { key: 'style',   label: 'Style terms',   color: '#7F77DD' },
  { key: 'emotion', label: 'Emotion adj.',  color: '#D85A30' },
  { key: 'spatial', label: 'Spatial rel.',  color: '#D4537E' },
]
export const CFG_GAINS = [
  { label: 'Content nouns', gain: 0.20, color: '#378ADD' },
  { label: 'Style terms',   gain: 0.20, color: '#7F77DD' },
  { label: 'Atmosphere',    gain: 0.12, color: '#BA7517' },
  { label: 'Emotion adj.',  gain: 0.09, color: '#D85A30' },
  { label: 'Spatial rel.',  gain: 0.07, color: '#D4537E' },
]

// ── Gallery prompts + per-concept breakdowns ───────────────────
export const PROMPTS = [
  'a melancholy sorceress in a foggy forest, ethereal glow, artstation',
  'knight standing beside a dragon, concept art, detailed armor',
  'three moons behind a gothic castle, photorealistic, sharp focus',
  'cyberpunk city at night, neon lights, cinematic, 8k',
  'oil painting of a haunting winter scene, dramatic sky',
  'portrait of a warrior woman, highly detailed, trending artstation',
  'abandoned spaceship in front of a nebula, sci-fi concept art',
  'fantasy landscape with ancient ruins, volumetric lighting',
  'anime girl with silver hair, studio ghibli style',
  'photorealistic portrait, natural lighting, sharp focus',
]
export const CONCEPT_DATA = [
  [{ t:'sorceress',    s:.78, cat:'subject' }, { t:'foggy forest', s:.71, cat:'subject' },
   { t:'ethereal',     s:.40, cat:'emotion' }, { t:'melancholy',   s:.31, cat:'emotion' }],
  [{ t:'knight',       s:.82, cat:'subject' }, { t:'dragon',       s:.84, cat:'subject' },
   { t:'beside',       s:.27, cat:'spatial' }, { t:'detailed armor',s:.68, cat:'style'  }],
  [{ t:'castle',       s:.79, cat:'subject' }, { t:'photorealistic',s:.69, cat:'style'  },
   { t:'three moons',  s:.21, cat:'count'   }, { t:'behind',       s:.29, cat:'spatial' }],
  [{ t:'city',         s:.83, cat:'subject' }, { t:'neon lights',  s:.76, cat:'subject' },
   { t:'cinematic',    s:.51, cat:'atm'     }, { t:'8k',           s:.65, cat:'style'   }],
  [{ t:'winter scene', s:.75, cat:'subject' }, { t:'oil painting', s:.72, cat:'style'   },
   { t:'haunting',     s:.36, cat:'emotion' }, { t:'dramatic sky', s:.58, cat:'atm'     }],
]

// ── Color utils ────────────────────────────────────────────────
export const PALETTE = ['#378ADD','#D4537E','#1D9E75','#7F77DD','#BA7517','#185FA5','#D85A30','#993556','#0F6E56','#3B6D11']

export const isDark      = () => window.matchMedia('(prefers-color-scheme:dark)').matches
export const textColor   = () => isDark() ? '#c2c0b6' : '#5F5E5A'
export const gridColor   = () => isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

export function scoreBarColor(s) {
  return s >= 0.7 ? '#1D9E75' : s >= 0.5 ? '#BA7517' : '#D85A30'
}
export function scoreColor(s) {
  const dark = isDark()
  if (s >= 0.7) return dark ? { bg:'#085041', tx:'#9FE1CB' } : { bg:'#E1F5EE', tx:'#0F6E56' }
  if (s >= 0.5) return dark ? { bg:'#633806', tx:'#FAC775' } : { bg:'#FAEEDA', tx:'#854F0B' }
  return                dark ? { bg:'#712B13', tx:'#F5C4B3' } : { bg:'#FAECE7', tx:'#993C1D' }
}
export function seededRng(seed) {
  let x = seed
  return () => { x = (x * 1664525 + 1013904223) & 0xffffffff; return (x >>> 0) / 0xffffffff }
}
