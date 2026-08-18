/**
 * scoreCalculator.js
 *
 * Receives a rubric + array of AI-provided ratings, validates them,
 * and calculates the final score mathematically.
 *
 * The AI/Gemini's suggested finalScore is NEVER trusted.
 * Only the per-criterion ratings feed into the calculation.
 */

/**
 * Validate a single rating value. Must be integer 0–5.
 * Invalid ratings are clamped to 0.
 */
export const validateRating = (value) => {
  const n = Math.round(Number(value));
  if (isNaN(n) || n < 0) return 0;
  if (n > 5) return 5;
  return n;
};

/**
 * Given a rubric and a ratings map { criterionKey: rawRating },
 * return the full evaluation result.
 */
export const calculateScore = (
  rubric,
  ratingsMap,
  evidenceMap = {},
  improvementMap = {},
  isEmptySpeech = false
) => {
  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return buildZeroResult(rubric, true);
  }

  if (isEmptySpeech) {
    return buildZeroResult(rubric, true);
  }

  let totalWeightedScore = 0;

  const criteria = rubric.criteria.map((criterion) => {
    const rawRating = ratingsMap[criterion.key];
    const rating = validateRating(rawRating);
    const weightedScore = Math.round((rating / 5) * criterion.weight * 10) / 10; // 1dp precision

    totalWeightedScore += weightedScore;

    return {
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      rating,
      weightedScore,
      maxWeightedScore: criterion.weight,
      evidence:
        (evidenceMap[criterion.key] || '').trim() ||
        'Insufficient evidence in the provided transcript.',
      improvement:
        (improvementMap[criterion.key] || '').trim() ||
        'Practise and focus on this dimension in future sessions.'
    };
  });

  const finalScore = Math.min(100, Math.max(0, Math.round(totalWeightedScore)));
  const performanceLevel = getPerformanceLevel(finalScore);

  return { criteria, finalScore, performanceLevel, isEmptySpeech: false };
};

/**
 * Return a zero-score result for no-speech sessions.
 * Never awards any marks or positive feedback.
 */
export const buildZeroResult = (rubric, isEmpty = true) => {
  const criteria = (rubric?.criteria || []).map((c) => ({
    key: c.key,
    label: c.label,
    weight: c.weight,
    rating: 0,
    weightedScore: 0,
    maxWeightedScore: c.weight,
    evidence: 'No speech was detected in this session.',
    improvement: 'Speak clearly and continuously during the session for AI evaluation.'
  }));

  return {
    criteria,
    finalScore: 0,
    performanceLevel: 'Poor',
    isEmptySpeech: isEmpty,
    strengths: [],
    positiveObservations: [],
    areasToImprove: [
      'Speak for at least a few meaningful sentences.',
      'Explain your opinion with reasons and examples.',
      'Maintain continuous speech instead of giving only a few words.'
    ],
    mistakeAnalysis: [],
    aiFeedback:
      'No meaningful speech was detected. There is not enough evidence to evaluate your soft skills. Please complete a full session with meaningful speech.'
  };
};

/**
 * Return an explicit zero/insufficient score result for very short responses (e.g. "Hello", "hi", "okay", "yes", "hmm", "uh").
 * Never awards any marks or positive feedback.
 */
export const buildInsufficientSpeechResult = (rubric, message = '') => {
  const msg =
    message ||
    'No meaningful speech was detected. Please speak for a longer duration so the AI can evaluate your performance.';

  const criteria = (rubric?.criteria || []).map((c) => ({
    key: c.key,
    label: c.label,
    weight: c.weight,
    rating: 0,
    weightedScore: 0,
    maxWeightedScore: c.weight,
    evidence: 'Insufficient speech detected to evaluate this criterion.',
    improvement: 'Speak for longer and develop your ideas around the given topic.'
  }));

  return {
    criteria,
    finalScore: 0,
    performanceLevel: 'Poor',
    isEmptySpeech: true,
    strengths: [],
    positiveObservations: [],
    areasToImprove: [
      'Speak for at least a few meaningful sentences.',
      'Explain your opinion with reasons and examples.',
      'Maintain continuous speech instead of giving only a few words.'
    ],
    mistakeAnalysis: [],
    aiFeedback: msg
  };
};

/**
 * Determine performance level from final score.
 * Derived strictly from finalScore.
 */
export const getPerformanceLevel = (score) => {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
};
