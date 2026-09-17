"""Response shapes required by the React views in client/src/."""

import math
from urllib.parse import quote

import pytest


@pytest.mark.parametrize(
    ("path", "text_fields", "number_fields", "integer_fields"),
    [
        ("/api/rq1/distribution?model=sd1x", (), ("bin_start",), ("count",)),
        ("/api/rq1/distribution?model=flux1", (), ("bin_start",), ("count",)),
        (
            "/api/rq2/by-category?model=sd1x",
            ("concept_category",),
            ("mean",),
            ("n",),
        ),
        (
            "/api/rq2/by-category?model=flux1",
            ("concept_category",),
            ("mean",),
            ("n",),
        ),
        (
            "/api/rq2/top-failures?model=sd1x&category=content_noun&limit=8",
            ("concept_text", "image_name", "image_url", "prompt"),
            ("concept_clip_score",),
            (),
        ),
        (
            "/api/rq2/top-failures?model=flux1&category=content_noun&limit=8",
            ("concept_text", "image_name", "image_url", "prompt"),
            ("concept_clip_score",),
            (),
        ),
        ("/api/rq3/cfg-binned", ("cfg_bin",), ("mean_clip",), ("n",)),
        (
            "/api/rq3/cfg-by-concept",
            ("cfg_bin", "concept_category"),
            ("mean_score",),
            ("n",),
        ),
        (
            "/api/rq4/paired-summary",
            (),
            ("sd_mean", "flux_mean", "mean_delta"),
            ("paired_count",),
        ),
        (
            "/api/rq4/paired-by-category",
            ("concept_category", "model"),
            ("mean_score",),
            ("n",),
        ),
        (
            "/api/rq4/paired-scatter?limit=500",
            (
                "prompt",
                "concept_type",
                "sd_image",
                "flux_image",
                "sd_image_url",
                "flux_image_url",
            ),
            ("sd_score", "flux_score"),
            (),
        ),
        (
            "/api/images?model=sd1x&limit=200&sort=clip_score&order=asc",
            ("image_name", "image_url", "prompt"),
            ("clip_score",),
            (),
        ),
        (
            "/api/images?model=flux1&limit=200&sort=clip_score&order=asc",
            ("filename", "image_url", "prompt"),
            ("clip_score",),
            (),
        ),
    ],
)
def test_react_record_contract(
    client, path, text_fields, number_fields, integer_fields
):
    response = client.get(path)

    assert response.status_code == 200, path
    rows = response.json()
    assert isinstance(rows, list), path
    assert rows, path
    for row in rows:
        assert isinstance(row, dict), path
        for field in text_fields:
            assert isinstance(row.get(field), str), (path, field, row)
        for field in number_fields:
            value = row.get(field)
            assert type(value) in (int, float) and math.isfinite(value), (
                path,
                field,
                row,
            )
        for field in integer_fields:
            value = row.get(field)
            assert type(value) is int and value >= 0, (path, field, row)


@pytest.mark.parametrize("model", ["sd1x", "flux1"])
def test_react_image_detail_contract(client, model):
    images_response = client.get("/api/images", params={"model": model, "limit": 1})
    assert images_response.status_code == 200
    images = images_response.json()
    assert isinstance(images, list) and images
    image = images[0]
    image_id = image["image_name" if model == "sd1x" else "filename"]

    response = client.get(
        f"/api/image/{quote(image_id, safe='')}/concepts", params={"model": model}
    )

    assert response.status_code == 200
    concepts = response.json()
    assert isinstance(concepts, list) and concepts
    for concept in concepts:
        assert isinstance(concept.get("concept_text"), str)
        assert isinstance(concept.get("concept_category"), str)
        score = concept.get("concept_clip_score")
        assert type(score) in (int, float) and math.isfinite(score)


def test_react_stats_contract(client):
    response = client.get("/api/stats")

    assert response.status_code == 200
    stats = response.json()
    assert isinstance(stats, dict)
    for field in ("sd_images", "sd_concepts", "flux_images", "flux_concepts"):
        assert type(stats.get(field)) is int and stats[field] >= 0


def test_cfg_bins_match_react_chart_order(client):
    # Keep in sync with CFG_BIN_ORDER in client/src/data.js.
    expected_bins = {"01-05", "06-08", "09-10", "11-12", "13-15", "16+"}
    rows = client.get("/api/rq3/cfg-by-concept").json()

    assert {row["cfg_bin"] for row in rows} == expected_bins


def test_paired_categories_use_react_model_names(client):
    # RQ4View matches these exact names when building the grouped bars.
    rows = client.get("/api/rq4/paired-by-category").json()

    assert {row["model"] for row in rows} == {"sd1x", "flux1"}
    categories = {row["concept_category"] for row in rows}
    for category in categories:
        models = {row["model"] for row in rows if row["concept_category"] == category}
        assert models == {"sd1x", "flux1"}
