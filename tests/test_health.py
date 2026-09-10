from pathlib import Path

import duckdb


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
        "error": {
            "code": "database_unavailable",
            "message": "Analytics data is temporarily unavailable.",
            "request_id": response.headers["X-Request-ID"],
        }
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
        "error": {
            "code": "database_unavailable",
            "message": "Analytics data is temporarily unavailable.",
            "request_id": response.headers["X-Request-ID"],
        }
    }
