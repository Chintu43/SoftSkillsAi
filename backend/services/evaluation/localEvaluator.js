/**
 * localEvaluator.js — Lightweight, Deterministic Local Linguistic Evaluation Engine
 *
 * Evaluates spoken transcripts dynamically without external AI APIs (Gemini, OpenRouter, OpenAI, LLMs).
 * Uses rule-based grammar scanning, tokenization, sentence analysis, filler/repetition detection,
 * vocabulary diversity metrics, and deterministic scoring rubrics.
 */

import { getRubric } from './rubrics.js';
import { calculateScore, buildZeroResult, buildInsufficientSpeechResult } from './scoreCalculator.js';

// ── Filler Words & Phrases ───────────────────────────────────────────────────
const FILLER_WORDS = new Set([
  'um', 'uh', 'erm', 'hmm', 'ah', 'like', 'actually', 'basically', 'honestly',
  'literally', 'seriously', 'you know', 'i mean', 'sort of', 'kind of', 'right'
]);

// ── Generic Greetings & Low-Content Words ────────────────────────────────────
const GENERIC_GREETINGS = new Set([
  'hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening', 'night',
  'test', 'testing', 'mic', 'one', 'two', 'three', 'okay', 'yes', 'no', 'thanks', 'thank'
]);

// ── Common Irregular Past Tense Verbs Dictionary ──────────────────────────────
const IRREGULAR_PAST = {
  buyed: 'bought', teached: 'taught', catched: 'caught', bringed: 'brought', fighted: 'fought',
  thinked: 'thought', seed: 'saw', comed: 'came', goed: 'went', eated: 'ate', runned: 'ran',
  writed: 'wrote', singed: 'sang', slepted: 'slept', knowed: 'knew', speaked: 'spoke',
  breaked: 'broke', choosed: 'chose', drived: 'drove', gived: 'gave', taked: 'took',
  finded: 'found', payed: 'paid', leaded: 'led', holded: 'held', maked: 'made'
};

/**
 * Clean & tokenize transcript into normalized lowercase words.
 */
export const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/[^\w\s']/g, '');
  return normalized.split(/\s+/).filter(Boolean);
};

/**
 * Split transcript into clean sentences.
 */
export const splitSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];
  const raw = clean.split(/(?<=[.?!])\s+|(?:\n+)/).filter(Boolean);
  return raw.length > 0 ? raw : [clean];
};

/**
 * Topic keyword relevance checker.
 */
export const checkTopicRelevance = (topic, transcript) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) return true;
  const stopWords = new Set(['with','from','that','this','have','what','your','about','more','than','will','work','future','good','best','some']);
  const topicWords = topic.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  if (topicWords.length === 0) return true;
  const textLower = transcript.toLowerCase();
  return topicWords.some(tw => textLower.includes(tw));
};

/**
 * Maximum rating cap based on total spoken word count.
 */
export const getMaxRatingForWordCount = (wordCount, criterionKey) => {
  const isContentKey = /fluency|topic|relevance|coher|content|idea|completeness|organization|timeManag|delivery|confidence/i.test(criterionKey);
  if (wordCount < 15) return 1;
  if (wordCount < 25) return isContentKey ? 2 : 3;
  if (wordCount < 40) return isContentKey ? 3 : 4;
  return 5;
};

/**
 * Filler word analysis.
 */
export const analyzeFillers = (words) => {
  if (!words || words.length === 0) return { fillerCount: 0, fillerRate: 0, detectedFillers: [] };
  const detectedFillers = [];
  let fillerCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const pair = i < words.length - 1 ? `${word} ${words[i + 1]}` : '';

    if (FILLER_WORDS.has(pair)) {
      fillerCount++;
      detectedFillers.push(pair);
      i++; // skip next word
    } else if (FILLER_WORDS.has(word)) {
      fillerCount++;
      detectedFillers.push(word);
    }
  }

  const fillerRate = words.length > 0 ? (fillerCount / words.length) : 0;
  return { fillerCount, fillerRate, detectedFillers };
};

