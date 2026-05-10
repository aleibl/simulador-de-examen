/* =========================================================
   app.js — Orchestration layer: wires events, timers, flow.
   ========================================================= */
(function () {
  "use strict";

  const state = {
    bank: null,              // loaded question bank
    session: null,           // active exam session (in-memory only)
    timerHandle: null,       // setInterval handle for the 500 ms polling tick
    autoAdvanceTimeout: null, // setTimeout handle for answer-triggered question advance
    lastSettings: null
  };

  /* ---- Theme ---- */
  // Follow OS color-scheme preference; allow manual toggle.
  // No localStorage — avoids blocking the app when storage is restricted.
  function initTheme() {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", (e) => setTheme(e.matches ? "dark" : "light"));
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  }

  /* ---- Boot ---- */
  async function boot() {
    initTheme();
    bindStartScreen();
    bindExamScreen();
    bindResultsScreen();
    bindBeforeUnload();

    try {
      const bank = await QuestionBank.loadFromUrl();
      state.bank = bank;
      UI.renderStart(bank);
    } catch (err) {
      document.getElementById("start-description").textContent =
        "No se pudo cargar el banco de preguntas. " + err.message;
      console.error(err);
    }
  }

  /* ---- Start screen ---- */
  function bindStartScreen() {
    document.getElementById("start-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state.bank) return;
      let session;
      try {
        const settings = UI.readSettings();
        state.lastSettings = settings;
        session = Exam.createSession(state.bank, settings);
      } catch (err) {
        UI.showToast(err.message, 3500);
        return;
      }
      startSession(session);
    });

    document.getElementById("cfg-import").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      const status = document.getElementById("import-status");
      if (!file) return;
      try {
        const bank = await QuestionBank.loadFromFile(file);
        state.bank = bank;
        UI.renderStart(bank, state.lastSettings);
        status.textContent = `Se cargó "${file.name}" — ${bank.questions.length} preguntas.`;
        status.style.color = "var(--success)";
      } catch (err) {
        status.textContent = "Error al importar: " + err.message;
        status.style.color = "var(--error)";
      }
    });
  }

  /* ---- Exam session lifecycle ---- */
  function startSession(session) {
    state.session = session;
    UI.showScreen("exam");
    UI.renderExam(session);
    UI.renderTimer(session);
    // Start the polling tick when either timer is active
    if (session.timeLimitMs || session.questionTimerMs) {
      state.timerHandle = setInterval(tickTimer, 500);
    }
  }

  /** Called every 500 ms to update both timer displays and check for expiry. */
  function tickTimer() {
    const s = state.session;
    if (!s || s.finished) return;

    UI.renderTimer(s);

    // Check total exam timer first — it takes priority
    if (Exam.timeRemaining(s) <= 0) {
      UI.showToast("¡Se acabó el tiempo! Enviando tu examen.", 3000);
      finishSession(true);
      return;
    }

    // Check per-question timer; cancel any answer-triggered advance to avoid double-jump
    if (s.questionTimerMs && Exam.questionTimeRemaining(s) <= 0) {
      cancelAutoAdvance();
      if (s.currentIndex < s.questions.length - 1) {
        Exam.next(s); // goTo() inside next() also resets the per-question timer
        UI.renderExam(s);
      } else {
        // Time expired on the last question — submit
        finishSession(false);
      }
    }
  }

  /** Cancel any pending answer-triggered auto-advance. */
  function cancelAutoAdvance() {
    if (state.autoAdvanceTimeout) {
      clearTimeout(state.autoAdvanceTimeout);
      state.autoAdvanceTimeout = null;
    }
  }

  function bindExamScreen() {
    // Delegated listener for option selection.
    // Selecting any answer automatically advances to the next question after a
    // short delay (so the user can see their selection highlighted briefly).
    document.getElementById("q-options").addEventListener("change", (e) => {
      const t = e.target;
      if (!t || !t.matches('input[type="radio"]')) return;

      Exam.answer(state.session, parseInt(t.value, 10));

      // Update progress bar without re-rendering the whole question card
      const answered = Exam.answeredCount(state.session);
      const pct = Math.round((answered / state.session.questions.length) * 100);
      const bar = document.getElementById("progress-bar");
      bar.style.width = pct + "%";
      bar.parentElement.setAttribute("aria-valuenow", pct);

      // Schedule auto-advance; cancel any previous one first
      cancelAutoAdvance();
      state.autoAdvanceTimeout = setTimeout(() => {
        state.autoAdvanceTimeout = null;
        const s = state.session;
        if (!s || s.finished) return;
        if (s.currentIndex < s.questions.length - 1) {
          Exam.next(s); // also resets per-question timer
          UI.renderExam(s);
        } else {
          // Last question answered — submit without confirmation dialog
          finishSession(false);
        }
      }, 400);
    });

    // Manual submit button — shows confirmation when questions are unanswered
    document.getElementById("btn-submit").addEventListener("click", () => {
      const s = state.session;
      const unanswered = s.questions.length - Exam.answeredCount(s);
      const msg =
        unanswered === 0
          ? "¿Entregar el examen? No podrás modificar tus respuestas después."
          : `Tienes ${unanswered} pregunta${unanswered === 1 ? "" : "s"} sin responder. ¿Entregar de todos modos?`;
      document.getElementById("confirm-message").textContent = msg;
      const dlg = document.getElementById("confirm-dialog");
      if (typeof dlg.showModal === "function") {
        dlg.showModal();
        dlg.addEventListener(
          "close",
          () => {
            if (dlg.returnValue === "ok") finishSession(false);
          },
          { once: true }
        );
      } else {
        // Fallback for browsers without native <dialog> support
        if (window.confirm(msg)) finishSession(false);
      }
    });

    // Keyboard shortcuts: 1–4 choose answer (which then auto-advances)
    document.addEventListener("keydown", (e) => {
      if (!state.session || state.session.finished) return;
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (document.getElementById("screen-exam").classList.contains("hidden")) return;

      if (/^[1-4]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const radio = document.querySelector(
          `input[name="q-${state.session.currentIndex}"][value="${idx}"]`
        );
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  function finishSession(timedOut) {
    cancelAutoAdvance();
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
    const results = Exam.submit(state.session);
    UI.renderResults(results);
    UI.showScreen("results");
    if (timedOut) UI.showToast("Tiempo agotado.", 2500);
  }

  /* ---- Results screen ---- */
  function bindResultsScreen() {
    document.getElementById("btn-restart").addEventListener("click", () => {
      state.session = null;
      UI.showScreen("start");
      UI.renderStart(state.bank, state.lastSettings);
    });
    document.getElementById("btn-print").addEventListener("click", () => {
      window.print();
    });
  }

  /* ---- beforeunload guard ---- */
  // Browsers show their own dialog text; the custom string is ignored.
  function bindBeforeUnload() {
    window.addEventListener("beforeunload", (e) => {
      if (state.session && !state.session.finished) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
