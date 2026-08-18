/**
 * evaluator.js
 *
 * Calls Gemini to obtain per-criterion ratings (0–5) for a given
 * activity rubric, then delegates final score calculation to scoreCalculator.js.
 *
 * Strict Evidence & Anti-Hallucination Rules:
 *   - Dialogue isolation: Extracts ONLY the human user's spoken words from multi-turn debates/interviews.
 *   - No Speech (0 words): Score 0/100, Poor, 0 fake strengths, 0 fake positive observations.
 *   - Insufficient Speech (<= 3 words or generic noise like "hello", "yes", "hmm", "uh"): Score 0/100, Poor.
 *   - Very Short Speech (4-15 words): Max rating 1 per criterion (~10-20/100 max, Poor).
 *   - Short Speech (16-35 words): Max rating 2 per criterion (~35-40/100 max, Needs Improvement).
 *   - Sustained Speech (>35 words): Full sentence-by-sentence rubric evaluation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRubric } from './rubrics.js';
import { calculateScore, buildZeroResult, buildInsufficientSpeechResult } from './scoreCalculator.js';

let genAI = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (err) {
    console.warn('Gemini init warning (evaluator):', err.message);
  }
}

/**
 * Set of generic greetings / low-evidence single words / noise tokens
 */
const GENERIC_GREETINGS = new Set([
  'hello', 'hi', 'hey', 'okay', 'ok', 'yes', 'no', 'thanks', 'thank', 'you',
  'bye', 'cool', 'nice', 'fine', 'good', 'morning', 'evening', 'afternoon',
  'prudhvi', 'name', 'is', 'my', 'yeah', 'so', 'testing', 'mic', 'check',
  'one', 'two', 'three', 'speech', 'test', 'trying', 'speaking',
  'hmm', 'uh', 'um', 'ah', 'er', 'like', 'well'
]);

/**
 * Extract ONLY the user's spoken content from structured multi-turn transcripts
 * (e.g. AI Voice Debate, Interview Practice, Voice Room Group Discussions).
 * Prevents AI opponent or interviewer prompts from being counted as user speech!
 */
export const extractUserSpokenContent = (transcript) => {
  if (!transcript || typeof transcript !== 'string') return '';
  const text = transcript.trim();

  // If transcript has ANY dialogue tags (AI Opponent, Human Debater, User, Interviewer, etc.)
  const hasDialogueTags = /(?:Human Debater|User|My Speech|AI Opponent|Interviewer|Host|A:|Q:)/i.test(text);

  if (hasDialogueTags) {
    const lines = text.split('\n');
    const userLines = [];
    let capturingUser = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^(?:Human Debater|User|My Speech|A):\s*(.*)$/i.test(trimmed)) {
        capturingUser = true;
        const content = trimmed.replace(/^(?:Human Debater|User|My Speech|A):\s*/i, '').trim();
        if (content) userLines.push(content);
      } else if (/^(?:AI Opponent|Interviewer|Host|Q|Topic|[A-Z][a-z0-9_]+(?:\s+[A-Z][a-z0-9_]+)?):\s*/i.test(trimmed)) {
        capturingUser = false;
      } else if (capturingUser) {
        userLines.push(trimmed);
      }
    }

    // Return strictly what the human user spoke. If none, returns empty string.
    return userLines.join(' ').trim();
  }

  return text;
};

/**
 * Check if the transcript contains topic-related keywords (words > 3 chars)
 */
const checkTopicRelevanceInText = (topic, transcript) => {
  if (!topic || typeof topic !== 'string') return true;
  const topicWords = topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'what', 'your', 'about', 'more', 'than', 'will'].includes(w));

  if (topicWords.length === 0) return true;

  const textLower = transcript.toLowerCase();
  return topicWords.some((tw) => textLower.includes(tw));
};

/**
 * Build strict Gemini prompt for detailed sentence-by-sentence grammar and debate analysis
 */
