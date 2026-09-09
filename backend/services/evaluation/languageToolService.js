/**
 * languageToolService.js
 *
 * Integrates with the LanguageTool Public HTTP API:
 * POST https://api.languagetool.org/v2/check
 * Content-Type: application/x-www-form-urlencoded
 *
 * Designed specifically for SPOKEN ENGLISH transcripts:
 * - Filters out speech-to-text transcription formatting issues:
 *     * Sentence-start capitalization (e.g. "hello" -> "Hello")
 *     * Uppercase/lowercase formatting
 *     * Missing full stops, commas, quotation marks
 *     * Punctuation-only changes
 * - Preserves & detects real spoken English errors:
 *     * Subject-verb agreement (e.g. "Students communicates", "they was", "he don't")
 *     * Incorrect verb tense / irregular verbs (e.g. "goed", "buyed")
 *     * Incorrect / missing articles (e.g. "are important part", "and important part")
 *     * Incorrect prepositions (e.g. "communicate in the people")
 *     * Singular/plural errors
 *     * Double determiners (e.g. "our the world")
 *     * Commonly confused homophones in speech (e.g. "weather content" -> "whether")
 */

const LANGUAGETOOL_API_URL = 'https://api.languagetool.org/v2/check';
const REQUEST_TIMEOUT_MS = 30000;

const IRREGULAR_PAST = {
  buyed: 'bought', teached: 'taught', catched: 'caught', bringed: 'brought', fighted: 'fought',
  thinked: 'thought', seed: 'saw', comed: 'came', goed: 'went', eated: 'ate', runned: 'ran',
  writed: 'wrote', singed: 'sang', slepted: 'slept', knowed: 'knew', speaked: 'spoke',
  breaked: 'broke', choosed: 'chose', drived: 'drove', gived: 'gave', taked: 'took',
  finded: 'found', payed: 'paid', leaded: 'led', holded: 'held', maked: 'made'
};

/**
 * Call LanguageTool Public HTTP API with the complete transcript.
 * @param {string} transcript
 * @returns {Promise<{ success: boolean, matches: Array, error?: string }>}
 */
export async function checkWithLanguageTool(transcript) {
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return { success: true, matches: [], error: null };
  }

  const cleanText = transcript.trim();
  const params = new URLSearchParams();
  params.append('text', cleanText);
  params.append('language', 'en-US');

  console.log(`[LanguageTool] Request text length: ${cleanText.length}`);
  console.log(`[LanguageTool] Language: en-US`);
  console.log(`[LanguageTool] Request started`);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(LANGUAGETOOL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SkillForgeAI/1.0'
      },
      body: params.toString(),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    console.log(`[LanguageTool] Response status: ${response.status}`);
    console.log(`[LanguageTool] Response time: ${responseTime}ms`);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[LanguageTool] HTTP ERROR: LanguageTool returned HTTP ${response.status}`);
      return {
        success: false,
        matches: [],
        error: `HTTP ERROR: LanguageTool returned HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const matches = Array.isArray(data.matches) ? data.matches : [];
    console.log(`[LanguageTool] Matches: ${matches.length}`);
    return { success: true, matches, error: null };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const errMsg = isTimeout
      ? `TIMEOUT: LanguageTool request timed out after ${REQUEST_TIMEOUT_MS}ms`
      : `HTTP ERROR: ${err.message || 'Unknown network error'}`;
    console.error(`[LanguageTool] ${errMsg}`);
    return { success: false, matches: [], error: errMsg };
  }
}

/**
 * Filter function to determine whether a LanguageTool match represents a transcription
 * formatting / punctuation / capitalization artifact rather than a genuine spoken English error.
 *
 * Uses rule.id, issueType, category, message, and deep text comparison.
 *
 * @param {object} match - LanguageTool match object
 * @param {string} transcript - Full speech transcript
 * @returns {boolean} true if match is a transcript formatting issue and MUST be ignored
 */
