from pathlib import Path
import sys

import duckdb
from fastapi.testclient import TestClient
import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from server import server  # noqa: E402


@pytest.fixture()
def test_database(tmp_path, monkeypatch):
    database_path = tmp_path / "alignment_auditor.duckdb"
    con = duckdb.connect(str(database_path))
    con.execute("""
        CREATE TABLE sd_images (
            prompt VARCHAR,
            clip_score DOUBLE,
            image_url VARCHAR
        )
    """)
    con.execute("""
        CREATE TABLE flux_images (
            prompt VARCHAR,
            clip_score DOUBLE,
            image_url VARCHAR
        )
    """)
    con.execute("""
        INSERT INTO sd_images VALUES
            ('first prompt', 0.31, 'https://example.com/sd-1.png'),
            ('second prompt', 0.27, 'https://example.com/sd-2.png')
    """)
    con.execute("""
        INSERT INTO flux_images VALUES
            ('first prompt', 0.36, 'https://example.com/flux-1.png'),
            ('third prompt', 0.42, 'https://example.com/flux-3.png')
    """)
    con.close()

    monkeypatch.setattr(server, "DB_PATH", str(database_path))
    return database_path


def test_paired_scatter_returns_only_matching_prompts(test_database):
    client = TestClient(server.app)

    response = client.get("/api/pairedScatter")

    assert response.status_code == 200
    assert response.json() == [
        {
            "prompt": "first prompt",
            "sd_score": 0.31,
            "flux_score": 0.36,
            "sd_image_url": "https://example.com/sd-1.png",
            "flux_image_url": "https://example.com/flux-1.png",
        }
    ]


def test_paired_scatter_releases_database_connection(test_database):
    client = TestClient(server.app)
    assert client.get("/api/pairedScatter").status_code == 200

    con = duckdb.connect(str(test_database))
    con.execute("INSERT INTO flux_images VALUES ('second prompt', 0.33, 'https://example.com/flux-2.png')")
    con.close()

    response = client.get("/api/pairedScatter")
    assert [row["prompt"] for row in response.json()] == ["first prompt", "second prompt"]