const buildEvaluationPrompt = (rubric, userTranscript, activityName, topic) => {
  const criteriaDescription = rubric.criteria
    .map((c) => `  - "${c.key}" (label: "${c.label}", weight: ${c.weight}/100)`)
    .join('\n');

  const ratingKeysExample = Object.fromEntries(rubric.criteria.map((c) => [c.key, 0]));

  return `You are a strict, objective, sentence-by-sentence English communication and debate evaluator.

## ACTIVITY
Name: ${activityName}
Topic: ${topic || 'General'}

## USER SPOKEN TRANSCRIPT (this is the ONLY evidence you may evaluate)
"""
${userTranscript}
"""

## CRITICAL ANTI-HALLUCINATION & EVIDENCE RULES
1. Evaluate ONLY the content present in the user's actual speech transcript above.
2. NEVER invent speech, sentences, arguments, strengths, grammar patterns, or topic relevance not present in the transcript.
3. If the user provided only 1-2 brief sentences or insufficient speech, do NOT invent positive observations.
4. "No evidence = No positive claim." Every strength MUST be grounded in verbatim evidence from the transcript.
5. If NO genuine mistakes exist and speech is sustained, return empty mistakeAnalysis [] and provide 2-3 genuine "positiveObservations".
6. Do NOT output a final score. The backend calculates the final score mathematically.

## CRITERIA TO EVALUATE
${criteriaDescription}

## STRICT JSON OUTPUT FORMAT (no markdown, no additional text)
{
  "ratings": ${JSON.stringify(ratingKeysExample)},
  "evidence": ${JSON.stringify(ratingKeysExample)},
  "improvement": ${JSON.stringify(ratingKeysExample)},
  "strengths": ["<specific demonstrated strength supported by verbatim evidence>"],
  "areasToImprove": ["<specific actionable improvement tip>"],
  "positiveObservations": ["<positive observation if speech is sustained and clear>"],
  "mistakeAnalysis": [
    {
      "category": "Grammar" | "Tense" | "Word Usage" | "Articles" | "Prepositions" | "Subject-Verb Agreement" | "Sentence Structure" | "Natural Expression",
      "errorType": "<Short error category name>",
      "youSaid": "<EXACT phrase from transcript>",
      "original": "<EXACT sentence from transcript>",
      "correction": "<Corrected sentence/phrase>",
      "betterAlternative": "<Optional natural/refined alternative>",
      "explanation": "<Short, clear explanation of why it is wrong>",
      "isStyleOnly": false
    }
  ],
  "aiFeedback": "<2-3 sentence coaching feedback based strictly on transcript evidence>"
}`;
};

/**
 * Rule-based heuristic grammar scanner for offline fallback
 */
const scanTranscriptHeuristics = (transcript) => {
  const mistakes = [];
  const text = transcript.trim();

  // Pattern 1: Yesterday / last + present verb
  const pastPresentRegex = /\b(yesterday|last (?:week|night|year|month))\s+([a-z]+)\s+(go|meet|see|take|come|give|is|are)\b/gi;
  let match;
  while ((match = pastPresentRegex.exec(text)) !== null) {
    const verb = match[3].toLowerCase();
    const pastForms = { go: 'went', meet: 'met', see: 'saw', take: 'took', come: 'came', give: 'gave', is: 'was', are: 'were' };
    if (pastForms[verb]) {
      mistakes.push({
        category: 'Tense',
        errorType: 'Incorrect Past Tense',
        youSaid: match[0],
        original: match[0],
        correction: `${match[1]} ${match[2]} ${pastForms[verb]}`,
        explanation: `"${match[1]}" refers to past time, so the past tense form "${pastForms[verb]}" should be used instead of "${verb}".`,
        isStyleOnly: false
      });
    }
  }

  // Pattern 2: "We was"
  const pluralWasRegex = /\b(we|they|you)\s+was\b/gi;
  while ((match = pluralWasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Plural Subject-Verb Disagreement',
      youSaid: match[0],
      original: match[0],
      correction: `${match[1]} were`,
      explanation: `The plural pronoun "${match[1]}" requires the plural verb "were" instead of "was".`,
      isStyleOnly: false
    });
  }

  // Pattern 3: "discussed about"
  const discussAboutRegex = /\b(discuss|discussed|discussing|discusses)\s+about\b/gi;
  while ((match = discussAboutRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Unnecessary Preposition',
      youSaid: match[0],
      original: match[0],
      correction: match[1],
      explanation: `The verb "${match[1]}" takes an object directly without requiring the preposition "about".`,
      isStyleOnly: false
    });
  }

  // Pattern 4: "He give"
  const thirdSingularGiveRegex = /\b(he|she|it)\s+give\b/gi;
  while ((match = thirdSingularGiveRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Verb Tense / Form Agreement',
      youSaid: match[0],
      original: match[0],
      correction: `${match[1]} gave`,
      explanation: `In past or simple present context, use "${match[1]} gave" (past) or "${match[1]} gives" (present).`,
      isStyleOnly: false
    });
  }

  // Pattern 5: "many idea"
  const manySingularRegex = /\b(many|several|few)\s+(idea|thing|problem|reason|result)\b/gi;
  while ((match = manySingularRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Grammar',
      errorType: 'Noun Pluralization Error',
      youSaid: match[0],
      original: match[0],
      correction: `${match[1]} ${match[2]}s`,
      explanation: `The quantifier "${match[1]}" must be followed by a plural noun ("${match[2]}s").`,
      isStyleOnly: false
    });
  }

  // Pattern 6: "suggest me to"
  const suggestMeRegex = /\bsuggest(?:ed)?\s+me\s+to\b/gi;
  while ((match = suggestMeRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Sentence Structure',
      errorType: 'Incorrect Verb Pattern',
      youSaid: match[0],
      original: match[0],
      correction: 'suggested that I',
      explanation: `"Suggest" cannot be followed directly by indirect object + infinitive ("suggest me to"). Use "suggested that I..." instead.`,
      isStyleOnly: false
    });
  }

  // Pattern 7: Modal + s-verb
  const modalSVerbRegex = /\b(can|could|will|would|should|may|might|must)\s+([a-z]+s)\b/gi;
  while ((match = modalSVerbRegex.exec(text)) !== null) {
    const verb = match[2];
    if (verb.endsWith('s') && !['this', 'thus', 'pass', 'less', 'discuss'].includes(verb)) {
      const baseVerb = verb.slice(0, -1);
      mistakes.push({
        category: 'Grammar',
        errorType: 'Modal Verb Form Error',
        youSaid: match[0],
        original: match[0],
        correction: `${match[1]} ${baseVerb}`,
        explanation: `Modal verbs like "${match[1]}" must be followed by the base form of the verb ("${baseVerb}"), not the third-person singular form ("${verb}").`,
        isStyleOnly: false
      });
    }
  }

  // Pattern 8: "good in English"
  const goodInRegex = /\bgood\s+in\s+(english|math|programming|speaking|coding|science)\b/gi;
  while ((match = goodInRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Incorrect Preposition',
      youSaid: match[0],
      original: match[0],
      correction: `good at ${match[1]}`,
      explanation: `Use "good at" when referring to skills, subjects, or abilities, rather than "good in".`,
      isStyleOnly: false
    });
  }

  return mistakes;
};