export function shouldIgnoreSpeechTranscriptIssue(match, transcript = '') {
  if (!match || !match.rule) return true;

  const ruleId = (match.rule.id || '').toUpperCase();
  const issueType = (match.rule.issueType || '').toLowerCase();
  const catId = (match.rule.category?.id || '').toUpperCase();
  const catName = (match.rule.category?.name || '').toLowerCase();
  const message = (match.message || '').toLowerCase();

  // 1. Explicit Rule IDs for formatting/casing/punctuation
  if (
    ruleId === 'UPPERCASE_SENTENCE_START' ||
    ruleId === 'MISSING_PERIOD' ||
    ruleId === 'END_OF_SENTENCE_PERIOD' ||
    ruleId === 'WHITESPACE_RULE' ||
    ruleId === 'COMMA_PARENTHESIS_WHITESPACE' ||
    ruleId === 'DOUBLE_PUNCTUATION' ||
    ruleId === 'EN_QUOTES' ||
    ruleId === 'SMART_QUOTES' ||
    ruleId === 'CURRENCY' ||
    ruleId === 'HYPHEN_TO_EN' ||
    ruleId.includes('PUNCTUATION') ||
    ruleId.includes('CAPITALIZATION') ||
    ruleId.includes('WHITESPACE')
  ) {
    return true;
  }

  // 2. Categories for Capitalization, Punctuation, and Typography
  if (
    catId === 'CASING' ||
    catName.includes('capitalization') ||
    catId === 'PUNCTUATION' ||
    catName.includes('punctuation') ||
    catId === 'TYPOGRAPHY' ||
    catName.includes('typography')
  ) {
    return true;
  }

  // 3. Typographical and whitespace issueTypes
  if (issueType === 'typographical' || issueType === 'whitespace') {
    return true;
  }

  // 4. Message inspection for punctuation/capitalization only
  if (
    message.includes('uppercase letter') ||
    message.includes('starts with an uppercase') ||
    message.includes('missing a period') ||
    message.includes('add a comma') ||
    message.includes('missing full stop') ||
    message.includes('unpaired symbol') ||
    message.includes('consecutive spaces') ||
    message.includes('consecutive dots')
  ) {
    return true;
  }

  // 5. Compare original text with best replacement:
  // If the ONLY difference between the original and the replacement is
  // capitalization, punctuation characters, or spacing, in SPOKEN English
  // this is purely a transcription artifact.
  const offset = typeof match.offset === 'number' ? match.offset : 0;
  const length = typeof match.length === 'number' ? match.length : 0;
  const original = transcript.substring(offset, offset + length) ||
    (match.context?.text ? match.context.text.substr(match.context.offset, length) : '');
  const bestReplacement = match.replacements?.[0]?.value || '';

  if (original && bestReplacement) {
    const normOrig = original.toLowerCase().replace(/[\s.,!?;:'"()[\]{}]/g, '');
    const normRepl = bestReplacement.toLowerCase().replace(/[\s.,!?;:'"()[\]{}]/g, '');
    if (normOrig === normRepl && normOrig.length > 0) {
      // Identical words with only case or punctuation differences -> ignore
      return true;
    }
  }

  return false;
}

/**
 * Scan for genuine spoken-English grammar issues that speech-to-text transcripts
 * frequently introduce (e.g. when punctuation is absent, causing LT to miss clauses).
 */
export function scanSpokenSpeechErrors(text) {
  if (!text || typeof text !== 'string') return [];
  const mistakes = [];

  // 1. Plural Noun + 3rd Person Singular Verb ("Students communicates", "people knows", "computers helps")
  const pluralNounSingularVerbRegex = /\b(students|people|children|users|teachers|workers|developers|members|customers|clients|friends|parents|schools|colleges)\s+(communicates|helps|knows|makes|gives|thinks|takes|wants|runs|speaks|uses|works|needs|creates|causes)\b/gi;
  let match;
  while ((match = pluralNounSingularVerbRegex.exec(text)) !== null) {
    const noun = match[1];
    const verb = match[2];
    const verbLower = verb.toLowerCase();
    let baseVerb;
    if (verbLower === 'goes') baseVerb = 'go';
    else if (verbLower === 'does') baseVerb = 'do';
    else if (verbLower.endsWith('shes') || verbLower.endsWith('ches') || verbLower.endsWith('xes') || verbLower.endsWith('sses')) {
      baseVerb = verb.slice(0, -2);
    } else {
      baseVerb = verb.slice(0, -1);
    }
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Plural Subject with Singular Verb',
      severity: 'major',
      confidence: 0.95,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${noun} ${baseVerb}`,
      betterAlternative: `${noun} ${baseVerb}`,
      problem: `Used singular verb form "${verb}" with plural subject "${noun}".`,
      explanation: `Plural subjects like "${noun}" take the base verb form ("${baseVerb}"), not the third-person singular "-s" form.`
    });
  }

  // 2. Missing Article before "... important part" ("are important part", "is important part", "became important part")
  const missingArticlePartRegex = /\b(is|are|became|remains|play|plays)\s+(important\s+part|essential\s+part|crucial\s+part|major\s+role|key\s+role)\b/gi;
  while ((match = missingArticlePartRegex.exec(text)) !== null) {
    const verb = match[1];
    const phrase = match[2];
    const article = phrase.startsWith('important') || phrase.startsWith('essential') ? 'an' : 'a';
    mistakes.push({
      category: 'Articles',
      errorType: 'Missing Article',
      severity: 'moderate',
      confidence: 0.92,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${verb} ${article} ${phrase}`,
      betterAlternative: `${verb} ${article} ${phrase}`,
      problem: `Missing article before "${phrase}".`,
      explanation: `Singular countable noun phrases like "${phrase}" require an article: use "${verb} ${article} ${phrase}".`
    });
  }

  // 3. Spoken Article Confusion ("and important part" -> "an important part")
  const andImportantPartRegex = /\b(and\s+important\s+part|and\s+essential\s+part)\b/gi;
  while ((match = andImportantPartRegex.exec(text)) !== null) {
    const phrase = match[1];
    const correction = phrase.replace(/^and\s+/i, 'an ');
    mistakes.push({
      category: 'Articles',
      errorType: 'Spoken Article Confusion',
      severity: 'moderate',
      confidence: 0.93,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction,
      betterAlternative: correction,
      problem: `Used conjunction "and" where the indefinite article "an" is required.`,
      explanation: `Use the indefinite article "an" before vowel sounds: "${correction}".`
    });
  }

  // 4. Preposition Errors with Communicate / Interact / Connect ("communicate in the people" -> "communicate with people")
  const prepCommunicateInRegex = /\b(communicate|interact|connect|talk)\s+in\s+(the\s+)?(people|others|peers|friends|colleagues|users|each\s+other)\b/gi;
  while ((match = prepCommunicateInRegex.exec(text)) !== null) {
    const verb = match[1];
    const target = match[3];
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Incorrect Preposition',
      severity: 'major',
      confidence: 0.95,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${verb} with ${target}`,
      betterAlternative: `${verb} with ${target}`,
      problem: `Used incorrect preposition "in" with "${verb}".`,
      explanation: `Use the preposition "with" when referring to social interaction: "${verb} with ${target}".`
    });
  }

  // 5. Double Determiner ("our the world", "my a friend", "their the country")
  const doubleDeterminerRegex = /\b(our|their|my|your|his|her)\s+(the|a|an)\s+([a-z]+)\b/gi;
  while ((match = doubleDeterminerRegex.exec(text)) !== null) {
    const poss = match[1];
    const art = match[2];
    const noun = match[3];
    mistakes.push({
      category: 'Grammar',
      errorType: 'Double Determiner',
      severity: 'moderate',
      confidence: 0.95,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${poss} ${noun}`,
      betterAlternative: `${poss} ${noun}`,
      problem: `Used redundant determiner "${art}" after possessive pronoun "${poss}".`,
      explanation: `Do not combine a possessive pronoun with an article. Use either "${poss} ${noun}" or "${art} ${noun}".`
    });
  }

  // 6. Confused Homophones in Spoken Context ("weather content" where "whether" is intended)
  const weatherWhetherRegex = /\bweather\s+(content|or|not|they|we|students|it|there)\b/gi;
  while ((match = weatherWhetherRegex.exec(text)) !== null) {
    const nextWord = match[1];
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Confused Word',
      severity: 'moderate',
      confidence: 0.90,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `whether ${nextWord}`,
      betterAlternative: `whether ${nextWord}`,
      problem: `Used "weather" (climate/temperature) instead of "whether" (conjunction).`,
      explanation: `Use "whether" when expressing doubt or alternatives between possibilities.`
    });
  }

  // 7. Non-3rd Person Singular Pronoun with "-s" Verb ("they was", "he don't")
  const theyWasRegex = /\b(they|we|you)\s+was\b/gi;
  while ((match = theyWasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Plural Subject with "was"',
      severity: 'major',
      confidence: 0.98,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${match[1]} were`,
      betterAlternative: `${match[1]} were`,
      problem: `Used singular past tense "was" with plural pronoun "${match[1]}".`,
      explanation: `Plural pronouns like "${match[1]}" require the plural past tense verb "were".`
    });
  }

  const heDontRegex = /\b(he|she|it)\s+don't\b/gi;
  while ((match = heDontRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Third-Person Singular with "don\'t"',
      severity: 'major',
      confidence: 0.98,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: `${match[1]} doesn't`,
      betterAlternative: `${match[1]} doesn't`,
      problem: `Used "don't" with third-person singular pronoun "${match[1]}".`,
      explanation: `Third-person singular subjects ("${match[1]}") require "doesn't" instead of "don't".`
    });
  }

  // 8. Irregular Past Tense ("goed", "buyed", "teached")
  const irregularPastRegex = /\b(buyed|teached|catched|bringed|fighted|thinked|seed|comed|goed|eated|runned|writed|singed|slepted|knowed|speaked|breaked|choosed|drived|gived|taked)\b/gi;
  while ((match = irregularPastRegex.exec(text)) !== null) {
    const wrong = match[0].toLowerCase();
    const correct = IRREGULAR_PAST[wrong] || wrong;
    mistakes.push({
      category: 'Verb Tense',
      errorType: 'Irregular Past Tense Error',
      severity: 'major',
      confidence: 0.98,
      offset: match.index,
      length: match[0].length,
      youSaid: match[0],
      original: match[0],
      correction: correct,
      betterAlternative: correct,
      problem: `Used non-standard regularized past tense "${match[0]}".`,
      explanation: `The past tense of this verb is irregular: use "${correct}" instead of "${match[0]}".`
    });
  }

  return mistakes;
}

