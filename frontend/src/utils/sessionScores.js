/**
 * sessionScores.js — Authoritative score reading utility.
 *
 * This is the ONE place in the frontend that knows how to read
 * the evaluation result stored in a session document.
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
 *
 * IMPORTANT RULES:
 *  - 0 is a valid, real score. NEVER use  `score || fallback`  for scores.
 *  - Use  `score ?? fallback`  (nullish coalescing) so that 0 is preserved.
 *  - null / undefined  means "not yet evaluated" — display "—" in the UI.
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
 * @returns {object}  { communication, confidence, fluency, grammar, vocabulary, leadership, clarity, topicRelevance, ... }
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
 * Calculates improvement percentage between two sessions.
 *
 * Returns null if either score is unavailable or if the previous score is 0
 * (to avoid a divide-by-zero producing an infinite or misleading percentage).
 *
 * @param {number|null} previous - Score from the earlier session.
 * @param {number|null} current  - Score from the later session.
 * @returns {number|null}        - Percentage change, or null if incalculable.
 */
export function calcImprovementPct(previous, current) {
  if (previous === null || previous === undefined) return null;
  if (current  === null || current  === undefined) return null;
  if (previous === 0) return null; // Cannot divide by zero
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Format an improvement percentage for display.
 * Returns "—" when the percentage cannot be calculated.
 *
 * @param {number|null} pct
 * @returns {string}
 */
export function formatImprovementPct(pct) {
  if (pct === null || pct === undefined) return '—';
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}
