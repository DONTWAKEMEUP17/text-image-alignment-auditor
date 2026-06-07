# Alignment Auditor

## Description

Alignment Auditor is an interactive visual analytics tool for evaluating how well text-to-image generative models render the concepts described in their input prompts. The project uses CLIP scores — a measure of semantic similarity between an image and its prompt — to quantify and compare alignment quality across two models: **Stable Diffusion 1.x (SD 1.x)** and **FLUX.1**.

The tool is organized around four research questions:

- **RQ1** — What is the overall distribution of alignment scores across the dataset?
- **RQ2** — Which concept categories (nouns vs. adjectives) are harder for models to render, and which specific concepts fail most often?
- **RQ3** — How does the CFG (Classifier-Free Guidance) scale parameter affect alignment in SD 1.x?
- **RQ4** — How do SD 1.x and FLUX.1 compare head-to-head on the same prompts?

The backend is a **FastAPI** server backed by a **DuckDB** database containing pre-computed CLIP scores for ~3,000 SD 1.x images and ~2,700 FLUX.1 images. The frontend is a **React + Vite** single-page application with interactive charts (histograms, box plots, scatter plots, heatmaps) and a linked image gallery that lets users drill down from aggregate trends to individual images and their per-concept scores.

## Installation

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
# From the project root
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```bash
cd client
npm install
```

## Execution

You need to run the backend and frontend in two separate terminals.

### 1. Start the backend

```bash
# From the project root (with .venv activated)
cd server
uvicorn server:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### 2. Start the frontend

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser to use the application.

### Optional environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `server/alignment_auditor.duckdb` | Path to the DuckDB database |
