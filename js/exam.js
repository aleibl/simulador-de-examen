/* =========================================================
   exam.js — Exam session state, scoring, and timers.
   Pure module: no DOM access. All state lives on a session
   object; callers should use the provided methods, not
   mutate session fields directly.
   ========================================================= */
(function (global) {
  "use strict";

  /** Fisher-Yates in-place shuffle — returns a new array. */
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Build an exam session from a question bank and user settings.
   * Returns an in-memory session object (no persistence).
   */
  function createSession(bank, settings) {
    const cfg = Object.assign(
      {
        count: bank.questions.length,
        timeLimitMinutes: bank.meta.defaultTimeLimitMinutes || 0,
        // Per-question countdown; read from bank meta, overridable via settings
        questionTimerSeconds: bank.meta.defaultQuestionTimeLimitSeconds || 0,
        categories: null, // null = all categories
        shuffleQuestions: true,
        shuffleOptions: true
      },
      settings || {}
    );

    // Filter pool to selected categories
    let pool = bank.questions;
    if (Array.isArray(cfg.categories) && cfg.categories.length > 0) {
      const set = new Set(cfg.categories);
      pool = pool.filter((q) => set.has(q.category));
    }
    if (pool.length === 0) {
      throw new Error("No hay preguntas para el módulo seleccionado.");
    }

    // Optionally shuffle and cap to requested count
    let chosen = cfg.shuffleQuestions ? shuffled(pool) : pool.slice();
    chosen = chosen.slice(0, Math.min(cfg.count, chosen.length));

    // Per-question, build an optionOrder array that maps display index → canonical index.
    // Storing this lets us shuffle options without ever changing the canonical answer.
    const questions = chosen.map((q) => {
      const order = cfg.shuffleOptions ? shuffled([0, 1, 2, 3]) : [0, 1, 2, 3];
      return { ...q, optionOrder: order };
    });

    const now = Date.now();
    return {
      bank,
      meta: bank.meta,
      cfg,
      questions,
      // answers[i] = display-order index chosen by user, or null if not yet answered
      answers: new Array(questions.length).fill(null),
      currentIndex: 0,
      startedAt: now,
      submittedAt: null,
      // Total exam time limit (0 = untimed)
      timeLimitMs: cfg.timeLimitMinutes > 0 ? cfg.timeLimitMinutes * 60 * 1000 : 0,
      // Per-question countdown (0 = disabled)
      questionTimerMs: cfg.questionTimerSeconds > 0 ? cfg.questionTimerSeconds * 1000 : 0,
      questionStartedAt: now,
      finished: false
    };
  }

  /** Remaining total exam time in ms. Returns Infinity when untimed. */
  function timeRemaining(session) {
    if (!session.timeLimitMs) return Infinity;
    return Math.max(0, session.timeLimitMs - (Date.now() - session.startedAt));
  }

  /** Remaining time for the current question in ms. Returns Infinity when disabled. */
  function questionTimeRemaining(session) {
    if (!session.questionTimerMs) return Infinity;
    return Math.max(0, session.questionTimerMs - (Date.now() - session.questionStartedAt));
  }

  /** Reset the per-question countdown to its full duration. */
  function resetQuestionTimer(session) {
    session.questionStartedAt = Date.now();
  }

  /** Wall-clock elapsed time in ms, capped at submission time. */
  function elapsed(session) {
    return (session.submittedAt || Date.now()) - session.startedAt;
  }

  /** Record an answer (display-order index 0-3) for the current question. */
  function answer(session, displayIndex) {
    if (session.finished) return;
    session.answers[session.currentIndex] = displayIndex;
  }

  /** Advance to the next question; resets the per-question timer. */
  function next(session) {
    const target = Math.min(session.currentIndex + 1, session.questions.length - 1);
    if (session.currentIndex !== target) {
      session.currentIndex = target;
      resetQuestionTimer(session);
    }
  }

  /** Number of questions that have been answered (non-null). */
  function answeredCount(session) {
    return session.answers.reduce((n, a) => n + (a !== null ? 1 : 0), 0);
  }

  /**
   * Finalize the session and compute results.
   * Idempotent: calling twice returns the same results object.
   */
  function submit(session) {
    if (session.finished) return getResults(session);
    session.submittedAt = Date.now();
    session.finished = true;
    return getResults(session);
  }

  function getResults(session) {
    const items = session.questions.map((q, i) => {
      const displayIdx = session.answers[i];
      // Translate display position back to the canonical option index from the JSON
      const chosenOriginal = displayIdx == null ? null : q.optionOrder[displayIdx];
      const isCorrect = chosenOriginal === q.answer;
      return {
        index: i,
        id: q.id,
        category: q.category,
        prompt: q.prompt,
        // Options in the shuffled display order the user saw
        displayedOptions: q.optionOrder.map((o) => q.options[o]),
        // Position of the correct answer within the displayed list
        displayCorrectIndex: q.optionOrder.indexOf(q.answer),
        chosenIndex: displayIdx,
        chosenText: displayIdx == null ? null : q.options[chosenOriginal],
        correctText: q.options[q.answer],
        isCorrect,
        skipped: displayIdx == null,
        explanation: q.explanation
      };
    });

    const correct = items.filter((it) => it.isCorrect).length;
    const total = items.length;
    const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
    const passMark = session.meta.passingScore || 0;
    const passed = percent >= passMark;

    // Points scale: 0.5 per correct answer, max 10 (assumes 20 questions per module)
    const points = correct * 0.5;
    const pointsMax = 10;
    // Minimum passing score in points (passMark is stored as a percentage of 10)
    const pointsPassing = passMark * 0.1;

    return {
      total,
      correct,
      incorrect: total - correct - items.filter((it) => it.skipped).length,
      skipped: items.filter((it) => it.skipped).length,
      percent,
      passMark,
      passed,
      points,
      pointsMax,
      pointsPassing,
      elapsedMs: elapsed(session),
      items
    };
  }

  /** Format milliseconds as M:SS or H:MM:SS for timer displays. */
  function formatDuration(ms) {
    if (!isFinite(ms)) return "∞";
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  global.Exam = {
    createSession,
    timeRemaining,
    questionTimeRemaining,
    resetQuestionTimer,
    elapsed,
    answer,
    next,
    answeredCount,
    submit,
    getResults,
    formatDuration
  };
})(window);