/**
 * Fallback evaluator when Gemini is offline
 */
const fallbackEvaluation = (rubric, userTranscript, activityName, topic, maxAllowedRating = 5) => {
  const words = userTranscript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount <= 3) {
    return buildInsufficientSpeechResult(rubric, 'No meaningful speech was detected. Please speak for a longer duration so the AI can evaluate your debate performance.');
  }

  const heuristicMistakes = scanTranscriptHeuristics(userTranscript);
  const hardErrorCount = heuristicMistakes.filter(m => !m.isStyleOnly).length;

  let baseRating = 1;
  if (wordCount > 100) baseRating = 3;
  else if (wordCount > 50) baseRating = 2;

  let grammarRating = baseRating;
  if (hardErrorCount >= 5) grammarRating = 1;
  else if (hardErrorCount >= 2) grammarRating = Math.max(1, baseRating - 1);

  grammarRating = Math.min(grammarRating, maxAllowedRating);
  baseRating = Math.min(baseRating, maxAllowedRating);

  const topicMatched = checkTopicRelevanceInText(topic, userTranscript);

  const ratingsMap = {};
  const evidenceMap = {};
  const improvementMap = {};

  rubric.criteria.forEach((c) => {
    let r = baseRating;
    if (c.key.toLowerCase().includes('grammar') || c.key.toLowerCase().includes('accuracy')) {
      r = grammarRating;
    } else if (c.key.toLowerCase().includes('relevance') || c.key.toLowerCase().includes('topic')) {
      r = topicMatched ? baseRating : 0;
    }
    ratingsMap[c.key] = r;
    evidenceMap[c.key] = `Evaluated based on ${wordCount} words of speech.`;
    improvementMap[c.key] = 'Practise speaking for longer with more detailed points.';
  });

  const result = calculateScore(rubric, ratingsMap, evidenceMap, improvementMap, false);

  // Strictly no fake positive observations if short or with errors
  const positiveObs = hardErrorCount === 0 && wordCount > 40 && topicMatched
    ? ['Good sentence construction', 'Clear subject-verb agreement', 'Appropriate word selection']
    : [];

  return {
    ...result,
    strengths: wordCount > 40 && topicMatched ? ['Maintained relevant topic discussion'] : [],
    areasToImprove: [
      hardErrorCount > 0 ? `Review the ${hardErrorCount} grammar/word usage issues detected.` : 'Elaborate more on your ideas with structured points.',
      'Practise speaking continuously to demonstrate fluency and confidence.'
    ],
    positiveObservations: positiveObs,
    mistakeAnalysis: heuristicMistakes,
    aiFeedback: `Good effort on your ${activityName} session. ${hardErrorCount > 0 ? `Review the ${hardErrorCount} grammar issues below.` : 'No major errors detected.'}`
  };
};

