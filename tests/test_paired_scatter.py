import duckdb
import pytest


@pytest.fixture
def paired_database(tmp_path, database_path):
    path = tmp_path / "paired.duckdb"
    con = duckdb.connect(str(path))
    con.execute("""
        CREATE TABLE sd_images (
            prompt VARCHAR,
            clip_score DOUBLE,
            concept_type VARCHAR,
            image_name VARCHAR,
            image_url VARCHAR
        )
    """)
    con.execute("""
        CREATE TABLE flux_images (
            prompt VARCHAR,
            clip_score DOUBLE,
            filename VARCHAR,
            image_url VARCHAR
        )
    """)
    con.execute("""
        INSERT INTO sd_images VALUES
            ('first prompt', 0.31, 'noun_chunk', 'sd-1.png',
             'https://example.com/sd-1.png'),
            ('second prompt', 0.27, 'adjective', 'sd-2.png',
             'https://example.com/sd-2.png')
    """)
    con.execute("""
        INSERT INTO flux_images VALUES
            ('first prompt', 0.36, 'flux-1.png',
             'https://example.com/flux-1.png'),
            ('third prompt', 0.42, 'flux-3.png',
             'https://example.com/flux-3.png')
    """)
    con.close()
    database_path.db_path = str(path)
    return path


def test_paired_scatter_returns_only_matching_prompts(client, paired_database):
    response = client.get("/api/rq4/paired-scatter")

    assert response.status_code == 200
    assert response.json() == [
        {
            "prompt": "first prompt",
            "sd_score": 0.31,
            "flux_score": 0.36,
            "concept_type": "noun_chunk",
            "sd_image": "sd-1.png",
            "flux_image": "flux-1.png",
            "sd_image_url": "https://example.com/sd-1.png",
            "flux_image_url": "https://example.com/flux-1.png",
        }
    ]


def test_paired_scatter_releases_database_connection(
    client, paired_database, database_path
):
    assert client.get("/api/rq4/paired-scatter").status_code == 200

    con = duckdb.connect(str(paired_database))
    con.execute("""
        INSERT INTO flux_images VALUES
            ('second prompt', 0.33, 'flux-2.png',
             'https://example.com/flux-2.png')
    """)
    con.close()

    response = client.get("/api/rq4/paired-scatter")
    assert {row["prompt"] for row in response.json()} == {
        "first prompt",
        "second prompt",
    }
