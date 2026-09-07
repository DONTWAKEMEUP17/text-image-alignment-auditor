import pytest


@pytest.mark.parametrize(
    ("path", "required_keys"),
    [
        ("/api/rq1/distribution", {"bin_start", "count"}),
        ("/api/rq2/by-category", {"concept_category", "n", "mean"}),
        ("/api/rq3/cfg-binned", {"cfg_bin", "n", "mean_clip"}),
        ("/api/rq4/paired-summary", {"paired_count", "sd_mean", "flux_mean"}),
        ("/api/images?limit=1", {"clip_score"}),
    ],
)
def test_analytics_endpoint_returns_records(client, path, required_keys):
    response = client.get(path)

    assert response.status_code == 200
    records = response.json()
    assert records
    assert required_keys <= records[0].keys()