/**
 * Repetition analysis.
 */
export const analyzeRepetition = (words) => {
  if (!words || words.length < 2) return { repetitionCount: 0, repetitionRate: 0, repeatedWords: [] };
  const repeatedWords = [];
  let repetitionCount = 0;

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === words[i + 1] && words[i].length > 1 && !['that', 'had'].includes(words[i])) {
      repetitionCount++;
      repeatedWords.push(words[i]);
    }
  }

  const repetitionRate = words.length > 0 ? (repetitionCount / words.length) : 0;
  return { repetitionCount, repetitionRate, repeatedWords };
};

/**
 * Vocabulary diversity analysis.
 */
export const analyzeVocabulary = (words) => {
  if (!words || words.length === 0) {
    return { uniqueWords: 0, totalWords: 0, typeTokenRatio: 0, averageWordLength: 0 };
  }
  const uniqueSet = new Set(words);
  const totalWords = words.length;
  const uniqueWords = uniqueSet.size;
  const typeTokenRatio = totalWords > 0 ? uniqueWords / totalWords : 0;

  const totalChars = words.reduce((acc, w) => acc + w.length, 0);
  const averageWordLength = totalWords > 0 ? totalChars / totalWords : 0;

  return { uniqueWords, totalWords, typeTokenRatio, averageWordLength };
};

/**
 * High-confidence deterministic rule-based grammar and mistake analyzer.
 */
