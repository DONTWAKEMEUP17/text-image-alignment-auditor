# API Contract — Alignment Auditor

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## RQ1: Overall alignment distribution

### `GET /api/rq1/distribution`

Histogram bins for clip_score.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| model | string | "sd1x" | "sd1x" or "flux1" |
| bin_width | float | 0.02 | Bin width (0.005–0.1) |

**Response:**
```json
[
  { "bin_start": 0.12, "count": 3 },
  { "bin_start": 0.14, "count": 15 },
  ...
]
```

**Frontend use:** histogram / bar chart of alignment score distribution.

---

## RQ2: Concept category analysis

### `GET /api/rq2/by-category`

Box-plot stats per concept category.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| model | string | "sd1x" | "sd1x" or "flux1" |

**Response:**
```json
[
  {
    "concept_category": "adjective",
    "n": 8234,
    "mean": 0.2155,
    "q1": 0.1821,
    "median": 0.2134,
    "q3": 0.2467,
    "min": 0.0312,
    "max": 0.4102
  },
  {
    "concept_category": "noun_chunk",
    "n": 15275,
    "mean": 0.2349,
    ...
  }
]
```

**Frontend use:** box plot or grouped bar chart comparing noun_chunk vs adjective.

### `GET /api/rq2/top-failures`

Lowest-scoring individual concepts.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| model | string | "sd1x" | "sd1x" or "flux1" |
| category | string | null | Filter by concept_category |
| limit | int | 20 | Max results (1–100) |

**Response:**
```json
[
  {
    "concept_text": "ethereal",
    "concept_category": "adjective",
    "concept_clip_score": 0.0312,
    "prompt_idx": 1842
  },
  ...
]
```

**Frontend use:** ranked failure list / table. Click → load image detail.

---

## RQ3: CFG vs alignment

### `GET /api/rq3/cfg-vs-score`

Raw scatter data: every SD 1.x image's CFG and clip_score.

**Response:**
```json
[
  { "cfg": 7.0, "clip_score": 0.3215, "concept_type": "noun_chunk" },
  ...
]
```

**Frontend use:** scatter plot (x=CFG, y=clip_score), color by concept_type.

### `GET /api/rq3/cfg-binned`

Aggregated by CFG bin.

**Response:**
```json
[
  { "cfg_bin": "01-05", "n": 120, "mean_clip": 0.2981, "median_clip": 0.2950 },
  { "cfg_bin": "06-08", "n": 850, "mean_clip": 0.3102, "median_clip": 0.3090 },
  ...
]
```

**Frontend use:** bar chart of mean alignment per CFG range.

### `GET /api/rq3/cfg-by-concept`

CFG bin × concept_category → mean score (heatmap data).

**Response:**
```json
[
  { "cfg_bin": "01-05", "concept_category": "adjective", "n": 45, "mean_score": 0.2012 },
  { "cfg_bin": "01-05", "concept_category": "noun_chunk", "n": 75, "mean_score": 0.2234 },
  ...
]
```

**Frontend use:** heatmap (rows=CFG bin, cols=concept_category, color=mean_score).

---

## RQ4: SD vs FLUX cross-model comparison

### `GET /api/rq4/paired-summary`

Aggregate paired comparison.

**Response:**
```json
[
  {
    "paired_count": 2699,
    "sd_mean": 0.3115,
    "flux_mean": 0.3057,
    "mean_delta": -0.0058
  }
]
```

**Frontend use:** summary stat card.

### `GET /api/rq4/paired-by-category`

Per concept_category, SD vs FLUX.

**Response:**
```json
[
  { "concept_category": "adjective", "model": "flux1", "n": 7821, "mean_score": 0.2181 },
  { "concept_category": "adjective", "model": "sd1x", "n": 8234, "mean_score": 0.2155 },
  { "concept_category": "noun_chunk", "model": "flux1", "n": 12999, "mean_score": 0.2330 },
  { "concept_category": "noun_chunk", "model": "sd1x", "n": 15275, "mean_score": 0.2349 }
]
```

**Frontend use:** grouped bar chart (one group per category, two bars per group).

### `GET /api/rq4/paired-scatter`

Per-prompt paired comparison scatter.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | int | 500 | Max points (1–3000) |

**Response:**
```json
[
  {
    "prompt": "a dog driving a tank...",
    "sd_score": 0.3215,
    "flux_score": 0.3102,
    "concept_type": "noun_chunk",
    "sd_image": "part1_00234.png",
    "flux_image": "42_flux.png",
    "sd_image_url": "https://...",
    "flux_image_url": "https://..."
  },
  ...
]
```

**Frontend use:** scatter (x=SD score, y=FLUX score), diagonal=parity line. Points below → FLUX worse.

---

## Detail endpoints

### `GET /api/image/{image_id}/concepts`

Per-concept breakdown for one image.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| image_id | string | required | image_name (SD) or filename (FLUX) |
| model | string | "sd1x" | "sd1x" or "flux1" |

**Response:**
```json
[
  { "concept_text": "red car", "concept_category": "noun_chunk", "concept_pos": "NOUN", "concept_clip_score": 0.2815 },
  { "concept_text": "dramatic", "concept_category": "adjective", "concept_pos": "ADJ", "concept_clip_score": 0.1523 },
  ...
]
```

**Frontend use:** horizontal bar chart in detail panel, sorted worst→best.

### `GET /api/images`

Paginated image list with filters. Each row includes `image_url` — use this directly as the `<img src>`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| model | string | "sd1x" | "sd1x" or "flux1" |
| concept_type | string | null | Filter by concept_type |
| min_score | float | null | Minimum clip_score |
| max_score | float | null | Maximum clip_score |
| sort | string | "clip_score" | Sort field |
| order | string | "asc" | "asc" or "desc" |
| limit | int | 50 | Page size (1–200) |
| offset | int | 0 | Pagination offset |

**Response:**
```json
[
  {
    "image_name": "part1_00234.png",
    "concept_type": "noun_chunk",
    "clip_score": 0.3215,
    "image_url": "https://...",
    "...": "other columns from table"
  }
]
```

### `GET /api/stats`

Dataset summary.

**Response:**
```json
{
  "sd_images": 3000,
  "sd_concepts": 23509,
  "flux_images": 2699,
  "flux_concepts": 20820
}
```

---

## Image URLs

Images are no longer served as static files. Each image row returned by `GET /api/images` contains an `image_url` field — use it directly as the `<img src>`. The paired-scatter response also includes `sd_image_url` and `flux_image_url` for side-by-side thumbnails.

---

## Data notes for frontend

- **clip_score** range: roughly 0.10 – 0.45 (overall image-level)
- **concept_clip_score** range: roughly 0.03 – 0.40 (per-concept)
- **concept_category**: "adjective" or "noun_chunk"
- **concept_type** (image-level): the dominant category assigned to that prompt
- **cfg**: SD 1.x CFG values range 1–20+, mostly 7–12. FLUX is always 1.0.
- **Paired prompts**: 2699 prompts have both SD and FLUX images
