from pathlib import Path

import duckdb
import pytest

from server.server import app


@pytest.fixture
def database_path():
    original_path = app.state.db_path
    try:
        yield app.state
    finally:
        app.state.db_path = original_path


def test_liveness_does_not_require_database(client, database_path, tmp_path: Path):
    database_path.db_path = str(tmp_path / "missing.duckdb")

    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_readiness_succeeds_with_expected_database(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


def test_readiness_fails_when_database_is_missing(
    client, database_path, tmp_path: Path
):
    database_path.db_path = str(tmp_path / "missing.duckdb")

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "unavailable"},
    }


def test_readiness_fails_when_database_has_wrong_schema(
    client, database_path, tmp_path: Path
):
    empty_database = tmp_path / "empty.duckdb"
    con = duckdb.connect(str(empty_database))
    con.execute("CREATE TABLE unrelated (id INTEGER)")
    con.close()
    database_path.db_path = str(empty_database)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "unavailable"},
    }