export const analyzeGrammarAndMistakes = (transcript) => {
  const mistakes = [];
  const text = transcript.trim();
  let match;

  // 1. Auxiliary Verb + Base Verb Misuse ("I am go" -> "I go")
  const auxBaseRegex = /\b(i am|we are|they are|he is|she is|it is)\s+(go|went|play|eat|work|study|speak|see|do|make|live|come|take|give|run|drive|write|read|listen|watch|buy|sell|communicate|help|discuss|need|agree|talk|share|provide|learn|create|support|tell|show|think)\b/gi;
  while ((match = auxBaseRegex.exec(text)) !== null) {
    const aux = match[1].toLowerCase();
    const verb = match[2].toLowerCase();
    const subj = aux.split(' ')[0];
    let correction = '';
    if (verb === 'agree') {
      correction = (subj === 'he' || subj === 'she' || subj === 'it') ? `${subj} agrees` : `${subj} agree`;
    } else if (verb === 'went') {
      correction = `${subj} went`;
    } else if (subj === 'it' || subj === 'he' || subj === 'she') {
      correction = `${subj} ${verb}s`;
    } else {
      correction = `${subj} ${verb}`;
    }
    mistakes.push({
      category: 'Auxiliary Verbs',
      errorType: 'Auxiliary Verb + Base Verb Misuse',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used auxiliary verb "${aux.split(' ')[1]}" with base verb "${verb}".`,
      correction,
      explanation: `Do not use auxiliary verb "${aux.split(' ')[1]}" directly before full verb "${verb}". Use "${correction}".`
    });
  }

  // 2. Pronoun-Verb Disagreement ("I goes", "they goes")
  const nonThirdPersonSVerbRegex = /\b(i|we|they|you)\s+(goes|comes|takes|gives|sees|knows|makes|thinks|wants|looks|runs|works|plays|speaks|eats|writes|reads|helps|buys)\b/gi;
  while ((match = nonThirdPersonSVerbRegex.exec(text)) !== null) {
    const pron = match[1];
    const verb = match[2];
    const baseVerb = verb === 'goes' ? 'go' : (verb.endsWith('es') && !verb.endsWith('sees') ? verb.slice(0, -2) : verb.slice(0, -1));
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Pronoun-Verb Disagreement',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used third-person singular verb "${verb}" with pronoun "${pron}".`,
      correction: `${pron} ${baseVerb}`,
      explanation: `The pronoun "${pron}" takes the base form of the verb ("${baseVerb}"), not the "-s" form ("${verb}").`
    });
  }

  // 3. Conjugated Verb After Auxiliary ("don't likes", "didn't went")
  const auxSVerbRegex = /\b(don't|doesn't|didn't|cannot|can't|couldn't|shouldn't|won't)\s+([a-z]{3,}s)\b/gi;
  while ((match = auxSVerbRegex.exec(text)) !== null) {
    const aux = match[1];
    const verb = match[2].toLowerCase();
    let baseVerb = verb.endsWith('es') && !verb.endsWith('ses') ? verb.slice(0, -2) : verb.slice(0, -1);
    if (verb === 'likes') baseVerb = 'like';
    if (verb === 'goes') baseVerb = 'go';
    if (verb === 'does') baseVerb = 'do';
    mistakes.push({
      category: 'Verb Tense',
      errorType: 'Conjugated Verb After Auxiliary',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used conjugated verb "${verb}" after auxiliary "${aux}".`,
      correction: `${aux} ${baseVerb}`,
      explanation: `Auxiliary verbs like "${aux}" must be followed by the base form of the verb ("${baseVerb}").`
    });
  }

  // 4. Irregular Past Tense Errors ("buyed", "teached", "goed")
  const irregularPastRegex = /\b(buyed|teached|catched|bringed|fighted|thinked|seed|comed|goed|eated|runned|writed|singed|slepted|knowed|speaked|breaked|choosed|drived|gived|taked)\b/gi;
  while ((match = irregularPastRegex.exec(text)) !== null) {
    const wrong = match[0].toLowerCase();
    const correct = IRREGULAR_PAST[wrong] || wrong;
    mistakes.push({
      category: 'Verb Tense',
      errorType: 'Irregular Past Tense Error',
      severity: 'major',
      confidence: 0.98,
      youSaid: match[0],
      original: match[0],
      problem: `Used non-standard regularized past tense "${match[0]}".`,
      correction: correct,
      explanation: `The past tense of this verb is irregular: use "${correct}" instead of "${match[0]}".`
    });
  }

  // 5. Plural Noun Required After Number ("two brother", "3 student")
  const numberSingularNounRegex = /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(brother|sister|friend|student|car|book|dog|cat|house|day|month|year|boy|girl|hour|minute|dollar|rupee|issue|problem|mistake|reason)\b/gi;
  while ((match = numberSingularNounRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Singular/Plural',
      errorType: 'Plural Noun Required After Number',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used singular noun "${match[2]}" after count "${match[1]}".`,
      correction: `${match[1]} ${match[2]}s`,
      explanation: `Quantities greater than one require the plural form of the noun ("${match[2]}s").`
    });
  }

  // 6. Missing Preposition "with" ("communicate each other", "talk people")
  const communicateEachOtherRegex = /\b(communicate|meet|talk|interact|connect|share|discuss)\s+each\s+other\b/gi;
  while ((match = communicateEachOtherRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Missing Preposition "with"',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Missing preposition "with" before "each other".`,
      correction: `${match[1]} with each other`,
      explanation: `The verb "${match[1]}" requires the preposition "with" before "each other".`
    });
  }

  // 7. Demonstrative Pronoun Mismatch ("this students", "this apps")
  const thisPluralRegex = /\bthis\s+(apps|students|peoples|things|phones|platforms|websites|devices|users|people|friends|teachers|children|books)\b/gi;
  while ((match = thisPluralRegex.exec(text)) !== null) {
    const noun = match[1];
    mistakes.push({
      category: 'Grammar',
      errorType: 'Demonstrative Pronoun + Plural Noun Mismatch',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used singular demonstrative "this" with plural noun "${noun}".`,
      correction: `these ${noun}`,
      explanation: `Use "these" (not "this") with plural nouns. "This" is reserved for singular nouns.`
    });
  }

  // 8. Incorrect Plural of "People" ("peoples")
  const peoplesRegex = /\b(peoples)\b/gi;
  while ((match = peoplesRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Form',
      errorType: 'Incorrect Plural of "People"',
      severity: 'major',
      confidence: 0.98,
      youSaid: match[0],
      original: match[0],
      problem: `"Peoples" is non-standard when referring to individuals or people in general.`,
      correction: 'people',
      explanation: `"People" is already plural. Use "people" instead of "peoples".`
    });
  }

  // 9. Past Time Marker + Present Tense Verb ("Yesterday I go")
  const pastPresentRegex = /\b(yesterday|last (?:week|night|year|month))\s+([a-z]+)\s+(go|meet|see|take|come|give|is|are)\b/gi;
  while ((match = pastPresentRegex.exec(text)) !== null) {
    const verb = match[3].toLowerCase();
    const pastForms = { go: 'went', meet: 'met', see: 'saw', take: 'took', come: 'came', give: 'gave', is: 'was', are: 'were' };
    if (pastForms[verb]) {
      mistakes.push({
        category: 'Verb Tense',
        errorType: 'Past Time Marker Tense Mismatch',
        severity: 'major',
        confidence: 0.95,
        youSaid: match[0],
        original: match[0],
        problem: `Used present tense "${verb}" with past time marker "${match[1]}".`,
        correction: `${match[1]} ${match[2]} ${pastForms[verb]}`,
        explanation: `"${match[1]}" indicates past time — use past tense "${pastForms[verb]}" instead of "${verb}".`
      });
    }
  }

  // 10. Plural Subject + "was" ("we was", "they was")
  const pluralWasRegex = /\b(we|they|you)\s+was\b/gi;
  while ((match = pluralWasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Plural Subject-Verb Disagreement',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used singular verb "was" with plural pronoun "${match[1]}".`,
      correction: `${match[1]} were`,
      explanation: `The plural pronoun "${match[1]}" requires the plural verb "were" instead of "was".`
    });
  }

  // 11. Singular Pronoun + "have" ("he have", "she have", "it have")
  const singularHaveRegex = /\b(he|she|it)\s+have\b/gi;
  while ((match = singularHaveRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Third-Person Singular Verb Error',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used base verb "have" with third-person singular pronoun "${match[1]}".`,
      correction: `${match[1]} has`,
      explanation: `Third-person singular pronouns ("he", "she", "it") require "has", not "have".`
    });
  }

  // 12. Plural Pronoun + "has" ("I has", "we has", "they has")
  const pluralHasRegex = /\b(i|we|they|you)\s+has\b/gi;
  while ((match = pluralHasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Incorrect Auxiliary "has"',
      severity: 'major',
      confidence: 0.95,
      youSaid: match[0],
      original: match[0],
      problem: `Used singular verb "has" with pronoun "${match[1]}".`,
      correction: `${match[1]} have`,
      explanation: `The pronoun "${match[1]}" requires the verb "have", not "has".`
    });
  }

  // 13. Indefinite Article Error ("a important", "a apple")
  const aVowelRegex = /\ba\s+(important|apple|idea|opportunity|industry|example|issue|error|hour|individual|organization|activity|interview|algorithm|application)\b/gi;
  while ((match = aVowelRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Articles',
      errorType: 'Indefinite Article Error',
      severity: 'moderate',
      confidence: 0.92,
      youSaid: match[0],
      original: match[0],
      problem: `Used article "a" before vowel sound in "${match[1]}".`,
      correction: `an ${match[1]}`,
      explanation: `Words beginning with a vowel sound take the indefinite article "an", not "a".`
    });
  }

  // 14. Unnecessary Preposition ("discuss about", "return back", "revert back")
  const unnecessaryPrepRegex = /\b(discuss|discussed|discussing|revert\s+back|return\s+back|repeat\s+again)\s+about\b|\b(revert|return|reply)\s+back\b/gi;
  while ((match = unnecessaryPrepRegex.exec(text)) !== null) {
    const raw = match[0];
    const verb = raw.split(' ')[0];
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Unnecessary Preposition',
      severity: 'moderate',
      confidence: 0.90,
      youSaid: raw,
      original: raw,
      problem: `Used redundant preposition in "${raw}".`,
      correction: verb,
      explanation: `The verb "${verb}" does not require a redundant preposition.`
    });
  }

  // Deduplicate mistakes by key
  const unique = [];
  const seenKeys = new Set();
  for (const m of mistakes) {
    const k = (m.youSaid || '').toLowerCase().trim();
    if (!k || seenKeys.has(k)) continue;
    seenKeys.add(k);
    unique.push(m);
  }

  return unique;
};

