# 273 Final Project — Alignment Auditor

## Getting Started

```bash
npm install
npm run dev
```


## Project Structure

```
src/
├── main.jsx       Entry point
├── App.jsx        Global state, topbar, statusbar, view switcher
├── App.css        All styles and design tokens (light/dark mode)
├── data.js        Mock data + color utilities
├── Charts.jsx     All 6 chart components (Histogram, ConceptBar, CFGLine, GainBar, DeltaList, GroupedBar)
├── Gallery.jsx    ImageGallery, CompareGallery, DetailPanel
├── RQ12.jsx       RQ1+2 view — score distribution & concept failure map
├── RQ3.jsx        RQ3 view — CFG scale vs alignment
└── RQ4.jsx        RQ4 view — SD 1.x vs FLUX.1 model comparison
```

## Research Questions

| RQ | Question |
|----|----------|
| **RQ1** | What does the overall prompt–image alignment score distribution look like across DiffusionDB? |
| **RQ2** | Which concept categories (content nouns, style terms, emotion adjectives, spatial relations, counting/negation) systematically fail? |
| **RQ3** | Does increasing CFG scale recover alignment for failing categories? |
| **RQ4** | Does FLUX.1 [schnell] improve on SD 1.x failures, and for which concept types? |