/**
 * Main evaluation entry point
 */
export const evaluateTranscript = async ({ transcript, activityName, topic, activityType }) => {
  const cleanTranscript = (transcript || '').trim();
  const rubric = getRubric(activityName);

  // ── 1. EXTRACT USER'S ACTUAL SPOKEN TEXT (ignore AI opponent/interviewer text) ──
  const userSpokenText = extractUserSpokenContent(cleanTranscript);

  // ── TIER 0: EMPTY USER SPEECH ──
  if (!userSpokenText || userSpokenText.length === 0) {
    return buildZeroResult(rubric, true);
  }

  const normalizedText = userSpokenText.toLowerCase().replace(/[^\w\s']/g, '');
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── TIER 1: ONE-WORD / GREETING / INSUFFICIENT SPEECH (e.g. "Hello", "hi", "yes", "hmm", "uh") ──
  const isOnlyGenericWords = words.length > 0 && words.every((w) => GENERIC_GREETINGS.has(w));
  if (wordCount <= 3 || isOnlyGenericWords) {
    return buildInsufficientSpeechResult(
      rubric,
      'No meaningful speech was detected. Please speak for a longer duration so the AI can evaluate your debate performance.'
    );
  }

  // Check topic relevance keyword presence on user speech
  const hasTopicKeywords = checkTopicRelevanceInText(topic, userSpokenText);

  // ── TIER 2: VERY SHORT SPEECH (4–15 words, e.g. "AI is useful.") ──
  if (wordCount <= 15) {
    const ratingsMap = {};
    const evidenceMap = {};
    const improvementMap = {};

    rubric.criteria.forEach((c) => {
      const isTopicKey = c.key.toLowerCase().includes('relevance') || c.key.toLowerCase().includes('topic');
      const r = isTopicKey ? (hasTopicKeywords ? 1 : 0) : 1;
      ratingsMap[c.key] = r;
      evidenceMap[c.key] = `Very brief speech (${wordCount} words). Insufficient evidence for higher rating.`;
      improvementMap[c.key] = 'Provide detailed explanations and examples to build a full response.';
    });

    const result = calculateScore(rubric, ratingsMap, evidenceMap, improvementMap, false);

    return {
      ...result,
      strengths: [],
      areasToImprove: [
        'Speak for at least a few meaningful sentences.',
        'Explain your opinion with reasons and examples.',
        'Maintain continuous speech instead of giving only a few words.'
      ],
      positiveObservations: [],
      mistakeAnalysis: [],
      aiFeedback: `Limited speech detected (${wordCount} words). The score is provisional because there is not enough content for a complete evaluation.`
    };
  }

  // ── TIER 3: SHORT SPEECH (16–35 words) ──
  if (wordCount <= 35) {
    const maxRating = 2; // Max rating 2/5 (weighted score capped ~35-40/100 max)

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = buildEvaluationPrompt(rubric, userSpokenText, activityName, topic);
        const response = await model.generateContent(prompt);
        const raw = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(raw);

        if (parsed.ratings && typeof parsed.ratings === 'object') {
          const clampedRatings = {};
          rubric.criteria.forEach((c) => {
            let r = Math.min(maxRating, Math.max(0, Math.round(Number(parsed.ratings[c.key] || 0))));
            if (c.key.toLowerCase().includes('relevance') && !hasTopicKeywords) {
              r = 0;
            }
            clampedRatings[c.key] = r;
          });

          const result = calculateScore(
            rubric,
            clampedRatings,
            parsed.evidence || {},
            parsed.improvement || {}
          );

          const validMistakes = filterValidMistakes(parsed.mistakeAnalysis, userSpokenText);

          return {
            ...result,
            strengths: [],
            areasToImprove: [
              'Develop your response further to cover multiple perspectives.',
              'Expand your speech duration to demonstrate sustained fluency.'
            ],
            positiveObservations: [],
            mistakeAnalysis: validMistakes,
            aiFeedback: typeof parsed.aiFeedback === 'string' ? parsed.aiFeedback : `Short speech detected (${wordCount} words). Elaborate more for higher scores.`
          };
        }
      } catch (e) {}
    }

    return fallbackEvaluation(rubric, userSpokenText, activityName, topic, maxRating);
  }

  // ── TIER 4: SUSTAINED SPEECH (>35 words) ──
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = buildEvaluationPrompt(rubric, userSpokenText, activityName, topic);
      const response = await model.generateContent(prompt);
      const raw = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw);

      if (parsed.ratings && typeof parsed.ratings === 'object') {
        const validMistakes = filterValidMistakes(parsed.mistakeAnalysis, userSpokenText);
        const hardGrammarErrorCount = validMistakes.filter(m => !m.isStyleOnly).length;

        const validatedRatings = {};

        rubric.criteria.forEach((c) => {
          let r = Math.min(5, Math.max(0, Math.round(Number(parsed.ratings[c.key] || 0))));

          // Strict topic guard
          if ((c.key.toLowerCase().includes('relevance') || c.key.toLowerCase().includes('topic')) && !hasTopicKeywords) {
            r = Math.min(r, 1);
          }

          // Strict grammar guard
          if (c.key.toLowerCase().includes('grammar') || c.key.toLowerCase().includes('accuracy')) {
            if (hardGrammarErrorCount >= 7) r = Math.min(r, 1);
            else if (hardGrammarErrorCount >= 4) r = Math.min(r, 2);
            else if (hardGrammarErrorCount >= 2) r = Math.min(r, 3);
          }

          validatedRatings[c.key] = r;
        });

        const result = calculateScore(
          rubric,
          validatedRatings,
          parsed.evidence || {},
          parsed.improvement || {}
        );

        let validStrengths = Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [];
        if (wordCount < 50 && result.finalScore < 60) {
          validStrengths = [];
        }

        const positiveObs = validMistakes.length === 0 && wordCount > 40 && hasTopicKeywords
          ? (Array.isArray(parsed.positiveObservations) && parsed.positiveObservations.length > 0
              ? parsed.positiveObservations.slice(0, 3)
              : ['Good sentence construction', 'Correct tense usage', 'Appropriate word selection'])
          : [];

        return {
          ...result,
          strengths: validStrengths,
          areasToImprove: Array.isArray(parsed.areasToImprove) ? parsed.areasToImprove.slice(0, 3) : [],
          positiveObservations: positiveObs,
          mistakeAnalysis: validMistakes,
          aiFeedback: typeof parsed.aiFeedback === 'string' ? parsed.aiFeedback : ''
        };
      }
    } catch (err) {
      console.warn('Gemini evaluation error (evaluator):', err.message);
    }
  }

  return fallbackEvaluation(rubric, userSpokenText, activityName, topic, 5);
};

