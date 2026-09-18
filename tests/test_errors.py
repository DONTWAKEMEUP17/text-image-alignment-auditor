import json
from pathlib import Path

import duckdb

from server.server import app, get_db


def test_database_failure_is_safe_publicly_and_detailed_privately(
    client, database_path, tmp_path: Path, app_logs
):
    missing_database = tmp_path / "private-location" / "missing.duckdb"
    database_path.db_path = str(missing_database)

    response = client.get("/api/stats")

    assert response.status_code == 503
    public_error = response.json()["error"]
    assert public_error == {
        "code": "database_unavailable",
        "message": "Analytics data is temporarily unavailable.",
        "request_id": response.headers["X-Request-ID"],
    }
    assert str(missing_database) not in response.text

    private_event = next(
        json.loads(record.message)
        for record in app_logs.records
        if json.loads(record.message)["event"] == "database_unavailable"
    )
    assert private_event["request_id"] == public_error["request_id"]
    assert str(missing_database) in private_event["exception_message"]


def test_database_query_failure_has_distinct_safe_error(client, app_logs):
    private_detail = "private SQL implementation detail"

    class BrokenConnection:
        def execute(self, *_args, **_kwargs):
            raise duckdb.ParserException(private_detail)

    def broken_database():
        yield BrokenConnection()

    app.dependency_overrides[get_db] = broken_database
    try:
        response = client.get("/api/stats")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 500
    public_error = response.json()["error"]
    assert public_error == {
        "code": "database_query_failed",
        "message": "The analytics request could not be completed.",
        "request_id": response.headers["X-Request-ID"],
    }
    assert private_detail not in response.text

    private_event = next(
        json.loads(record.message)
        for record in app_logs.records
        if json.loads(record.message)["event"] == "database_query_failed"
    )
    assert private_event["request_id"] == public_error["request_id"]
    assert private_detail in private_event["exception_message"]
