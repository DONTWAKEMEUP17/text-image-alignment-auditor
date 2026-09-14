# ============================================================
# FastAPI Backend — alignment_auditor/server.py
# implement: uvicorn server:app --reload --port 8000
# document: http://localhost:8000/docs
# ============================================================
import logging
import os
from time import perf_counter
from typing import Literal
from uuid import uuid4

import duckdb
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server.observability import log_event

app = FastAPI(title="Alignment Auditor API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DuckDB ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(PROJECT_ROOT, "server", "alignment_auditor.duckdb")
)
IMG_DIR_SD = os.environ.get(
    "IMG_DIR_SD", os.path.join(PROJECT_ROOT, "images", "sd1x_images")
)
IMG_DIR_FLUX = os.environ.get(
    "IMG_DIR_FLUX", os.path.join(PROJECT_ROOT, "images", "flux_images_paired")
)
FRONTEND_DIST = os.environ.get(
    "FRONTEND_DIST", os.path.join(PROJECT_ROOT, "client", "dist")
)
REQUIRED_TABLES = {"sd_images", "sd_concepts", "flux_images", "flux_concepts"}
ModelName = Literal["sd1x", "flux1"]
SortField = Literal["clip_score", "cfg"]
SortOrder = Literal["asc", "desc"]

app.state.db_path = DB_PATH


class DatabaseUnavailableError(RuntimeError):
    """Raised when the configured analytics database cannot serve requests."""


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    started_at = perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    log_event(
        logging.INFO,
        "request_completed",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round((perf_counter() - started_at) * 1000, 2),
    )
    return response


def error_response(request: Request, status_code: int, code: str, message: str):
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": request.state.request_id,
            }
        },
    )


@app.exception_handler(DatabaseUnavailableError)
async def handle_database_unavailable(request: Request, exc: DatabaseUnavailableError):
    log_event(
        logging.ERROR,
        "database_unavailable",
        request_id=request.state.request_id,
        method=request.method,
        path=request.url.path,
        exception_type=type(exc.__cause__ or exc).__name__,
        exception_message=str(exc.__cause__ or exc),
    )
    return error_response(
        request,
        503,
        "database_unavailable",
        "Analytics data is temporarily unavailable.",
    )


@app.exception_handler(duckdb.Error)
async def handle_database_query_error(request: Request, exc: duckdb.Error):
    log_event(
        logging.ERROR,
        "database_query_failed",
        request_id=request.state.request_id,
        method=request.method,
        path=request.url.path,
        exception_type=type(exc).__name__,
        exception_message=str(exc),
    )
    return error_response(
        request,
        500,
        "database_query_failed",
        "The analytics request could not be completed.",
    )


def get_db(request: Request):
    """Provide one read-only connection for the lifetime of an API request."""
    try:
        con = duckdb.connect(request.app.state.db_path, read_only=True)
    except duckdb.Error as exc:
        raise DatabaseUnavailableError("Failed to open analytics database") from exc
    try:
        yield con
    finally:
        con.close()


def fetch_records(con, query: str, parameters=None):
    """Execute a query and return JSON-ready records without requiring Pandas."""
    cursor = con.execute(query, parameters or [])
    columns = [description[0] for description in cursor.description]
    return [
        {column: row[index] for index, column in enumerate(columns)}
        for row in cursor.fetchall()
    ]


