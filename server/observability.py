import json
import logging
import sys
from datetime import datetime, timezone

logger = logging.getLogger("alignment_auditor")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)


def log_event(level: int, event: str, **fields):
    """Write one machine-readable JSON log event."""
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": logging.getLevelName(level).lower(),
        "event": event,
        **fields,
    }
    logger.log(level, json.dumps(payload, default=str, sort_keys=True))