/**
 * Filter mistakeAnalysis items to ensure "youSaid" / "original" is a verbatim substring of the user's transcript.
 */
function filterValidMistakes(mistakes, userTranscript) {
  const textLower = userTranscript.toLowerCase();

  const validFromAI = [];
  if (Array.isArray(mistakes)) {
    mistakes.forEach((m) => {
      if (!m || typeof m !== 'object') return;
      const phrase = (m.youSaid || m.original || '').trim().toLowerCase();
      if (!phrase || phrase.length < 2) return;

      if (textLower.includes(phrase) || textLower.replace(/[^\w\s]/g, '').includes(phrase.replace(/[^\w\s]/g, ''))) {
        validFromAI.push({
          category: m.category || 'Grammar',
          errorType: m.errorType || 'Grammar Error',
          youSaid: m.youSaid || m.original || phrase,
          original: m.original || m.youSaid || phrase,
          correction: m.correction || m.better || '',
          betterAlternative: m.betterAlternative || m.better || '',
          explanation: m.explanation || m.reason || 'Incorrect grammar or word usage.',
          isStyleOnly: !!m.isStyleOnly
        });
      }
    });
  }

  const heuristicMistakes = scanTranscriptHeuristics(userTranscript);

  const combined = [...validFromAI];
  heuristicMistakes.forEach(hm => {
    const isDuplicate = combined.some(m => m.youSaid.toLowerCase().includes(hm.youSaid.toLowerCase()) || hm.youSaid.toLowerCase().includes(m.youSaid.toLowerCase()));
    if (!isDuplicate) {
      combined.push(hm);
    }
  });

  return combined;
}
