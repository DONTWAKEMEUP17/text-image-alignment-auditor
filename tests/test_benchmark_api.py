import pytest

from scripts.benchmark_api import Sample, nearest_rank, summarize


def test_nearest_rank_selects_observed_values():
    values = list(range(1, 21))

    assert nearest_rank(values, 0.50) == 10
    assert nearest_rank(values, 0.95) == 19
    assert nearest_rank([], 0.95) is None
    with pytest.raises(ValueError, match="percentile"):
        nearest_rank(values, 0)


def test_summary_keeps_failures_out_of_latency_percentiles():
    samples = [
        Sample(10.0, 200),
        Sample(20.0, 200),
        Sample(100.0, 503),
        Sample(500.0, None, "ConnectTimeout"),
    ]

    assert summarize(samples, 2.0) == {
        "requests": 4,
        "successful": 2,
        "failures": 2,
        "outcomes": {"200": 2, "503": 1, "ConnectTimeout": 1},
        "p50_ms": 10.0,
        "p95_ms": 20.0,
        "max_ms": 20.0,
        "requests_per_second": 2.0,
        "duration_s": 2.0,
    }