/**
 * Generate sentence-by-sentence analysis for ResultsPage contract.
 */
export const buildSentenceAnalysis = (transcript, mistakes) => {
  const sentences = splitSentences(transcript);
  return sentences.map((s, idx) => {
    const sLower = s.toLowerCase();
    const sentenceMistakes = mistakes.filter(m => sLower.includes((m.youSaid || '').toLowerCase()));
    let correctedSentence = s;

    sentenceMistakes.forEach(m => {
      if (m.youSaid && m.correction) {
        const regex = new RegExp(m.youSaid.replace(/[^\w\s]/g, ''), 'gi');
        correctedSentence = correctedSentence.replace(regex, m.correction);
      }
    });

    return {
      sentenceIndex: idx + 1,
      original: s,
      isCorrect: sentenceMistakes.length === 0,
      errors: sentenceMistakes.map(m => ({
        category: m.category,
        errorType: m.errorType || m.category,
        youSaid: m.youSaid,
        correction: m.correction,
        explanation: m.explanation,
        severity: m.severity || 'moderate'
      })),
      correctedSentence: correctedSentence !== s ? correctedSentence : s,
      improvementTip: sentenceMistakes.length > 0
        ? `Review ${sentenceMistakes[0].category.toLowerCase()} error "${sentenceMistakes[0].youSaid}".`
        : 'Good sentence structure.'
    };
  });
};

