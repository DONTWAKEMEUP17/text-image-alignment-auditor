# Production Architecture

## Deployment shape

```text
Browser
   |
   | HTTP
   v
Alignment Auditor container
   |-- / and /assets/*  -> compiled React/Vite frontend
   |-- /api/*           -> FastAPI analytical endpoints
   |-- /health/*        -> liveness and readiness
   |
   `-- read-only DuckDB -> precomputed CLIP and concept scores

Image URLs returned by the API -> public Hugging Face dataset/CDN
```

The multi-stage image uses Node.js only to compile the frontend. The final
runtime contains Python, the FastAPI application, compiled static assets, and
the 7 MB DuckDB database. The process runs as the unprivileged `app` user and
supports a read-only root filesystem with `/tmp` mounted as temporary storage.

## First public deployment

On 2026-09-18, Render showed a Live, Blueprint-managed **Free Docker** web
service built from `main` at merge commit `f8d26de`. The public URL is
<https://alignment-auditor.onrender.com/>. The following are point-in-time
checks from outside Render, not an uptime or sustained-load measurement.

| Public signal | Result |
| --- | --- |
| First deploy | 2026-09-18; one successful deploy shown in Render |
| Homepage and compiled JavaScript | HTTP 200; JS asset loaded |
| `/health/ready` | HTTP 200; `database: ok` |
| `/api/stats` | HTTP 200; 3,000 SD images, 34,178 SD concepts, 2,699 FLUX images, 30,191 FLUX concepts |
| RQ1–RQ4 API samples | HTTP 200; nonempty expected data |
| Browser check | RQ1/2 charts and image-to-concept drill-down, RQ3 charts, RQ4 scatter point-to-paired-image detail rendered |
| External image | One Hugging Face image returned HTTP 206 with PNG signature |
| Structured application logs | Missing on initial deployed commit; fix verified locally on this branch, pending redeploy |
| Public p95, throughput, and failures | Not measured |
| Deployment frequency and users | Not measured; one deploy is not a frequency trend |

Render probes `/health/ready` and waits for passing CI checks before future
automatic deploys. The initial live instance displayed Uvicorn access logs but
not our JSON application events. A local-container reproduction confirmed the
missing stdout handler; this branch routes JSON events to stdout, suppresses
routine readiness log noise, and verifies an API event in the Docker smoke test.
Recheck the Render log stream after this fix deploys before claiming structured
logging works publicly.

## Initial trade-offs

### One container instead of separate frontend and API services

For a recruiter-demo workload, one origin removes cross-origin configuration,
reduces deployment coordination, and produces one versioned artifact. Static
assets can move to a CDN and the API can scale separately if measured traffic
justifies the added operational complexity.

### Bundled DuckDB instead of a managed database

The dataset is precomputed and read-only, so bundling DuckDB makes a deployment
self-contained and repeatable. It is not suitable for concurrent writes or
independent data updates; a new dataset currently requires building a new image.

### Free hosting instead of an always-on instance

The first version avoids a compute subscription and needs no persistent disk
because the database is read-only and included in the image. The trade-off is
that the service sleeps after 15 minutes without traffic and can take about a
minute to wake. This is acceptable for an initial portfolio demo but is not an
availability guarantee. Upgrade only if actual recruiter use or measurements
show that the cold start is harmful. External images remain dependent on the
public Hugging Face dataset/CDN.

### Pinned direct dependencies, floating transitive dependencies

Direct Python runtime dependencies are pinned, including DuckDB 1.4.4. Pip still
resolves transitive dependencies during a build. A lock or constraints file is
future work if rebuilds show dependency drift.

## Measured baseline

Measured on 2026-09-13 using Docker Desktop 29.4.2 on Apple Silicon:

| Signal | Result |
| --- | ---: |
| Docker build context | 7.52 MB |
| Runtime image size | 73,977,075 bytes |
| DuckDB file size | 7.0 MB |
| Backend tests | 22 passed |
| Python statement coverage | 93.29% |
| Frontend JavaScript bundle | 238.39 kB |
| Frontend JavaScript bundle, gzip | 76.03 kB |
| Container user | `app` |
| Application code writable by `app` | no |
| Root filesystem in smoke test | read-only |
| Configurable-port smoke test | healthy on `PORT=8123` |
| `/` smoke test | 200 HTML |
| `/health/live` smoke test | 200 JSON |
| `/health/ready` smoke test | 200 JSON |
| `/api/stats` smoke test | 200 JSON |

These are environment-specific engineering measurements, not claims about
public users, production uptime, or sustained load capacity.

## Latest local verification

Measured on 2026-09-18 against the bundled DuckDB dataset on the logging-fix
branch (not yet deployed):

| Signal | Result |
| --- | ---: |
| Backend tests | 44 passed |
| UI–API contract test cases | 18 passed |
| Python statement coverage | 99.42% |
| Frontend production build | passed |
| Docker smoke test including JSON request log | passed |

The contract tests check the API fields, numeric types, and selected enum values
that the React views consume. They do not replace a browser test of rendering,
interaction, or external image availability.

## Local API latency baseline

Measured on 2026-09-17 with Docker Desktop 29.4.2 on Apple Silicon
(macOS 26.6.2). The production image was
`sha256:e30c223c8429ec49089458f566e6c4008c06c2520496998745970feef9ade235`
(74,157,003 bytes), running one Uvicorn worker with a read-only filesystem.
The benchmark client used Python 3.11 and HTTPX 0.27.2 in a separate container
sharing the app container's network namespace. The bundled DuckDB file was
7,352,320 bytes; `/api/stats` reported 3,000 SD images, 34,178 SD concepts,
2,699 FLUX images, and 30,191 FLUX concepts.

| GET endpoint | Warm-up | Measured requests | Concurrent requests | p50 | p95 | Throughput | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/api/stats` | 20 | 1,000 | 5 | 4.89 ms | 7.63 ms | 974.47 req/s | 0 |
| `/api/rq4/paired-scatter` | 10 | 200 | 5 | 37.85 ms | 48.96 ms | 126.02 req/s | 0 |

`scripts/benchmark_api.py` measures client-observed time to receive the full
JSON response. Its p95 is the nearest-rank 95th percentile of successful
requests only; failures are counted separately and make the command fail.
Throughput is all measured requests divided by wall-clock duration. These are
short, local bursts, **not** sustained-capacity, internet-latency, or public
uptime claims. A public deployment needs its own measurement.

To reproduce the container-to-container method, build the image, start it,
confirm `/health/ready`, then run the client in the same network namespace:

```bash
docker build --tag alignment-auditor:bench .
docker run --detach --rm --name alignment-auditor-bench --read-only --tmpfs /tmp alignment-auditor:bench
docker exec alignment-auditor-bench python -c 'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:8000/health/ready").status)'
docker run --rm --network container:alignment-auditor-bench \
  --mount "type=bind,src=$PWD,dst=/app,readonly" --workdir /app python:3.11-slim \
  sh -c 'python -m pip install --quiet httpx==0.27.2 && python scripts/benchmark_api.py --base-url http://127.0.0.1:8000 --path /api/stats --requests 1000 --concurrency 5 --warmup 20'
docker stop alignment-auditor-bench
```

Repeat the client command with `--path /api/rq4/paired-scatter --requests 200
--warmup 10` for the second row. Always stop the temporary container when
finished.
