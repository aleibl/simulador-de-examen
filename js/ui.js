/* =========================================================
   ui.js — DOM rendering helpers.
   Pure rendering: no exam logic. All functions accept a
   session or results object and update the DOM accordingly.
   ========================================================= */
(function (global) {
  "use strict";

  /** Activate a named screen ("start" | "exam" | "results"); hide the others. */
  function showScreen(name) {
    ["start", "exam", "results"].forEach((s) => {
      const el = document.getElementById(`screen-${s}`);
      if (!el) return;
      el.classList.toggle("hidden", s !== name);
    });
    // Move focus to the main region for screen-reader announcements
    const main = document.getElementById("main");
    if (main) main.focus({ preventScroll: true });
  }

  /** Populate the start screen with bank metadata and module radio buttons. */
  function renderStart(bank, prevSettings) {
    document.getElementById("start-title").textContent =
      bank.meta.title || "Simulador de Examen";
    document.getElementById("start-description").textContent =
      bank.meta.description || "";

    const categories = Array.from(new Set(bank.questions.map((q) => q.category)));
    document.getElementById("meta-total-questions").textContent = bank.questions.length;
    document.getElementById("meta-categories").textContent = categories.length;
    document.getElementById("meta-pass-mark").textContent =
      `${bank.meta.passingScore || 0}%`;

    // Render each category as a mutually exclusive radio button
    const wrap = document.getElementById("cfg-categories");
    wrap.innerHTML = "";
    const prevCat =
      prevSettings && prevSettings.categories && prevSettings.categories[0];
    categories.forEach((cat, idx) => {
      const id = `cat-${cat.replace(/\W+/g, "-").toLowerCase()}`;
      // Restore previously selected module; default to the first one
      const isSelected = prevCat ? cat === prevCat : idx === 0;
      const label = document.createElement("label");
      label.className = "check";
      label.innerHTML = `
        <input type="radio" id="${id}" name="cfg-category" value="${escapeAttr(cat)}" ${isSelected ? "checked" : ""} />
        <span>${escapeHtml(cat)}</span>
      `;
      wrap.appendChild(label);
    });
  }

  /** Read the start-screen form and return a settings object. */
  function readSettings() {
    const selectedCat = document.querySelector(
      '#cfg-categories input[name="cfg-category"]:checked'
    );
    return {
      // count and timeLimitMinutes come from bank meta defaults; no form inputs for them
      categories: selectedCat ? [selectedCat.value] : null,
      shuffleQuestions: document.getElementById("cfg-shuffle-q").checked,
      shuffleOptions: document.getElementById("cfg-shuffle-o").checked
    };
  }

  /** Render the current question card and progress bar. */
  function renderExam(session) {
    const i = session.currentIndex;
    const q = session.questions[i];
    document.getElementById("q-current").textContent = i + 1;
    document.getElementById("q-total").textContent = session.questions.length;
    document.getElementById("q-category").textContent = q.category;
    document.getElementById("q-prompt").textContent = q.prompt;

    // Build option list in the session-determined display order
    const optsEl = document.getElementById("q-options");
    optsEl.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    q.optionOrder.forEach((origIdx, displayIdx) => {
      const li = document.createElement("li");
      li.className = "option";
      const inputId = `opt-${i}-${displayIdx}`;
      const checked = session.answers[i] === displayIdx ? "checked" : "";
      li.innerHTML = `
        <input type="radio" name="q-${i}" id="${inputId}" value="${displayIdx}" ${checked} />
        <label for="${inputId}" class="opt-label" style="display:contents">
          <span class="opt-key" aria-hidden="true">${letters[displayIdx]}</span>
          <span class="opt-text">${escapeHtml(q.options[origIdx])}</span>
        </label>
      `;
      optsEl.appendChild(li);
    });

    // Progress bar
    const answered = Exam.answeredCount(session);
    const pct = Math.round((answered / session.questions.length) * 100);
    const bar = document.getElementById("progress-bar");
    bar.style.width = pct + "%";
    bar.parentElement.setAttribute("aria-valuenow", pct);
  }

  /** Update both the total-time and per-question timer displays. */
  function renderTimer(session) {
    // Total exam countdown
    const totalEl = document.getElementById("timer-total");
    if (totalEl) {
      if (!session.timeLimitMs) {
        totalEl.textContent = "∞";
        totalEl.classList.remove("warn", "critical");
      } else {
        const remaining = Exam.timeRemaining(session);
        totalEl.textContent = Exam.formatDuration(remaining);
        totalEl.classList.toggle("warn", remaining <= 60_000 && remaining > 15_000);
        totalEl.classList.toggle("critical", remaining <= 15_000);
      }
    }

    // Per-question countdown
    const qEl = document.getElementById("timer-question");
    if (qEl) {
      if (!session.questionTimerMs) {
        qEl.textContent = "∞";
        qEl.classList.remove("warn", "critical");
      } else {
        const qRemaining = Exam.questionTimeRemaining(session);
        qEl.textContent = Exam.formatDuration(qRemaining);
        // Warn thresholds are tighter for the short per-question timer
        qEl.classList.toggle("warn", qRemaining <= 10_000 && qRemaining > 5_000);
        qEl.classList.toggle("critical", qRemaining <= 5_000);
      }
    }
  }

  /** Render the results screen with summary stats and per-question review cards. */
  function renderResults(results) {
    // Main score shown as "X.X / 10" (0.5 points per correct answer)
    document.getElementById("result-percent").textContent =
      results.points.toFixed(1) + " / " + results.pointsMax;
    document.getElementById("result-score").textContent =
      `${results.correct} / ${results.total}`;
    document.getElementById("result-time").textContent =
      Exam.formatDuration(results.elapsedMs);
    document.getElementById("result-passmark").textContent =
      results.pointsPassing.toFixed(1) + " / 10";
    document.getElementById("result-unanswered").textContent = results.skipped;

    const verdict = document.getElementById("result-verdict");
    verdict.textContent = results.passed ? "Aprobado" : "Reprobado";
    verdict.classList.toggle("pass", results.passed);
    verdict.classList.toggle("fail", !results.passed);

    const list = document.getElementById("review-list");
    list.innerHTML = "";
    const letters = ["A", "B", "C", "D"];
    results.items.forEach((it) => {
      const card = document.createElement("article");
      card.className =
        "review-item " + (it.skipped ? "skipped" : it.isCorrect ? "correct" : "incorrect");

      const optsHtml = it.displayedOptions
        .map((text, i) => {
          const isCorrect = i === it.displayCorrectIndex;
          const isChosen = i === it.chosenIndex;
          let cls = "";
          let badge = "";
          if (isCorrect) {
            cls = "correct";
            badge = `<span class="badge" style="color:var(--success)">Correcta</span>`;
          }
          if (isChosen && !isCorrect) {
            cls = "chosen-wrong";
            badge = `<span class="badge" style="color:var(--error)">Tu respuesta</span>`;
          } else if (isChosen && isCorrect) {
            badge += ` <span class="badge" style="color:var(--accent)">Tu respuesta</span>`;
          }
          return `<li class="${cls}"><strong>${letters[i]}.</strong> ${escapeHtml(text)}${badge}</li>`;
        })
        .join("");

      card.innerHTML = `
        <div class="muted" style="font-size:.8rem;margin-bottom:6px">
          P${it.index + 1} · ${escapeHtml(it.category)}
        </div>
        <div class="review-q">${escapeHtml(it.prompt)}</div>
        <ul class="review-options">${optsHtml}</ul>
        ${
          it.explanation
            ? `<div class="review-explanation"><strong>Por qué:</strong> ${escapeHtml(it.explanation)}</div>`
            : ""
        }
      `;
      list.appendChild(card);
    });
  }

  function showToast(msg, ms) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      el.hidden = true;
    }, ms || 2400);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  global.UI = {
    showScreen,
    renderStart,
    readSettings,
    renderExam,
    renderTimer,
    renderResults,
    showToast
  };
})(window);
