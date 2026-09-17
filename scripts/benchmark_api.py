"""Measure local API response latency under a small, repeatable load."""

import argparse
import asyncio
import json
import math
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from time import perf_counter

import httpx


@dataclass(frozen=True)
class Sample:
    duration_ms: float
    status_code: int | None
    error: str | None = None


def nearest_rank(values: list[float], percentile: float) -> float | None:
    """Return an observed percentile value, or None for an empty sample."""
    if not 0 < percentile <= 1:
        raise ValueError("percentile must be greater than 0 and at most 1")
    if not values:
        return None
    ordered = sorted(values)
    return ordered[math.ceil(percentile * len(ordered)) - 1]


def summarize(samples: list[Sample], duration_s: float) -> dict:
    """Keep failures visible instead of hiding them inside latency statistics."""
    successful = [
        sample.duration_ms
        for sample in samples
        if sample.status_code == 200 and sample.error is None
    ]
    outcomes = Counter(
        str(sample.status_code) if sample.error is None else sample.error
        for sample in samples
    )
    return {
        "requests": len(samples),
        "successful": len(successful),
        "failures": len(samples) - len(successful),
        "outcomes": dict(sorted(outcomes.items())),
        "p50_ms": round(nearest_rank(successful, 0.50), 2) if successful else None,
        "p95_ms": round(nearest_rank(successful, 0.95), 2) if successful else None,
        "max_ms": round(max(successful), 2) if successful else None,
        "requests_per_second": round(len(samples) / duration_s, 2),
        "duration_s": round(duration_s, 2),
    }


async def measure(
    base_url: str, path: str, requests: int, concurrency: int, warmup: int
) -> dict:
    limits = httpx.Limits(
        max_connections=concurrency, max_keepalive_connections=concurrency
    )
    async with httpx.AsyncClient(
        base_url=base_url, limits=limits, timeout=5.0
    ) as client:
        for _ in range(warmup):
            response = await client.get(path)
            response.raise_for_status()
            response.json()

        semaphore = asyncio.Semaphore(concurrency)

        async def request_once() -> Sample:
            async with semaphore:
                started = perf_counter()
                try:
                    response = await client.get(path)
                except httpx.HTTPError as exc:
                    return Sample(
                        (perf_counter() - started) * 1000, None, type(exc).__name__
                    )
                duration_ms = (perf_counter() - started) * 1000
                try:
                    response.json()
                except ValueError:
                    return Sample(duration_ms, response.status_code, "invalid_json")
                return Sample(duration_ms, response.status_code)

        started = perf_counter()
        samples = await asyncio.gather(*(request_once() for _ in range(requests)))
        duration_s = perf_counter() - started

    return {
        "measured_at_utc": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "path": path,
        "concurrency": concurrency,
        "warmup_requests": warmup,
        **summarize(samples, duration_s),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="API origin, e.g. http://localhost:8000")
    parser.add_argument("--path", default="/api/stats", help="JSON GET endpoint")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--warmup", type=int, default=10)
    args = parser.parse_args()
    if not args.base_url.startswith(("http://", "https://")):
        parser.error("--base-url must begin with http:// or https://")
    if not args.path.startswith("/"):
        parser.error("--path must start with /")
    if args.requests < 1 or args.concurrency < 1 or args.warmup < 0:
        parser.error(
            "requests and concurrency must be positive; warmup cannot be negative"
        )
    if args.concurrency > args.requests:
        parser.error("--concurrency cannot exceed --requests")

    result = asyncio.run(
        measure(args.base_url, args.path, args.requests, args.concurrency, args.warmup)
    )
    print(json.dumps(result, indent=2))
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