/**
 * Consolidate filtered LanguageTool matches and spoken speech grammar errors.
 * Preserves ALL genuine errors, filters out all transcription formatting issues.
 */
export function getConsolidatedSpokenMistakes(transcript, ltMatches = []) {
  const text = transcript || '';

  // 1. Filter LanguageTool matches for speech transcript artifacts
  const validLtMatches = (ltMatches || []).filter(m => !shouldIgnoreSpeechTranscriptIssue(m, text));
  console.log(`[LanguageTool] Valid speech matches after formatting filter: ${validLtMatches.length} (from ${ltMatches.length} raw)`);

  const normalizedLt = normalizeLanguageToolMatches(text, validLtMatches);

  // 2. Run spoken grammar scanner for patterns missed by unpunctuated STT
  const spokenErrors = scanSpokenSpeechErrors(text);

  // 3. Merge and deduplicate by offset range
  const allMistakes = [...normalizedLt];

  for (const sErr of spokenErrors) {
    const isOverlapping = allMistakes.some(m => {
      if (typeof m.offset === 'number' && typeof sErr.offset === 'number') {
        const mEnd = m.offset + (m.length || 0);
        const sEnd = sErr.offset + (sErr.length || 0);
        return (sErr.offset >= m.offset && sErr.offset < mEnd) ||
               (m.offset >= sErr.offset && m.offset < sEnd);
      }
      return false;
    });

    if (!isOverlapping) {
      allMistakes.push({
        id: `spoken_${sErr.offset}`,
        message: sErr.problem,
        shortMessage: sErr.errorType,
        offset: sErr.offset,
        length: sErr.length,
        sentence: '',
        replacements: [{ value: sErr.correction }],
        ruleId: `SPOKEN_${(sErr.errorType || 'GRAMMAR').replace(/\s+/g, '_').toUpperCase()}`,
        issueType: 'grammar',
        category: sErr.category,
        confidence: sErr.confidence || 0.95,
        youSaid: sErr.youSaid,
        original: sErr.original,
        correction: sErr.correction,
        betterAlternative: sErr.betterAlternative,
        problem: sErr.problem,
        explanation: sErr.explanation,
        improvement: `Review ${sErr.category.toLowerCase()} pattern in future speech.`,
        severity: sErr.severity,
        errorType: sErr.errorType,
        isStyleOnly: false,
        isTranscriptionArtifact: false
      });
    }
  }

  // Sort by offset ascending
  allMistakes.sort((a, b) => (a.offset || 0) - (b.offset || 0));
  return allMistakes;
}

