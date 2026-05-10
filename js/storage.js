/* =========================================================
   storage.js — Question bank loader.
   Fetches questions.json relative to index.html so the app
   works on GitHub Pages project sites (user.github.io/repo/).
   Also supports loading a user-imported File from disk.
   No localStorage — data lives in memory only.
   ========================================================= */
(function (global) {
  "use strict";

  // Resolved relative to index.html, not to this script file
  const DEFAULT_URL = "./data/questions.json";

  /**
   * Validate the shape of a parsed question bank.
   * Throws on the first structural error so bad imports fail loudly.
   */
  function validateBank(bank) {
    if (!bank || typeof bank !== "object") {
      throw new Error("Archivo inválido: se esperaba un objeto JSON.");
    }
    if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
      throw new Error("Archivo inválido: 'questions' debe ser un array no vacío.");
    }
    bank.questions.forEach((q, i) => {
      const where = `Pregunta ${i + 1}`;
      if (!q || typeof q !== "object")
        throw new Error(`${where}: no es un objeto.`);
      if (typeof q.prompt !== "string" || !q.prompt.trim())
        throw new Error(`${where}: falta el enunciado (prompt).`);
      if (!Array.isArray(q.options) || q.options.length !== 4)
        throw new Error(`${where}: debe tener exactamente 4 opciones.`);
      if (
        typeof q.answer !== "number" ||
        q.answer < 0 ||
        q.answer > 3 ||
        !Number.isInteger(q.answer)
      )
        throw new Error(`${where}: 'answer' debe ser un entero entre 0 y 3.`);
    });
    return true;
  }

  /** Fill in default values for optional bank fields. */
  function normalizeBank(bank) {
    const meta = Object.assign(
      {
        title: "Simulador de Examen",
        description: "",
        passingScore: 70,
        defaultTimeLimitMinutes: 10,
        defaultQuestionTimeLimitSeconds: 30
      },
      bank.meta || {}
    );
    const questions = bank.questions.map((q, i) => ({
      id: q.id || `q${i + 1}`,
      category: q.category || "General",
      prompt: q.prompt,
      options: q.options.slice(0, 4),
      answer: q.answer,
      explanation: q.explanation || ""
    }));
    return { meta, questions };
  }

  async function loadFromUrl(url) {
    const target = url || DEFAULT_URL;
    const res = await fetch(target, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`No se pudo cargar ${target} (HTTP ${res.status}).`);
    }
    const data = await res.json();
    validateBank(data);
    return normalizeBank(data);
  }

  function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          validateBank(data);
          resolve(normalizeBank(data));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  global.QuestionBank = { loadFromUrl, loadFromFile };
})(window);
