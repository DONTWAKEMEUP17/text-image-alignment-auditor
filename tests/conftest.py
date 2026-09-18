import pytest
from fastapi.testclient import TestClient

from server.observability import logger
from server.server import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def database_path():
    original_path = app.state.db_path
    try:
        yield app.state
    finally:
        app.state.db_path = original_path


@pytest.fixture
def app_logs(caplog):
    logger.addHandler(caplog.handler)
    try:
        yield caplog
    finally:
        logger.removeHandler(caplog.handler)
