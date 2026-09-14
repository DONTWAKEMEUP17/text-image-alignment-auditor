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
