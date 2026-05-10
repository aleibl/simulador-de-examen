# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

This is a static site with no build step. Because it uses `fetch()` to load `data/questions.json`, it must be served over HTTP — opening `index.html` directly as a `file://` URL will fail.

```bash
# Python (built-in)
python3 -m http.server 8080

# Node (npx)
npx serve .
```

There are no tests, no linter, no transpiler, and no package manager.

## Deployment

Pushing to `main` auto-deploys via `.github/workflows/pages.yml` (GitHub Pages, no build step).

## Architecture

Four vanilla-JS modules, each a plain IIFE or object literal, loaded via `<script>` tags at the bottom of `index.html` in this order:

| Module | Responsibility |
|---|---|
| `js/storage.js` | Fetch/validate/normalize `questions.json`; expose `QuestionBank` |
| `js/exam.js` | All session state, scoring, timing — **no DOM access** |
| `js/ui.js` | All DOM reads/writes — **no exam logic** |
| `js/app.js` | Global `state` object, event wiring, boot sequence |

`app.js` is the only module that imports from all three others. `exam.js` and `ui.js` are deliberately side-effect-free and know nothing about each other.

**Single HTML file**: `index.html` contains all three screens (start, exam, results) simultaneously. Visibility is toggled with a `.hidden` class via `UI.showScreen()`.

## Question Bank Schema

```json
{
  "meta": {
    "title": "...",
    "description": "...",
    "passingScore": 70,
    "defaultTimeLimitMinutes": 20
  },
  "questions": [
    {
      "id": "q01",
      "category": "...",
      "difficulty": "easy|medium|hard",
      "prompt": "Question text",
      "options": ["A", "B", "C", "D"],
      "answer": 1,
      "explanation": "..."
    }
  ]
}
```

Exactly 4 options; `answer` is a 0-based index. `id`, `category`, `difficulty`, and `explanation` are optional (auto-filled by `storage.js`). Validation errors are shown to the user on import.

## Option Shuffling

When shuffle is enabled, `exam.js` stores a per-question `optionOrder` array mapping display index → canonical index. The canonical `answer` in the JSON never changes; `Exam.getResults()` uses `optionOrder` to map the user's display-order selection back to the canonical answer when scoring.
