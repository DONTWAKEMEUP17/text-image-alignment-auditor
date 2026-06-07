// ── Model name mapping ─────────────────────────────────────────
// App uses 'sd1' | 'flux'; API expects 'sd1x' | 'flux1'
export const toApi = m => m === 'sd1' ? 'sd1x' : 'flux1'

async function get(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`API ${r.status}: ${url}`)
  return r.json()
}

export const api = {
  // ── RQ1 ───────────────────────────────────────────────────────
  // Returns [{bin_start, count}]
  distribution: (model, binWidth = 0.02) =>
    get(`/api/rq1/distribution?model=${toApi(model)}&bin_width=${binWidth}`),

  // ── RQ2 ───────────────────────────────────────────────────────
  // Returns [{concept_category, n, mean, q1, median, q3, min, max}]
  byCategory: model =>
    get(`/api/rq2/by-category?model=${toApi(model)}`),

  // Returns [{concept_text, concept_category, concept_clip_score, prompt_idx}]
  topFailures: (model, category, limit = 20) => {
    let u = `/api/rq2/top-failures?model=${toApi(model)}&limit=${limit}`
    if (category) u += `&category=${encodeURIComponent(category)}`
    return get(u)
  },

  // ── RQ3 (SD 1.x only — FLUX ignores CFG) ──────────────────────
  // Returns [{cfg_bin, n, mean_clip, median_clip}]
  cfgBinned: () => get('/api/rq3/cfg-binned'),

  // Returns [{cfg_bin, concept_category, n, mean_score}]
  cfgByConcept: () => get('/api/rq3/cfg-by-concept'),

  // ── RQ4 ───────────────────────────────────────────────────────
  // Returns [{paired_count, sd_mean, flux_mean, mean_delta}]
  pairedSummary: () => get('/api/rq4/paired-summary'),

  // Returns [{concept_category, model, n, mean_score}]
  pairedByCategory: () => get('/api/rq4/paired-by-category'),

  // Returns [{prompt, sd_score, flux_score, concept_type, sd_image, flux_image}]
  pairedScatter: (limit = 500) => get(`/api/rq4/paired-scatter?limit=${limit}`),

  // ── Images ────────────────────────────────────────────────────
  // Returns array of image rows from sd_images / flux_images table
  images: (model, opts = {}) => {
    const p = new URLSearchParams({ model: toApi(model), ...opts })
    return get(`/api/images?${p}`)
  },

  // Returns [{concept_text, concept_category, concept_pos, concept_clip_score}]
  imageConcepts: (imageId, model) =>
    get(`/api/image/${encodeURIComponent(imageId)}/concepts?model=${toApi(model)}`),

  // Returns {sd_images, sd_concepts, flux_images, flux_concepts}
  stats: () => get('/api/stats'),

}