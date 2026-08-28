/**
 * sessionScores.js — Authoritative score reading & improvement calculation utility.
 *
 * This is the ONE place in the frontend that knows how to read
 * evaluation results and calculate improvement metrics accurately.
 *
 * Architecture:
 *   AI Evaluation → calculateScore() in backend/services/evaluation/scoreCalculator.js
 *       ↓
 *   session.finalScore            (authoritative overall score, 0–100)
 *   session.scores.*              (flat per-category scores, 0–100 each)
 *   session.criteria[]            (weighted per-criterion detail array)
 *       ↓
 *   getSessionScore()             ← use this everywhere in the frontend
 *   getSessionCategoryScores()    ← use this for Skill Matrix / Progress charts
 *   calculateImprovementRate()    ← use this for Improvement Rate calculations
 *
 * IMPORTANT RULES:
 *  - 0 is a valid, real score. NEVER use `score || fallback` for scores.
 *  - Use `score ?? fallback` (nullish coalescing) so that 0 is preserved.
 *  - Failed evaluations (analysisError / error status) are NOT valid scores.
 *  - null / undefined means "not yet evaluated" or "failed evaluation" — display "—" / "N/A".
 */

/**
 * Returns the authoritative overall score for a session.
 * Returns null if the session has not been evaluated yet or if evaluation failed.
 *
 * FAILED EVALUATION RULE:
 * If the session evaluation status is error / aiAnalysisCompleted === false / analysisError is set,
 * this is NOT a valid score. Returns null so it is not used as a baseline.
 *
 * @param {object} session - A session document from the API.
 * @returns {number|null}
 */
export function getSessionScore(session) {
  if (!session) return null;

  // Failed evaluation check (not a real score!)
  if (
    session.aiAnalysisCompleted === false ||
    session.analysisError ||
    session.mistakeAnalysis?.status === 'error'
  ) {
    return null;
  }

  // Primary: session.finalScore (set by scoreCalculator.calculateScore)
  if (typeof session.finalScore === 'number') return session.finalScore;

  // Legacy alias: session.scores.overall (set by buildFlatScores in sessionController)
  if (typeof session.scores?.overall === 'number') return session.scores.overall;

  // Not evaluated yet
  return null;
}

/**
 * Returns the authoritative per-category scores for a session.
 * Each value is either a number (0–100) or null (not evaluated).
 *
 * @param {object} session - A session document from the API.
 * @returns {object} { communication, confidence, fluency, grammar, vocabulary, leadership, clarity, topicRelevance, ... }
 */
export function getSessionCategoryScores(session) {
  if (
    !session ||
    session.aiAnalysisCompleted === false ||
    session.analysisError ||
    session.mistakeAnalysis?.status === 'error'
  ) {
    return {
      communication: null, confidence: null, fluency: null, grammar: null,
      vocabulary: null, leadership: null, clarity: null, topicRelevance: null,
      professionalism: null, listening: null, teamwork: null
    };
  }

  const scores = session.scores ?? {};

  return {
    communication:   typeof scores.communication   === 'number' ? scores.communication   : null,
    confidence:      typeof scores.confidence      === 'number' ? scores.confidence      : null,
    fluency:         typeof scores.fluency         === 'number' ? scores.fluency         : null,
    grammar:         typeof scores.grammar         === 'number' ? scores.grammar         : null,
    vocabulary:      typeof scores.vocabulary      === 'number' ? scores.vocabulary      : null,
    leadership:      typeof scores.leadership      === 'number' ? scores.leadership      : null,
    clarity:         typeof scores.clarity         === 'number' ? scores.clarity         : null,
    topicRelevance:  typeof scores.topicRelevance  === 'number' ? scores.topicRelevance  : null,
    professionalism: typeof scores.professionalism === 'number' ? scores.professionalism : null,
    listening:       typeof scores.listening       === 'number' ? scores.listening       : null,
    teamwork:        typeof scores.teamwork        === 'number' ? scores.teamwork        : null,
  };
}

/**
 * Calculates Improvement Rate between current Overall Score and previous Overall Score.
 * Formula: Math.round(((current - previous) / previous) * 100)
 *
 * ZERO BASELINE & MISSING BASELINE RULE:
 * - If previousScore === 0 OR previousScore === null/undefined OR currentScore === null/undefined:
 *   Returns null (DO NOT calculate a percentage, do NOT return 100%, Infinity, or NaN).
 *
 * @param {number|null} currentScore
 * @param {number|null} previousScore
 * @returns {number|null} Integer percentage change or null
 */
export function calculateImprovementRate(currentScore, previousScore) {
  if (
    currentScore === null ||
    currentScore === undefined ||
    previousScore === null ||
    previousScore === undefined
  ) {
    return null;
  }

  const current = Number(currentScore);
  const previous = Number(previousScore);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  // ZERO BASELINE RULE:
  // If previousScore === 0, DO NOT calculate a percentage. Return null.
  if (previous === 0) {
    return null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Formats signed improvement percentage string.
 * Positive: "+50%"
 * Zero: "0%"
 * Negative: "-25%"
 * Missing / Zero baseline (null/undefined): "N/A"
 *
 * @param {number|null} improvementRate
 * @returns {string}
 */
export function formatImprovementLabel(improvementRate) {
  if (improvementRate === null || improvementRate === undefined) {
    return "N/A";
  }
  const rate = Number(improvementRate);
  if (rate > 0) return `+${rate}%`;
  return `${rate}%`;
}

/**
 * Returns UI indicator text and color based on improvement rate.
 * - rate === null/undefined (zero baseline or missing): "No previous baseline", color: "#9CA3AF"
 * - rate > 0: "▲ Based on past evaluation history", color: "#34D399"
 * - rate < 0: "▼ Compared with past evaluation history", color: "#EF4444"
 * - rate === 0: "→ No change from past evaluation history", color: "#9CA3AF"
 *
 * @param {number|null} improvementRate
 * @returns {{ text: string, color: string }}
 */
export function getImprovementIndicator(improvementRate) {
  if (improvementRate === null || improvementRate === undefined) {
    return {
      text: "No previous baseline",
      color: "#9CA3AF"
    };
  }
  const rate = Number(improvementRate);
  if (rate > 0) {
    return {
      text: "▲ Based on past evaluation history",
      color: "#34D399"
    };
  } else if (rate < 0) {
    return {
      text: "▼ Compared with past evaluation history",
      color: "#EF4444"
    };
  } else {
    return {
      text: "→ No change from past evaluation history",
      color: "#9CA3AF"
    };
  }
}

// Backward-compatible alias
export const calcImprovementPct = calculateImprovementRate;
export const formatImprovementPct = formatImprovementLabel;