/**
 * Convert LanguageTool matches into the application's mistake format.
 * Preserves all metadata (rule, category, issueType, offset, length, replacements).
 * @param {string} transcript
 * @param {Array} matches
 * @returns {Array} Normalized issues array
 */
export function normalizeLanguageToolMatches(transcript, matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const text = transcript || '';

  return matches.map((match, idx) => {
    const offset = typeof match.offset === 'number' ? match.offset : 0;
    const length = typeof match.length === 'number' ? match.length : 0;
    const youSaid = text.substring(offset, offset + length) ||
      (match.context?.text ? match.context.text.substr(match.context.offset, match.context.length) : '');

    const replacements = Array.isArray(match.replacements) ? match.replacements : [];
    const bestReplacement = replacements.length > 0 ? (replacements[0]?.value || '') : '';

    const categoryName = match.rule?.category?.name || 'Grammar';
    const issueType = match.rule?.issueType || 'grammar';
    const ruleId = match.rule?.id || `LT_RULE_${idx}`;

    // Categorize severity
    let severity = 'moderate';
    if (issueType === 'misspelling' || categoryName.toLowerCase().includes('typo')) {
      severity = 'minor';
    } else if (categoryName.toLowerCase().includes('grammar') || categoryName.toLowerCase().includes('agreement')) {
      severity = 'major';
    }

    return {
      id: `lt_${idx}_${offset}`,
      message: match.message || 'Grammar or spelling issue detected.',
      shortMessage: match.shortMessage || '',
      offset,
      length,
      sentence: match.sentence || '',
      replacements,
      ruleId,
      issueType,
      category: categoryName,
      confidence: match.rule?.confidence || 0.85,

      // Frontend ResultsPage display properties:
      youSaid,
      original: youSaid,
      correction: bestReplacement,
      betterAlternative: bestReplacement,
      problem: match.message || 'Grammar or word usage error.',
      explanation: match.message || match.shortMessage || 'Grammar improvement detected by LanguageTool.',
      improvement: bestReplacement
        ? `Replace "${youSaid}" with "${bestReplacement}".`
        : `Review ${categoryName.toLowerCase()} usage in future speech.`,
      severity,
      errorType: issueType === 'misspelling' ? 'Spelling / Typo' : (categoryName || 'Grammar Error'),
      isStyleOnly: issueType === 'style' || categoryName.toLowerCase().includes('style'),
      isTranscriptionArtifact: false
    };
  });
}