def require_ready_database(db_path: str):
    """Raise when the database is unreadable or lacks the expected schema."""
    con = None
    try:
        con = duckdb.connect(db_path, read_only=True)
        rows = con.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'main'
            """
        ).fetchall()
        available_tables = {row[0] for row in rows}
        missing_tables = REQUIRED_TABLES - available_tables
        if missing_tables:
            missing = ", ".join(sorted(missing_tables))
            raise DatabaseUnavailableError(f"Missing required tables: {missing}")
    except DatabaseUnavailableError:
        raise
    except duckdb.Error as exc:
        raise DatabaseUnavailableError("Failed readiness query") from exc
    finally:
        if con is not None:
            con.close()


@app.get("/health/live", tags=["health"])
def health_live():
    """Report whether the API process can answer requests."""
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
def health_ready(request: Request):
    """Report whether the API can query the expected analytics dataset."""
    require_ready_database(request.app.state.db_path)
    return {"status": "ready", "checks": {"database": "ok"}}


# ============================================================
# RQ1: Overall alignment distribution
# ============================================================
@app.get("/api/rq1/distribution")
def rq1_distribution(
    model: ModelName = "sd1x",
    bin_width: float = Query(0.02, ge=0.005, le=0.1),
    con=Depends(get_db),
):
    """Histogram data: clip_score binned for the chosen model."""
    table = "sd_images" if model == "sd1x" else "flux_images"
    return fetch_records(con, f"""
        SELECT
            FLOOR(clip_score / ?) * ? AS bin_start,
            COUNT(*) AS count
        FROM {table}
        WHERE clip_score IS NOT NULL
        GROUP BY 1 ORDER BY 1
    """, [bin_width, bin_width])


# ============================================================
# RQ2: Concept category breakdown
# ============================================================
@app.get("/api/rq2/by-category")
def rq2_by_category(
    model: ModelName = "sd1x",
    con=Depends(get_db),
):
    """Box-plot data: per concept_category distribution."""
    table = "sd_concepts" if model == "sd1x" else "flux_concepts"
    return fetch_records(con, f"""
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
    """)


@app.get("/api/rq2/top-failures")
def rq2_top_failures(
    model: ModelName = "sd1x",
    category: str = Query(None),
    limit: int = Query(20, ge=1, le=100),
    con=Depends(get_db),
):
    """Lowest-scoring concepts — the ones the model fails at most."""
    is_sd = model == "sd1x"
    concepts_table = "sd_concepts" if is_sd else "flux_concepts"
    images_table = "sd_images" if is_sd else "flux_images"
    img_join_col = "image_name" if is_sd else "filename"
    parameters = []
    where = ""
    if category:
        where = "WHERE c.concept_category = ?"
        parameters.append(category)
    parameters.append(limit)
    return fetch_records(con, f"""
        SELECT c.concept_text, c.concept_category, c.concept_clip_score, c.prompt_idx,
               c.image_name, i.image_url, i.prompt
        FROM {concepts_table} c
        JOIN {images_table} i ON c.image_name = i.{img_join_col}
        {where}
        ORDER BY c.concept_clip_score ASC
        LIMIT ?
    """, parameters)


# ============================================================
# RQ3: CFG vs alignment (SD 1.x only — has varied CFG)
# ============================================================
@app.get("/api/rq3/cfg-vs-score")
def rq3_cfg_vs_score(con=Depends(get_db)):
    """Scatter / binned data: CFG value vs clip_score for SD 1.x."""
    return fetch_records(con, """
        SELECT cfg, clip_score, concept_type
        FROM sd_images
        WHERE clip_score IS NOT NULL AND cfg IS NOT NULL
        ORDER BY cfg
    """)


@app.get("/api/rq3/cfg-binned")
def rq3_cfg_binned(con=Depends(get_db)):
    """Aggregated: mean clip_score per CFG bin."""
    return fetch_records(con, """
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
    """)


@app.get("/api/rq3/cfg-by-concept")
def rq3_cfg_by_concept(con=Depends(get_db)):
    """CFG bin × concept_category → mean alignment (for heatmap)."""
    return fetch_records(con, """
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
    """)


# ============================================================
# RQ4: SD vs FLUX cross-model comparison
# ============================================================
@app.get("/api/rq4/paired-summary")
def rq4_paired_summary(con=Depends(get_db)):
    """Aggregate paired comparison: SD vs FLUX mean scores."""
    return fetch_records(con, """
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
    """)


@app.get("/api/rq4/paired-by-category")
def rq4_paired_by_category(con=Depends(get_db)):
    """Per concept_category: SD vs FLUX mean scores."""
    return fetch_records(con, """
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
    """)


@app.get("/api/rq4/paired-scatter")
def rq4_paired_scatter(
    limit: int = Query(500, ge=1, le=3000),
    con=Depends(get_db),
):
    """Scatter data: each point = one prompt, x=SD score, y=FLUX score."""
    return fetch_records(con, """
        SELECT
            s.prompt,
            s.clip_score AS sd_score,
            f.clip_score AS flux_score,
            s.concept_type,
            s.image_name AS sd_image,
            f.filename AS flux_image,
            s.image_url AS sd_image_url,
            f.image_url AS flux_image_url
        FROM sd_images s
        JOIN flux_images f ON s.prompt = f.prompt
        ORDER BY ABS(f.clip_score - s.clip_score) DESC
        LIMIT ?
    """, [limit])


# ============================================================
# Detail endpoints
# ============================================================
@app.get("/api/image/{image_id}/concepts")
def image_concepts(
    image_id: str,
    model: ModelName = "sd1x",
    con=Depends(get_db),
):
    """Per-concept CLIP scores for a single image."""
    if model == "sd1x":
        table = "sd_concepts"
        col = "image_name"
    else:
        table = "flux_concepts"
        col = "image_name"  # flux_concepts uses image_name, not filename
    return fetch_records(con, f"""
        SELECT concept_text, concept_category, concept_clip_score
        FROM {table}
        WHERE {col} = ?
        ORDER BY concept_clip_score ASC
    """, [image_id])


@app.get("/api/images")
def list_images(
    model: ModelName = "sd1x",
    concept_type: str = Query(None),
    concept_category: str = Query(None),
    min_score: float = Query(None),
    max_score: float = Query(None),
    sort: SortField = "clip_score",
    order: SortOrder = "asc",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    con=Depends(get_db),
):
    """Paginated image list with filters."""
    is_sd = model == "sd1x"
    table = "sd_images" if is_sd else "flux_images"
    img_key = "image_name" if is_sd else "filename"
    concepts_table = "sd_concepts" if is_sd else "flux_concepts"

    conditions = []
    parameters = []
    if concept_type:
        conditions.append("concept_type = ?")
        parameters.append(concept_type)
    if min_score is not None:
        conditions.append("clip_score >= ?")
        parameters.append(min_score)
    if max_score is not None:
        conditions.append("clip_score <= ?")
        parameters.append(max_score)
    if concept_category:
        conditions.append(f"""
            {img_key} IN (
                SELECT DISTINCT image_name FROM {concepts_table}
                WHERE concept_category = ?
            )
        """)
        parameters.append(concept_category)
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    parameters.extend([limit, offset])

    return fetch_records(con, f"""
        SELECT * FROM {table}
        {where}
        ORDER BY {sort} {order}
        LIMIT ? OFFSET ?
    """, parameters)


# ============================================================
# Stats / meta
# ============================================================
@app.get("/api/stats")
def stats(con=Depends(get_db)):
    """Overall dataset stats."""
    result = {}
    for table in ["sd_images", "sd_concepts", "flux_images", "flux_concepts"]:
        count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        result[table] = count
    return result


# ============================================================
# Static files — serve the production frontend after API routes
# ============================================================
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIST, html=True, check_dir=False),
    name="frontend",
)
