# ============================================================
# FastAPI Backend — alignment_auditor/server.py
# implement: uvicorn server:app --reload --port 8000
# document: http://localhost:8000/docs
# ============================================================
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import duckdb
import os


app = FastAPI(title="Alignment Auditor API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DuckDB ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("DB_PATH", os.path.join(PROJECT_ROOT, "server", "alignment_auditor.duckdb"))
IMG_DIR_SD = os.environ.get("IMG_DIR_SD", os.path.join(PROJECT_ROOT, "images", "sd1x_images"))
IMG_DIR_FLUX = os.environ.get("IMG_DIR_FLUX", os.path.join(PROJECT_ROOT, "images", "flux_images_paired"))


def get_db():
    return duckdb.connect(DB_PATH, read_only=True)


# ============================================================
# RQ1: Overall alignment distribution
# ============================================================
@app.get("/api/rq1/distribution")
def rq1_distribution(
    model: str = Query("sd1x", enum=["sd1x", "flux1"]),
    bin_width: float = Query(0.02, ge=0.005, le=0.1),
):
    """Histogram data: clip_score binned for the chosen model."""
    table = "sd_images" if model == "sd1x" else "flux_images"
    con = get_db()
    df = con.execute(f"""
        SELECT
            FLOOR(clip_score / {bin_width}) * {bin_width} AS bin_start,
            COUNT(*) AS count
        FROM {table}
        WHERE clip_score IS NOT NULL
        GROUP BY 1 ORDER BY 1
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


# ============================================================
# RQ2: Concept category breakdown
# ============================================================
@app.get("/api/rq2/by-category")
def rq2_by_category(
    model: str = Query("sd1x", enum=["sd1x", "flux1"]),
):
    """Box-plot data: per concept_category distribution."""
    table = "sd_concepts" if model == "sd1x" else "flux_concepts"
    con = get_db()
    df = con.execute(f"""
        SELECT
            concept_category,
            COUNT(*) AS n,
            AVG(concept_clip_score) AS mean,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY concept_clip_score) AS q1,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY concept_clip_score) AS median,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY concept_clip_score) AS q3,
            MIN(concept_clip_score) AS min,
            MAX(concept_clip_score) AS max
        FROM {table}
        WHERE concept_clip_score IS NOT NULL
        GROUP BY concept_category
        ORDER BY mean
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/rq2/top-failures")
def rq2_top_failures(
    model: str = Query("sd1x", enum=["sd1x", "flux1"]),
    category: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Lowest-scoring concepts — the ones the model fails at most."""
    table = "sd_concepts" if model == "sd1x" else "flux_concepts"
    con = get_db()
    where = f"WHERE concept_category = '{category}'" if category else ""
    df = con.execute(f"""
        SELECT concept_text, concept_category, concept_clip_score, prompt_idx
        FROM {table}
        {where}
        ORDER BY concept_clip_score ASC
        LIMIT {limit}
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


# ============================================================
# RQ3: CFG vs alignment (SD 1.x only — has varied CFG)
# ============================================================
@app.get("/api/rq3/cfg-vs-score")
def rq3_cfg_vs_score():
    """Scatter / binned data: CFG value vs clip_score for SD 1.x."""
    con = get_db()
    df = con.execute("""
        SELECT cfg, clip_score, concept_type
        FROM sd_images
        WHERE clip_score IS NOT NULL AND cfg IS NOT NULL
        ORDER BY cfg
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/rq3/cfg-binned")
def rq3_cfg_binned():
    """Aggregated: mean clip_score per CFG bin."""
    con = get_db()
    df = con.execute("""
        SELECT
            CASE
                WHEN cfg <= 5 THEN '01-05'
                WHEN cfg <= 8 THEN '06-08'
                WHEN cfg <= 10 THEN '09-10'
                WHEN cfg <= 12 THEN '11-12'
                WHEN cfg <= 15 THEN '13-15'
                ELSE '16+'
            END AS cfg_bin,
            COUNT(*) AS n,
            AVG(clip_score) AS mean_clip,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY clip_score) AS median_clip
        FROM sd_images
        WHERE clip_score IS NOT NULL AND cfg IS NOT NULL
        GROUP BY 1
        ORDER BY MIN(cfg)
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/rq3/cfg-by-concept")
def rq3_cfg_by_concept():
    """CFG bin × concept_category → mean alignment (for heatmap)."""
    con = get_db()
    df = con.execute("""
        SELECT
            CASE
                WHEN i.cfg <= 5 THEN '01-05'
                WHEN i.cfg <= 8 THEN '06-08'
                WHEN i.cfg <= 10 THEN '09-10'
                WHEN i.cfg <= 12 THEN '11-12'
                WHEN i.cfg <= 15 THEN '13-15'
                ELSE '16+'
            END AS cfg_bin,
            c.concept_category,
            COUNT(*) AS n,
            AVG(c.concept_clip_score) AS mean_score
        FROM sd_concepts c
        JOIN sd_images i ON c.image_name = i.image_name
        GROUP BY 1, 2
        ORDER BY MIN(i.cfg), c.concept_category
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


# ============================================================
# RQ4: SD vs FLUX cross-model comparison
# ============================================================
@app.get("/api/rq4/paired-summary")
def rq4_paired_summary():
    """Aggregate paired comparison: SD vs FLUX mean scores."""
    con = get_db()
    df = con.execute("""
        WITH paired AS (
            SELECT
                s.prompt,
                s.clip_score AS sd_score,
                f.clip_score AS flux_score,
                s.concept_type
            FROM sd_images s
            JOIN flux_images f ON s.prompt = f.prompt
        )
        SELECT
            COUNT(*) AS paired_count,
            AVG(sd_score) AS sd_mean,
            AVG(flux_score) AS flux_mean,
            AVG(flux_score - sd_score) AS mean_delta
        FROM paired
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/rq4/paired-by-category")
def rq4_paired_by_category():
    """Per concept_category: SD vs FLUX mean scores."""
    con = get_db()
    df = con.execute("""
        SELECT
            concept_category,
            model,
            COUNT(*) AS n,
            AVG(concept_clip_score) AS mean_score
        FROM (
            SELECT concept_category, concept_clip_score, model FROM sd_concepts
            UNION ALL
            SELECT concept_category, concept_clip_score, model FROM flux_concepts
        ) combined
        GROUP BY concept_category, model
        ORDER BY concept_category, model
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/rq4/paired-scatter")
def rq4_paired_scatter(limit: int = Query(500, ge=1, le=3000)):
    """Scatter data: each point = one prompt, x=SD score, y=FLUX score."""
    con = get_db()
    df = con.execute(f"""
        SELECT
            s.prompt,
            s.clip_score AS sd_score,
            f.clip_score AS flux_score,
            s.concept_type,
            s.image_name AS sd_image,
            f.filename AS flux_image
        FROM sd_images s
        JOIN flux_images f ON s.prompt = f.prompt
        ORDER BY ABS(f.clip_score - s.clip_score) DESC
        LIMIT {limit}
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


# ============================================================
# Detail endpoints
# ============================================================
@app.get("/api/image/{image_id}/concepts")
def image_concepts(
    image_id: str,
    model: str = Query("sd1x", enum=["sd1x", "flux1"]),
):
    """Per-concept CLIP scores for a single image."""
    if model == "sd1x":
        table = "sd_concepts"
        col = "image_name"
    else:
        table = "flux_concepts"
        col = "filename"
    con = get_db()
    df = con.execute(f"""
        SELECT concept_text, concept_category, concept_pos, concept_clip_score
        FROM {table}
        WHERE {col} = ?
        ORDER BY concept_clip_score ASC
    """, [image_id]).fetchdf()
    con.close()
    return df.to_dict(orient="records")


@app.get("/api/images")
def list_images(
    model: str = Query("sd1x", enum=["sd1x", "flux1"]),
    concept_type: str = Query(None),
    min_score: float = Query(None),
    max_score: float = Query(None),
    sort: str = Query("clip_score", enum=["clip_score", "cfg"]),
    order: str = Query("asc", enum=["asc", "desc"]),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Paginated image list with filters."""
    table = "sd_images" if model == "sd1x" else "flux_images"
    conditions = []
    if concept_type:
        conditions.append(f"concept_type = '{concept_type}'")
    if min_score is not None:
        conditions.append(f"clip_score >= {min_score}")
    if max_score is not None:
        conditions.append(f"clip_score <= {max_score}")
    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    con = get_db()
    df = con.execute(f"""
        SELECT * FROM {table}
        {where}
        ORDER BY {sort} {order}
        LIMIT {limit} OFFSET {offset}
    """).fetchdf()
    con.close()
    return df.to_dict(orient="records")


# ============================================================
# Stats / meta
# ============================================================
@app.get("/api/stats")
def stats():
    """Overall dataset stats."""
    con = get_db()
    result = {}
    for table in ["sd_images", "sd_concepts", "flux_images", "flux_concepts"]:
        count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        result[table] = count
    con.close()
    return result


# ============================================================
# Static files — serve images
# ============================================================
app.mount("/images/sd", StaticFiles(directory=IMG_DIR_SD), name="sd_images")
app.mount("/images/flux", StaticFiles(directory=IMG_DIR_FLUX), name="flux_images")