/**
 * Build legacy wordMistakes array.
 */
export const buildWordMistakes = (mistakes) => {
  return mistakes.map(m => ({
    spokenWord: m.youSaid || m.original,
    problem: m.problem || m.errorType || 'Grammar or word usage issue',
    betterWord: m.correction || '',
    explanation: m.explanation || '',
    severity: m.severity || 'moderate'
  }));
};

/**
 * MAIN ENTRY POINT: Local Deterministic Linguistic Speech Evaluation Engine
 */
export const evaluateTranscriptLocally = async ({ transcript, activityName, topic, activityType, durationSeconds }) => {
  console.log('\n=======================================================');
  console.log('[LOCAL EVALUATOR] Starting local linguistic evaluation');
  console.log(`[LOCAL EVALUATOR] Activity: ${activityName || 'Practice'}`);
  console.log(`[LOCAL EVALUATOR] Topic: ${topic || 'N/A'}`);
  const cleanTx = (transcript || '').trim();
  console.log(`[LOCAL EVALUATOR] Transcript length: ${cleanTx.length} chars`);
  console.log('=======================================================\n');

  const rubric = getRubric(activityName);
  const words = tokenize(cleanTx);
  const wordCount = words.length;

  const EMPTY_FIELDS = {
    wordMistakes: [], wordAnalysis: [], sentenceAnalysis: [], correctedSpeech: '',
    errorSummary: { major: 0, moderate: 0, minor: 0 },
    categoryBreakdown: { grammarErrors: 0, wordUsageErrors: 0, articleErrors: 0, tenseErrors: 0, svAgreementErrors: 0, prepositionErrors: 0, sentenceStructureErrors: 0 }
  };

  // ── Handle Empty Speech (0 words) ──────────────────────────────────────────
  if (wordCount === 0) {
    console.log('[LOCAL EVALUATOR RESULT] Empty transcript -> Score 0');
    return {
      ...buildZeroResult(rubric, true),
      hasSpeech: false,
      speechDetected: false,
      aiAnalysisCompleted: true,
      aiAnalysisAvailable: true,
      confidence: 0,
      summary: 'No spoken content detected.',
      ...EMPTY_FIELDS,
      pronunciationAnalysis: 'No speech available for pronunciation analysis.',
      fluencyDelivery: 'No speech detected.',
      topicRelevance: 'Not applicable — no speech was recorded.',
      mentorAdvice: [
        'Ensure your microphone is enabled in browser settings.',
        'Speak clearly and continuously before submitting your session.'
      ]
    };
  }

  // ── Handle Insufficient Speech (≤3 words or generic greetings) ────────────
  const isOnlyGeneric = wordCount > 0 && words.every(w => GENERIC_GREETINGS.has(w));
  if (wordCount <= 3 || isOnlyGeneric) {
    console.log(`[LOCAL EVALUATOR RESULT] Insufficient speech ("${cleanTx}") -> Score 0`);
    return {
      ...buildInsufficientSpeechResult(rubric, 'No meaningful speech detected. Please speak for a longer duration.'),
      hasSpeech: false,
      speechDetected: false,
      aiAnalysisCompleted: true,
      aiAnalysisAvailable: true,
      confidence: 0.1,
      summary: `Insufficient speech detected ("${cleanTx}").`,
      ...EMPTY_FIELDS,
      pronunciationAnalysis: 'Pronunciation could not be evaluated from insufficient speech.',
      fluencyDelivery: 'Insufficient speech to measure fluency or pacing.',
      topicRelevance: 'Insufficient speech to determine topic alignment.',
      mentorAdvice: [
        'Speak for at least 3-5 complete sentences.',
        'Explain your opinion with reasons and examples.'
      ]
    };
  }

  // ── Measurable Linguistic Metrics ──────────────────────────────────────────
  const topicMatched = checkTopicRelevance(topic, cleanTx);
  const fillers = analyzeFillers(words);
  const repetitions = analyzeRepetition(words);
  const vocab = analyzeVocabulary(words);
  const detectedMistakes = analyzeGrammarAndMistakes(cleanTx);
  const hardErrorCount = detectedMistakes.length;

  console.log(`[LOCAL EVALUATOR] Words: ${wordCount} | Fillers: ${fillers.fillerCount} (${Math.round(fillers.fillerRate * 100)}%) | Repetitions: ${repetitions.repetitionCount} | Mistakes: ${hardErrorCount}`);

  // Calculate WPM if duration is available
  const durSecs = parseInt(durationSeconds, 10) || 0;
  const wpm = durSecs > 0 ? Math.round((wordCount / durSecs) * 60) : null;

  // ── Deterministic Criteria Rating Calculation ──────────────────────────────
  const ratingsMap = {};
  const evidenceMap = {};
  const improvementMap = {};

  rubric.criteria.forEach(c => {
    const maxCap = getMaxRatingForWordCount(wordCount, c.key);
    let r = maxCap;

    const keyLower = c.key.toLowerCase();

    if (keyLower.includes('grammar') || keyLower.includes('accuracy') || keyLower.includes('structure')) {
      if (hardErrorCount >= 5) r = 1;
      else if (hardErrorCount >= 3) r = 2;
      else if (hardErrorCount >= 2) r = 2;
      else if (hardErrorCount >= 1) r = 3;
      else r = Math.min(5, maxCap);
      evidenceMap[c.key] = `Linguistic analysis of ${wordCount} words detected ${hardErrorCount} grammar/usage error(s).`;
      improvementMap[c.key] = hardErrorCount > 0 ? 'Review identified subject-verb and verb tense error patterns.' : 'Maintain your strong grammatical accuracy.';

    } else if (keyLower.includes('fluency') || keyLower.includes('pacing') || keyLower.includes('delivery')) {
      if (fillers.fillerRate > 0.08 || repetitions.repetitionRate > 0.08) r = Math.min(2, maxCap);
      else if (fillers.fillerRate > 0.04 || repetitions.repetitionRate > 0.04) r = Math.min(3, maxCap);
      else r = Math.min(5, maxCap);
      evidenceMap[c.key] = `Filler word rate: ${Math.round(fillers.fillerRate * 100)}% (${fillers.fillerCount} fillers). Repetitions: ${repetitions.repetitionCount}.${wpm ? ` WPM: ${wpm}.` : ''}`;
      improvementMap[c.key] = fillers.fillerCount > 0 ? 'Pause silently instead of using filler words.' : 'Good speech rhythm and continuity.';

    } else if (keyLower.includes('vocabulary') || keyLower.includes('variety') || keyLower.includes('content') || keyLower.includes('ideas')) {
      if (vocab.typeTokenRatio < 0.45 && wordCount >= 30) r = Math.min(2, maxCap);
      else if (vocab.typeTokenRatio < 0.60 && wordCount >= 30) r = Math.min(3, maxCap);
      else r = Math.min(5, maxCap);
      evidenceMap[c.key] = `Vocabulary diversity ratio: ${Math.round(vocab.typeTokenRatio * 100)}% (${vocab.uniqueWords} unique out of ${vocab.totalWords} words).`;
      improvementMap[c.key] = vocab.typeTokenRatio < 0.60 ? 'Use a wider variety of descriptive words.' : 'Good word choice and vocabulary range.';

    } else if (keyLower.includes('relevance') || keyLower.includes('topic') || keyLower.includes('info')) {
      r = topicMatched ? Math.min(5, maxCap) : 1;
      evidenceMap[c.key] = topicMatched ? `Speech aligns with topic keywords for "${topic || activityName}".` : `Limited keyword overlap with topic "${topic || activityName}".`;
      improvementMap[c.key] = topicMatched ? 'Keep focusing on clear topic points.' : 'Include core topic terms in your response.';

    } else {
      // General communication / confidence / leadership
      if (hardErrorCount >= 4 || fillers.fillerRate > 0.08) r = Math.min(2, maxCap);
      else if (hardErrorCount >= 2 || fillers.fillerRate > 0.04) r = Math.min(3, maxCap);
      else r = Math.min(5, maxCap);
      evidenceMap[c.key] = `Communication measured across ${wordCount} words with ${hardErrorCount} error(s).`;
      improvementMap[c.key] = 'Practice structuring your thoughts clearly.';
    }

    ratingsMap[c.key] = r;
  });

  // Calculate final score using authoritative weighted criteria
  const result = calculateScore(rubric, ratingsMap, evidenceMap, improvementMap, false);
  console.log(`[LOCAL EVALUATOR] Calculated Final Score: ${result.finalScore} | Level: ${result.performanceLevel}`);

  // Build mistake analysis & sentence breakdown
  const wordMistakes = buildWordMistakes(detectedMistakes);
  const sentenceAnalysis = buildSentenceAnalysis(cleanTx, detectedMistakes);

  let correctedSpeech = cleanTx;
  detectedMistakes.forEach(m => {
    if (m.youSaid && m.correction) {
      const regex = new RegExp(m.youSaid.replace(/[^\w\s]/g, ''), 'gi');
      correctedSpeech = correctedSpeech.replace(regex, m.correction);
    }
  });

  const formattedIssues = detectedMistakes.map(m => ({
    youSaid: m.youSaid || m.original || '',
    original: m.original || m.youSaid || '',
    problem: m.problem || m.explanation || 'Grammar or word usage issue.',
    correction: m.correction || '',
    betterAlternative: m.correction || '',
    explanation: m.explanation || m.problem || '',
    category: m.category || 'Grammar',
    errorType: m.errorType || m.category || 'Grammar Error',
    improvement: `Review ${m.category.toLowerCase()} pattern in future speech.`,
    severity: m.severity || 'moderate',
    confidence: m.confidence || 0.9,
    isStyleOnly: false,
    isTranscriptionArtifact: !!m.isTranscriptionArtifact
  }));

  const mistakeAnalysisData = {
    status: 'success',
    issueCount: formattedIssues.length,
    issues: formattedIssues,
    errorMessage: null
  };

  const positiveObs = [];
  if (hardErrorCount === 0 && wordCount >= 30 && topicMatched) {
    positiveObs.push('Demonstrated clear sentence formation and accurate grammar.');
  }
  if (fillers.fillerCount === 0 && wordCount >= 30) {
    positiveObs.push('Spoke fluently without using filler words.');
  }

  const strengths = [];
  if (hardErrorCount === 0 && wordCount >= 30) {
    strengths.push('Strong grammatical accuracy across spoken sentences.');
  }
  if (vocab.typeTokenRatio >= 0.65 && wordCount >= 30) {
    strengths.push('Good vocabulary variety and word usage.');
  }
  if (topicMatched && wordCount >= 25) {
    strengths.push(`Maintained relevance to topic "${topic || activityName}".`);
  }

  const mentorAdvice = [];
  if (hardErrorCount > 0) {
    mentorAdvice.push('Review the detected grammar and verb usage errors below.');
  } else {
    mentorAdvice.push('Great job on grammar! Focus on elaborating your ideas further.');
  }
  if (fillers.fillerCount > 0) {
    mentorAdvice.push(`Replace filler words ("${fillers.detectedFillers.slice(0, 3).join('", "')}") with brief silent pauses.`);
  } else {
    mentorAdvice.push('Aim to speak continuously for 60–90 seconds to build fluency.');
  }

  return {
    ...result,
    aiAnalysisAvailable: true,
    aiAnalysisCompleted: true,
    hasSpeech: true,
    speechDetected: true,
    confidence: wordCount >= 60 ? 0.90 : wordCount >= 30 ? 0.80 : 0.65,
    summary: `Local evaluation analyzed ${wordCount} spoken words on "${topic || activityName}". Detected ${hardErrorCount} issue(s) and ${fillers.fillerCount} filler(s).`,
    strengths,
    areasToImprove: [
      hardErrorCount > 0 ? `${hardErrorCount} grammar/usage issue(s) detected — review below.` : 'Expand your points with reasons and examples.',
      fillers.fillerCount > 0 ? `Reduce filler word usage (${fillers.fillerCount} detected).` : 'Maintain steady pacing across longer sentences.'
    ],
    positiveObservations: positiveObs,
    mistakeAnalysis: mistakeAnalysisData,
    mistakes: formattedIssues,
    wordMistakes,
    wordAnalysis: wordMistakes,
    sentenceAnalysis,
    correctedSpeech: correctedSpeech !== cleanTx ? correctedSpeech : cleanTx,
    errorSummary: {
      major: detectedMistakes.filter(m => m.severity === 'major').length,
      moderate: detectedMistakes.filter(m => m.severity === 'moderate').length,
      minor: detectedMistakes.filter(m => m.severity === 'minor').length
    },
    categoryBreakdown: {
      grammarErrors: detectedMistakes.filter(m => m.category === 'Grammar' || m.category === 'Auxiliary Verbs').length,
      wordUsageErrors: detectedMistakes.filter(m => m.category === 'Word Usage').length,
      articleErrors: detectedMistakes.filter(m => m.category === 'Articles').length,
      tenseErrors: detectedMistakes.filter(m => m.category === 'Verb Tense' || m.category === 'Tense').length,
      svAgreementErrors: detectedMistakes.filter(m => m.category === 'Subject-Verb Agreement').length,
      prepositionErrors: detectedMistakes.filter(m => m.category === 'Prepositions').length,
      sentenceStructureErrors: detectedMistakes.filter(m => m.category === 'Sentence Structure').length
    },
    pronunciationAnalysis: 'Pronunciation is evaluated separately via acoustic audio analysis when available.',
    fluencyDelivery: `Fluency evaluated from ${wordCount} words (${fillers.fillerCount} fillers, ${repetitions.repetitionCount} repetitions).`,
    topicRelevance: topicMatched ? 'Speech aligns with given topic keywords.' : 'Limited alignment with topic keywords.',
    mentorAdvice,
    aiFeedback: `Local evaluation complete. Final score: ${result.finalScore}/100. ${hardErrorCount > 0 ? `Review ${hardErrorCount} detected grammar issue(s).` : 'Grammatical accuracy is strong.'}`
  };
};
