# Simulador de Examen

Simulador de exámenes de opción múltiple que funciona completamente en el navegador. HTML, CSS y JavaScript puro — sin backend, sin framework, sin paso de compilación. Diseñado para publicarse directamente en GitHub Pages.

## Qué hace

- Pantalla de inicio con título, descripción, número de preguntas y selector de módulo
- Doble cuenta regresiva: 10 minutos en total y 30 segundos por pregunta, ambas siempre visibles
- Al seleccionar una respuesta, avanza automáticamente a la siguiente pregunta tras 400 ms; el temporizador por pregunta también avanza automáticamente al agotarse
- Sin navegación manual — las preguntas avanzan en orden; la última pregunta entrega el examen automáticamente
- Preguntas de opción única con 4 alternativas y mezcla opcional de preguntas y opciones
- Puntuación: 0,5 puntos por respuesta correcta, máximo 10 puntos; nota mínima 5,0 / 10
- Pantalla de resultados con puntuación, veredicto aprobado/reprobado, tiempo transcurrido y revisión pregunta por pregunta con la respuesta correcta, la elegida y la explicación
- Importación de un banco de preguntas alternativo desde un archivo `.json` local
- Atajos de teclado: `1`–`4` para seleccionar una opción

## Estructura del proyecto

```
simulador-de-examen/
├── index.html              # página principal (pantallas: inicio, examen, resultados)
├── 404.html                # página de error para GitHub Pages
├── .nojekyll               # desactiva el procesamiento Jekyll en GH Pages
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
├── js/
│   ├── storage.js          # carga y validación de JSON
│   ├── exam.js             # estado de sesión, puntuación y temporizadores (sin DOM)
│   ├── ui.js               # funciones de renderizado DOM (sin lógica de examen)
│   └── app.js              # eventos y secuencia de arranque
├── data/
│   └── questions.json      # banco de preguntas activo
└── .github/workflows/
    └── pages.yml           # despliegue automático a GitHub Pages en cada push a main
```

## Ejecución local

La aplicación usa `fetch()` para cargar `data/questions.json`, lo que requiere un servidor HTTP — abrir `index.html` directamente como `file://` no funcionará.

```bash
# Python 3 (incluido en macOS y la mayoría de Linux):
python3 -m http.server 8080

# Node:
npx --yes serve .
```

Abrir `http://localhost:8080` en el navegador.

## Formato del banco de preguntas

```jsonc
{
  "meta": {
    "title": "Simulador de Examen",
    "description": "Subtítulo opcional en la pantalla de inicio",
    "passingScore": 50,                       // porcentaje (50 → 5,0/10)
    "defaultTimeLimitMinutes": 10,
    "defaultQuestionTimeLimitSeconds": 30
  },
  "questions": [
    {
      "id": "q01",                            // opcional, se asigna automáticamente si falta
      "category": "Módulo 1",                 // se usa para el selector de módulo
      "prompt": "Texto de la pregunta",
      "options": ["A", "B", "C", "D"],        // exactamente 4 cadenas de texto
      "answer": 1,                            // índice base 0 en options
      "explanation": "Se muestra en la revisión" // opcional pero recomendado
    }
  ]
}
```

El cargador valida cada pregunta al inicio y muestra el primer error en la interfaz. Cada módulo debe tener al menos una pregunta; el examen incluye todas las preguntas del módulo seleccionado.

## Puntuación

- 0,5 puntos por respuesta correcta, máximo 10 puntos (para sesiones de 20 preguntas)
- Sin penalización por respuestas incorrectas o sin responder
- Nota mínima: `passingScore` por ciento de 10 (por defecto 50 % → 5,0 / 10)
- El tiempo transcurrido es el tiempo real desde el inicio hasta la entrega o el agotamiento del tiempo

## Publicación en GitHub Pages

1. Subir esta carpeta a un repositorio de GitHub.
2. En **Settings → Pages**, seleccionar **GitHub Actions** como fuente — el workflow incluido publica automáticamente en cada push a `main`.
3. Visitar `https://<usuario>.github.io/<repositorio>/` una vez que el workflow finalice.

