import pytest


@pytest.mark.parametrize(
    ("path", "parameter"),
    [
        ("/api/rq2/top-failures", "category"),
        ("/api/images", "concept_type"),
        ("/api/images", "concept_category"),
    ],
)
def test_filter_values_are_not_executed_as_sql(client, path, parameter):
    response = client.get(path, params={parameter: "missing' OR 1=1 --"})

    assert response.status_code == 200
    assert response.json() == []


def test_top_failures_filters_by_category(client):
    response = client.get(
        "/api/rq2/top-failures",
        params={"category": "content_noun", "limit": 2},
    )

    assert response.status_code == 200
    records = response.json()
    assert len(records) == 2
    assert {record["concept_category"] for record in records} == {"content_noun"}


def test_images_combines_parameterized_filters(client):
    response = client.get(
        "/api/images",
        params={
            "concept_type": "character",
            "min_score": 0.0,
            "max_score": 1.0,
            "limit": 2,
        },
    )

    assert response.status_code == 200
    records = response.json()
    assert len(records) == 2
    assert {record["concept_type"] for record in records} == {"character"}


@pytest.mark.parametrize(
    ("path", "parameters"),
    [
        ("/api/images", {"model": "sd_images; DROP TABLE sd_images"}),
        ("/api/images", {"sort": "clip_score; DROP TABLE sd_images"}),
        ("/api/images", {"order": "asc; DROP TABLE sd_images"}),
    ],
)
def test_sql_identifiers_are_restricted_to_allowlists(client, path, parameters):
    response = client.get(path, params=parameters)

    assert response.status_code == 422
