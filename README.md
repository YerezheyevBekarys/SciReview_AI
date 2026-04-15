# SciReview AI

SciReview AI is a hackathon MVP for scientific document review. The application analyzes scientific technical specifications, grant applications, and R&D documents, identifies structural and semantic weaknesses, scores document quality, and proposes an improved expert-style revision.

## What problem it solves

Scientific technical specifications and research proposals are often incomplete, vague, inconsistent, or difficult to assess quickly. SciReview AI helps teams and reviewers reduce manual review time and improve document quality before submission or expert evaluation.

## Core capabilities

- Upload and parse TXT, PDF, and DOCX documents
- Analyze scientific technical specifications, grant applications, and R&D documents
- Detect missing sections, weak formulations, KPI gaps, timeline issues, and semantic inconsistencies
- Produce a quality score with criterion-level breakdown
- Generate recommendations and an improved version of the document
- Use compressed expert analysis mode for long documents to stay within LLM limits
- Work in baseline mode even when external AI access is unavailable

## Scientific document focus

SciReview AI is designed specifically for:

- scientific technical specifications
- grant applications
- R&D / NIOKR documentation
- research-oriented supporting documents

The review logic combines document structure checks, semantic consistency analysis, and external AI-assisted evaluation when a valid API key is provided.

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Vitest
- Groq API integration for extended analysis
- PDF parsing with `pdfjs-dist`
- DOCX parsing with `mammoth`
- PWA support with `vite-plugin-pwa`

## Local запуск

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm run dev
```

The application will usually be available at `http://localhost:8080`.

## Build and test

```bash
npm run typecheck
npm run test
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## MVP status

Current status: hackathon-ready MVP.

Implemented:

- clean single-product SciReview AI interface
- scientific document analysis flow
- PDF/DOCX/TXT ingestion
- long-document prompt compression for stable extended analysis
- baseline fallback mode
- PWA-ready frontend for laptop and mobile demo

## Notes for reviewers and jury

- The project is optimized for scientific technical specification review rather than generic chat.
- Extended AI analysis requires a valid API key in local environment or the hidden access settings panel.
- If external AI is unavailable, the application still performs baseline structural and semantic review.