/**
 * Generate corrected speech from original transcript and matches.
 * Applies replacements from right to left so offsets remain valid.
 */
export function buildCorrectedSpeech(transcript, normalizedMistakes = []) {
  if (!transcript) return '';
  if (!normalizedMistakes || normalizedMistakes.length === 0) return transcript;

  // Filter valid replacements and sort by offset descending
  const validReplacements = normalizedMistakes
    .filter(m => typeof m.offset === 'number' && m.length > 0 && m.correction)
    .sort((a, b) => b.offset - a.offset);

  let result = transcript;
  for (const m of validReplacements) {
    if (m.offset >= 0 && m.offset + m.length <= result.length) {
      result = result.substring(0, m.offset) + m.correction + result.substring(m.offset + m.length);
    }
  }
  return result;
}

/**
 * Group mistakes by sentence to construct sentenceAnalysis.
 */
export function buildSentenceAnalysis(transcript, normalizedMistakes = []) {
  if (!transcript || typeof transcript !== 'string') return [];

  const rawSentences = transcript.split(/(?<=[.?!])\s+|\n+/).filter(s => s.trim().length > 0);
  if (rawSentences.length === 0) return [];

  let searchOffset = 0;
  return rawSentences.map((sentence, idx) => {
    const sTrim = sentence.trim();
    const sStart = transcript.indexOf(sTrim, searchOffset);
    const sEnd = sStart >= 0 ? sStart + sTrim.length : searchOffset + sTrim.length;
    if (sStart >= 0) searchOffset = sEnd;

    // Find errors that fall within this sentence range
    const errors = normalizedMistakes.filter(m => {
      if (typeof m.offset === 'number') {
        return m.offset >= sStart && m.offset < sEnd;
      }
      return m.sentence && sTrim.includes(m.sentence);
    });

    const isCorrect = errors.length === 0;

    // Build sentence correction
    let corrected = sTrim;
    const sortedSentenceErrors = [...errors].sort((a, b) => (b.offset || 0) - (a.offset || 0));
    for (const err of sortedSentenceErrors) {
      if (err.youSaid && err.correction) {
        const regex = new RegExp(`\\b${escapeRegExp(err.youSaid)}\\b`, 'gi');
        corrected = corrected.replace(regex, err.correction);
      }
    }

    return {
      sentenceIndex: idx + 1,
      original: sTrim,
      isCorrect,
      errors: errors.map(e => ({
        youSaid: e.youSaid,
        correction: e.correction,
        category: e.category,
        explanation: e.explanation
      })),
      correctedSentence: corrected,
      improvementTip: isCorrect ? 'Good sentence structure.' : `Review ${errors.map(e => e.category).join(', ')}.`
    };
  });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate dynamic Grammar Score (0–100).
 *
 * Rules:
 * - NOT hardcoded: 0 errors does NOT mean automatically 100.
 * - Ignored transcript-formatting issues MUST NOT reduce grammar accuracy score.
 * - Weights genuine errors by severity & type:
 *     Grammar/Agreement: 1.5
 *     Typo/Spelling: 0.8
 *     Punctuation (if any genuine): 0.4
 *     Other/Style: 0.6
 * - Evaluates error density relative to word count:
 *     1 error in 10 words is a high error rate.
 *     1 error in 300 words is a negligible error rate.
 * - Score range: 0–100.
 */
export function calculateGrammarScore(wordCount, normalizedMistakes = []) {
  if (wordCount <= 0) return 0;

  if (normalizedMistakes.length === 0) {
    if (wordCount < 15) return 92;
    if (wordCount < 30) return 94;
    return 96;
  }

  let weightedErrors = 0;
  for (const m of normalizedMistakes) {
    const cat = (m.category || '').toLowerCase();
    const issue = (m.issueType || '').toLowerCase();

    if (cat.includes('grammar') || cat.includes('agreement') || issue === 'grammar') {
      weightedErrors += 1.5;
    } else if (cat.includes('typo') || cat.includes('spelling') || issue === 'misspelling') {
      weightedErrors += 0.8;
    } else if (cat.includes('preposition') || cat.includes('article')) {
      weightedErrors += 1.2;
    } else {
      weightedErrors += 0.7;
    }
  }

  const effectiveWordCount = Math.max(wordCount, 8);
  const errorDensity = weightedErrors / effectiveWordCount;

  const baseCeiling = wordCount < 20 ? 94 : 96;
  const deduction = (errorDensity * 260) + (weightedErrors * 3.5);
  const score = Math.max(10, Math.min(baseCeiling, Math.round(baseCeiling - deduction)));

  return score;
}