## Limitaciones

- **Las respuestas son visibles.** `data/questions.json` se sirve tal cual; cualquier persona con las herramientas de desarrollo del navegador puede leer las respuestas correctas. No usar para evaluaciones de alto impacto ni con supervisión.
- **Sin persistencia.** El progreso está en memoria; recargar la página reinicia todo.
- **El control del tiempo es del lado del cliente.** Un usuario con conocimientos técnicos puede manipularlo mediante las herramientas de desarrollo.

---

# Exam Simulator

A browser-only multiple-choice exam simulator with a Spanish interface. Static HTML, CSS, and vanilla JavaScript — no backend, no framework, no build step. Designed to be served directly from GitHub Pages.

## What it does

- Start screen showing bank title, description, question count, and module selector
- Dual countdown: 10-minute total timer + 30-second per-question timer, both always visible
- Selecting an answer auto-advances to the next question after 400 ms; the per-question timer also auto-advances when it expires
- No manual navigation — questions flow forward only; the last question auto-submits
- 4-option single-answer MCQs with optional question and option shuffling
- Scoring: 0.5 points per correct answer, 10 points maximum; pass mark is 5.0 / 10
- Results screen with score, pass/fail verdict, elapsed time, and a per-question review showing the correct answer, the chosen answer, and the explanation
- Import an alternate question bank from a local `.json` file at runtime
- Keyboard shortcuts: `1`–`4` to select an option

## Project structure

```
simulador-de-examen/
├── index.html              # main page (start, exam, results screens)
├── 404.html                # GitHub Pages fallback
├── .nojekyll               # disables Jekyll processing on GH Pages
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
├── js/
│   ├── storage.js          # JSON loader + validator
│   ├── exam.js             # session state, scoring, timers (no DOM)
│   ├── ui.js               # DOM rendering helpers (no exam logic)
│   └── app.js              # event wiring and boot sequence
├── data/
│   └── questions.json      # active question bank
└── .github/workflows/
    └── pages.yml           # auto-deploy to GitHub Pages on push to main
```

## Running locally

The app uses `fetch()` to load `data/questions.json`, which requires an HTTP server — opening `index.html` directly via `file://` will fail.

```bash
# Python 3 (built into macOS / most Linux):
python3 -m http.server 8080

# Node:
npx --yes serve .
```

Then open `http://localhost:8080`.

## Question bank format

```jsonc
{
  "meta": {
    "title": "Simulador de Examen",
    "description": "Optional subtitle shown on start screen",
    "passingScore": 50,                       // percent (50 → 5.0/10)
    "defaultTimeLimitMinutes": 10,
    "defaultQuestionTimeLimitSeconds": 30
  },
  "questions": [
    {
      "id": "q01",                            // optional, auto-assigned if missing
      "category": "Módulo 1",                 // used for the module selector
      "prompt": "Question text",
      "options": ["A", "B", "C", "D"],        // exactly 4 strings
      "answer": 1,                            // 0-based index into options
      "explanation": "Shown in review"        // optional but recommended
    }
  ]
}
```

The loader validates every question on load and surfaces the first error in the UI. Each module must have at least one question; the exam draws all questions from the selected module.

## Scoring

- 0.5 points per correct answer, 10 points maximum (assumes 20 questions per session)
- No penalty for wrong or skipped answers
- Pass mark: `passingScore` percent of 10 (default 50 % → 5.0 / 10)
- Elapsed time is wall-clock from start to submit or time-out

## Publishing to GitHub Pages

1. Push this folder to a GitHub repository.
2. In **Settings → Pages**, set the source to **GitHub Actions** — the included workflow publishes on every push to `main`.
3. Visit `https://<user>.github.io/<repo>/` once the workflow finishes.

## Static-only limitations

- **Answers are inspectable.** `data/questions.json` is served as-is; anyone with browser dev tools can read the correct answers. Do not use this for high-stakes or proctored assessment.
- **No persistence.** Progress is in memory only; reloading the page resets everything.
- **Time enforcement is client-side.** A determined user can manipulate it via dev tools.
