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
 *  - null / undefined means "not yet evaluated" — display "—" in the UI.
 */

/**
 * Returns the authoritative overall score for a session.
 * Returns null if the session has not been evaluated yet.
 *
 * @param {object} session - A session document from the API.
 * @returns {number|null}
 */
export function getSessionScore(session) {
  if (!session) return null;

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
  const scores = session?.scores ?? {};

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
 * Rules & Edge Cases:
 * 1. 0 is a VALID score (never treat 0 as missing or falsy).
 * 2. Uses nullish checking (??) so 0 is preserved.
 * 3. Handles division by zero safely without producing NaN or Infinity:
 *    - If previous === 0:
 *        - If current === 0 => returns 0
 *        - If current > 0  => returns 100
 * 4. If current or previous score is missing/null/undefined/not finite => returns 0.
 * 5. Returns a rounded integer percentage.
 *
 * @param {number|null} currentScore
 * @param {number|null} previousScore
 * @returns {number} Integer percentage change
 */
export function calculateImprovementRate(currentScore, previousScore) {
  if (currentScore === null || currentScore === undefined || previousScore === null || previousScore === undefined) {
    return 0;
  }

  const current = Number(currentScore);
  const previous = Number(previousScore);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }

  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Formats signed improvement percentage string.
 * Positive: "+20%"
 * Zero: "0%"
 * Negative: "-20%"
 *
 * @param {number} improvementRate
 * @returns {string}
 */
export function formatImprovementLabel(improvementRate) {
  const rate = Number(improvementRate ?? 0);
  if (rate > 0) return `+${rate}%`;
  return `${rate}%`;
}

/**
 * Returns UI indicator text and color based on improvement rate.
 * - rate > 0:  "▲ Based on past evaluation history", color: "#34D399"
 * - rate < 0:  "▼ Compared with past evaluation history", color: "#EF4444"
 * - rate === 0:"→ No change from past evaluation history", color: "#9CA3AF"
 *
 * @param {number} improvementRate
 * @returns {{ text: string, color: string }}
 */
export function getImprovementIndicator(improvementRate) {
  const rate = Number(improvementRate ?? 0);
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
