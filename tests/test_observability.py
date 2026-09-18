import json
import subprocess
import sys


def test_successful_request_emits_structured_completion_log(client, app_logs):

    response = client.get("/health/live")

    assert response.status_code == 200
    request_id = response.headers["X-Request-ID"]
    event = next(
        json.loads(record.message)
        for record in app_logs.records
        if json.loads(record.message)["event"] == "request_completed"
    )
    assert event["request_id"] == request_id
    assert event["method"] == "GET"
    assert event["path"] == "/health/live"
    assert event["status_code"] == 200
    assert event["duration_ms"] >= 0


def test_log_event_writes_json_to_stdout():
    process = subprocess.run(
        [
            sys.executable,
            "-c",
            "import logging; from server.observability import log_event; "
            "log_event(logging.INFO, 'test_probe', request_id='demo-request')",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    lines = process.stdout.splitlines()
    assert len(lines) == 1
    event = json.loads(lines[0])
    assert event["event"] == "test_probe"
    assert event["request_id"] == "demo-request"


def test_readiness_probe_does_not_spam_request_logs(client, app_logs):
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert app_logs.records == []
