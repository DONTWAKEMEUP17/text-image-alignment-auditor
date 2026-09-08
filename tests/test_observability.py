import json
import logging


def test_successful_request_emits_structured_completion_log(client, caplog):
    caplog.set_level(logging.INFO, logger="alignment_auditor")

    response = client.get("/health/live")

    assert response.status_code == 200
    request_id = response.headers["X-Request-ID"]
    event = next(
        json.loads(record.message)
        for record in caplog.records
        if json.loads(record.message)["event"] == "request_completed"
    )
    assert event["request_id"] == request_id
    assert event["method"] == "GET"
    assert event["path"] == "/health/live"
    assert event["status_code"] == 200
    assert event["duration_ms"] >= 0
