/**
 * evaluator.js — Dynamic English Communication & Soft Skills Mentor Engine (v4)
 *
 * Dynamic Score Scale:
 *  - Test 1 (Empty): 0
 *  - Test 2 (Greeting / <4 words): 0
 *  - Test 3 (Grammatically Weak): 25–38
 *  - Test 4 (Medium with errors): 45–58
 *  - Test 5 (Strong Speech): 75–85
 *  - Test 6 (Near-Perfect): 85–95
 *  - Test 7 (Topic Irrelevant): 40–50 (Topic score penalized)
 */

import dns from 'dns';
import https from 'https';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import { getRubric } from './rubrics.js';
import { calculateScore, buildZeroResult, buildInsufficientSpeechResult, getPerformanceLevel } from './scoreCalculator.js';
import { evaluateTranscriptLocally } from './localEvaluator.js';
import {
  checkWithLanguageTool,
  normalizeLanguageToolMatches,
  getConsolidatedSpokenMistakes,
  shouldIgnoreSpeechTranscriptIssue,
  buildCorrectedSpeech,
  buildSentenceAnalysis,
  calculateGrammarScore
} from './languageToolService.js';
import {
  evaluateContentLocally,
  tokenizeWords,
  splitSentences
} from './contentAnalyzer.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

export let geminiQuotaExceeded = false;
export let geminiQuotaExceededAt = null;

export const setGeminiQuotaStatus = (isExceeded) => {
  geminiQuotaExceeded = isExceeded;
  if (isExceeded) {
    geminiQuotaExceededAt = new Date().toISOString();
  } else {
    geminiQuotaExceededAt = null;
  }
};

export const getGeminiQuotaStatus = () => ({
  quotaExceeded: geminiQuotaExceeded,
  quotaExceededAt: geminiQuotaExceededAt
});

const customHttpsFetch = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    let headersObj = {};

    if (options.headers) {
      if (typeof options.headers.forEach === 'function') {
        options.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (typeof options.headers.entries === 'function') {
        for (const [key, value] of options.headers.entries()) {
          headersObj[key] = value;
        }
      } else {
        headersObj = { ...options.headers };
      }
    }

    const bodyBuffer = options.body ? Buffer.from(options.body) : null;

    if (bodyBuffer) {
      headersObj['Content-Length'] = bodyBuffer.length;
    }

    const timeoutDuration = options.timeout || 20000;
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: headersObj,
      family: 4,
      timeout: timeoutDuration
    }, (res) => {
      const chunks = [];

      res.on('data', chunk => chunks.push(chunk));

      res.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf8');

        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: async () => bodyText,
          json: async () => JSON.parse(bodyText),
          headers: {
            get: (name) => res.headers[name.toLowerCase()]
          }
        });
      });
    });

    req.setTimeout(timeoutDuration, () => {
      req.destroy(new Error(`Gemini request timed out after ${timeoutDuration}ms.`));
    });

    req.on('error', reject);

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }

    req.end();
  });
};

const getGenAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey, { customFetch: customHttpsFetch });
  } catch (err) {
    console.warn('Gemini API init warning:', err.message);
    return null;
  }
};

export const callGeminiWithRetry = async (genAI, prompt) => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(
        '[EVALUATION] Calling Gemini 3.6 Flash via Direct REST (attempt ' +
        attempt + '/2)...'
      );

      const res = await customHttpsFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body
      });

      const text = await res.text();

      let parsedJson;

      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error(
          'Gemini returned invalid JSON (HTTP ' + res.status + ').'
        );
      }

      if (!res.ok || parsedJson.error) {
        const message =
          parsedJson.error?.message ||
          ('Gemini API returned HTTP ' + res.status);

        const error = new Error(message);
        error.status = res.status;
        throw error;
      }

      const resultText =
        parsedJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (resultText && resultText.trim().length > 0) {
        console.log('[EVALUATION SUCCESS] Direct Gemini REST call succeeded.');
        return resultText;
      }

      throw new Error('Gemini returned an empty response.');
    } catch (err) {
      console.warn(
        '[EVALUATION NOTICE] Gemini attempt ' +
        attempt +
        ' failed:',
        err.message
      );

      if (attempt === 2) {
        throw err;
      }

      const isRateLimit =
        err.status === 429 ||
        /429|quota|too many requests/i.test(err.message);

      // Do NOT retry when Gemini quota is exhausted.
      // Google may report a retry-after time of 30-60+ seconds.
      if (isRateLimit) {
        console.warn(
          '[EVALUATION] Gemini quota/rate limit detected. Skipping retry.'
        );
        throw err;
      }

      // Only retry temporary network/server failures once.
      const delayMs = 1000;

      console.log(
        '[EVALUATION] Temporary Gemini error. Retrying once after ' +
        delayMs +
        ' ms...'
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Gemini API call failed.');
};

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-PROVIDER AI FAILOVER SYSTEM
// Priority: Gemini → OpenRouter #1 → OpenRouter #2
// Fast failover on failure or timeout (no long sleep retries)
// ─────────────────────────────────────────────────────────────────────────────

/** Safe parser for AI JSON responses that handles markdown fences and formatting quirks */
export const safeParseAIJson = (rawText, providerLabel = 'AI') => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error(`${providerLabel} returned empty or non-string response`);
  }

  let cleaned = rawText.trim();
  // Strip code fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract from first '{' to last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (secondErr) {
      throw new Error(`${providerLabel} returned malformed JSON: ${firstErr.message}`);
    }
  }
};

/** Wrap a customHttpsFetch call with a timeout */
const fetchWithTimeout = (url, options, timeoutMs = 25000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
    customHttpsFetch(url, { ...options, timeout: timeoutMs })
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
};

// ─── Provider 1: Gemini ──────────────────────────────────────────────────────

const callGeminiProvider = async (prompt) => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
  // gemini-3.6-flash is a thinking model: without a thinking cap the full
  // evaluation prompt causes 30-45 s latency.  55 s timeout is the safety net.
  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 55000;

  console.log('[EVALUATION] Gemini request started');
  console.log(`[EVALUATION] Gemini model: ${model}`);
  console.log(`[EVALUATION] Gemini API key present: ${apiKey ? 'YES' : 'NO'}`);
  console.log(`[EVALUATION] Gemini request timeout: ${timeoutMs} ms`);

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY not configured');
    err.isConfig = true;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  // Cap thinking budget to 1024 tokens so gemini-3.6-flash completes the full
  // evaluation prompt in ~10-15 s instead of 30-45 s (uncapped reasoning).
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 1024 }
    }
  });

  const geminiStart = Date.now();
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  }, timeoutMs);

  const elapsed = Date.now() - geminiStart;
  console.log(`[EVALUATION] Gemini response received in ${elapsed} ms`);
  console.log(`[EVALUATION] Gemini HTTP status: ${res.status}`);

  if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500) {
    throw new Error(`Gemini HTTP ${res.status}: temporary service issue`);
  }

  const text = await res.text();
  console.log(`[EVALUATION] Gemini response length: ${text.length}`);

  let parsedJson;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON (HTTP ${res.status})`);
  }

  // Log thinking token usage for diagnostics
  const thinkingTokens = parsedJson?.usageMetadata?.thoughtsTokenCount;
  if (thinkingTokens !== undefined) {
    console.log(`[EVALUATION] Gemini thinking tokens used: ${thinkingTokens}`);
  }

  if (parsedJson.error) {
    const msg = parsedJson.error.message || 'Gemini API Error';
    throw new Error(`Gemini error: ${msg}`);
  }

  const resultText = parsedJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultText || resultText.trim().length === 0) {
    throw new Error('Gemini returned empty response');
  }

  // Validate that response contains valid JSON and ratings
  const parsed = safeParseAIJson(resultText, 'Gemini');
  if (!parsed || typeof parsed !== 'object' || !parsed.ratings) {
    throw new Error('Gemini returned invalid evaluation schema (missing ratings)');
  }

  return { rawText: resultText, parsed };
};

// ─── Provider 2 & 3: OpenRouter #1 and OpenRouter #2 ─────────────────────────

const callOpenRouterProvider = async (prompt, keyEnvName, providerLabel) => {
  const apiKey = (process.env[keyEnvName] || '').trim();
  const model = (process.env.OPENROUTER_MODEL || 'openrouter/free').trim();
  // openrouter/free can route to slow models; 45 s gives them a fair chance
  // without blocking indefinitely if one is fully unavailable.
  const timeoutMs = parseInt(process.env.OPENROUTER_TIMEOUT_MS, 10) || 45000;

  console.log(`[EVALUATION] ${providerLabel} request started`);
  console.log(`[EVALUATION] ${providerLabel} model: ${model}`);
  console.log(`[EVALUATION] ${providerLabel} API key present: ${apiKey ? 'YES' : 'NO'}`);
  console.log(`[EVALUATION] ${providerLabel} request timeout: ${timeoutMs} ms`);

  if (!apiKey) {
    const err = new Error(`${keyEnvName} not configured`);
    err.isConfig = true;
    throw err;
  }

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4000
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const orStart = Date.now();
  let res;
  let text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://softskillsai.local',
        'X-Title': 'SkillForge AI'
      },
      body,
      signal: controller.signal
    });
    text = await res.text();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`${providerLabel} request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const elapsed = Date.now() - orStart;
  console.log(`[EVALUATION] ${providerLabel} response received in ${elapsed} ms`);
  console.log(`[EVALUATION] ${providerLabel} HTTP status: ${res.status}`);
  console.log(`[EVALUATION] ${providerLabel} response length: ${text?.length || 0}`);

  if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500) {
    throw new Error(`${providerLabel} HTTP ${res.status}: temporary service issue`);
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(text);
  } catch (parseErr) {
    throw new Error(`${providerLabel} response parse error: ${parseErr.message}`);
  }

  if (parsedJson.error) {
    const msg = (typeof parsedJson.error === 'string') ? parsedJson.error : (parsedJson.error.message || `${providerLabel} API Error`);
    throw new Error(`${providerLabel} error: ${msg}`);
  }

  const choice = parsedJson.choices?.[0];
  let resultText = choice?.message?.content;
  if (!resultText || resultText.trim().length === 0) {
    resultText = choice?.message?.reasoning || choice?.text;
  }

  if (!resultText || resultText.trim().length === 0) {
    throw new Error(`${providerLabel} returned empty response`);
  }

  // Validate that response contains valid JSON and ratings
  const parsed = safeParseAIJson(resultText, providerLabel);
  if (!parsed || typeof parsed !== 'object' || !parsed.ratings) {
    throw new Error(`${providerLabel} returned invalid evaluation schema (missing ratings)`);
  }

  return { rawText: resultText, parsed };
};

const callOpenRouterProvider1 = (prompt) => callOpenRouterProvider(prompt, 'OPENROUTER_API_KEY_1', 'OpenRouter #1');
const callOpenRouterProvider2 = (prompt) => callOpenRouterProvider(prompt, 'OPENROUTER_API_KEY_2', 'OpenRouter #2');

// ─── Failover Orchestrator ───────────────────────────────────────────────────

/**
 * Tries AI providers in order: Gemini → OpenRouter #1 → OpenRouter #2.
 * On a failure, timeout, or invalid JSON, immediately moves to the next provider.
 * Returns { rawText, parsed, provider } on success.
 * Throws if all providers fail.
 */
export const callAIWithFailover = async (prompt) => {
  const evalStart = Date.now();
  console.log('[EVALUATION] Starting AI evaluation with multi-provider failover');

  const providers = [
    { name: 'Gemini',         fn: callGeminiProvider       },
    { name: 'OpenRouter #1',   fn: callOpenRouterProvider1  },
    { name: 'OpenRouter #2',   fn: callOpenRouterProvider2  }
  ];

  let lastError = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const providerStart = Date.now();
    console.log(`[EVALUATION] Trying provider: ${provider.name}`);
    try {
      const result = await provider.fn(prompt);
      const elapsed = Date.now() - evalStart;
      console.log(`[EVALUATION] ${provider.name} succeeded`);
      console.log(`[EVALUATION] Provider used: ${provider.name}`);
      console.log(`[EVALUATION] Total evaluation time: ${elapsed} ms`);
      return { rawText: result.rawText, parsed: result.parsed, provider: provider.name.toLowerCase() };
    } catch (err) {
      const elapsed = Date.now() - providerStart;
      console.log(`[EVALUATION] ${provider.name} failed after ${elapsed}ms: ${err.message}`);
      if (i + 1 < providers.length) {
        console.log(`[EVALUATION] Falling back to ${providers[i + 1].name}`);
      }
      lastError = err;
    }
  }

  const elapsed = Date.now() - evalStart;
  console.error(`[EVALUATION] All providers failed. Total time: ${elapsed} ms`);
  throw lastError || new Error('All AI providers failed');
};

const GENERIC_GREETINGS = new Set([
  'hello', 'hi', 'hey', 'okay', 'ok', 'yes', 'no', 'thanks', 'thank', 'you',
  'bye', 'cool', 'nice', 'fine', 'good', 'morning', 'evening', 'afternoon',
  'prudhvi', 'name', 'is', 'my', 'yeah', 'so', 'testing', 'mic', 'check',
  'one', 'two', 'three', 'speech', 'test', 'trying', 'speaking',
  'hmm', 'uh', 'um', 'ah', 'er', 'like', 'well'
]);

export const extractUserSpokenContent = (transcript) => {
  if (!transcript || typeof transcript !== 'string') return '';
  const text = transcript.trim();
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
    return userLines.join(' ').trim();
  }
  return text;
};

const checkTopicRelevanceInText = (topic, transcript) => {
  if (!topic || typeof topic !== 'string') return true;
  const topicWords = topic.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
    .filter(w => w.length > 3 && !['with','from','that','this','have','what','your','about','more','than','will','work','future'].includes(w));
  if (topicWords.length === 0) return true;
  const textLower = transcript.toLowerCase();
  return topicWords.some(tw => textLower.includes(tw));
};

const getMaxRatingForWordCount = (wordCount, criterionKey) => {
  const isContentKey = /fluency|topic|relevance|coher|content|idea|completeness|organization|timeManag|delivery|confidence/i.test(criterionKey);
  if (wordCount < 15)  return 1;
  if (wordCount < 25)  return isContentKey ? 2 : 3;
  if (wordCount < 40)  return isContentKey ? 3 : 4;
  return 5;
};

const buildEvaluationPrompt = (rubric, userTranscript, activityName, topic, wordCount) => {
  const criteriaDescription = rubric.criteria.map(c => '  - "' + c.key + '" (label: "' + c.label + '", weight: ' + c.weight + '/100)').join('\n');
  const ratingKeysExample = Object.fromEntries(rubric.criteria.map(c => [c.key, 0]));

  return `You are an expert, strict English Communication & Soft Skills Mentor evaluating a spoken speech transcript.

## ACTIVITY CONTEXT
Activity: ${activityName}
Topic: ${topic || 'General Practice'}
Word count: ${wordCount}

## USER SPOKEN TRANSCRIPT (evaluate ONLY what is inside these triple-quotes):
"""
${userTranscript}
"""

CRITICAL EVALUATION INSTRUCTIONS:
1. SENTENCE-BY-SENTENCE LINGUISTIC ANALYSIS
Break the transcript into individual sentences or clauses.
Inspect EVERY sentence for:
- Subject-verb agreement (e.g., "LinkedIn provide" -> "LinkedIn provides", "spending cause" -> "spending causes")
- Auxiliary verb misuse (e.g., "it is communicate" -> "it communicates")
- Tense errors
- Preposition errors (e.g., "details on how" -> "depends on how")
- Incorrect word forms / word usage (e.g., "inter health" -> "mental health", "did you concentration" -> "affects concentration")
- Sentence structure / missing words / awkward phrasing
- Transcription artifacts (words that look like speech recognition glitches, e.g., "edition" for "addiction")

For EACH sentence, return an entry in "sentenceAnalysis":
- sentenceIndex (1, 2, 3...)
- original (exact sentence from transcript)
- isCorrect (boolean)
- errors: array of detected errors with category, youSaid, correction, explanation, and severity ("major", "moderate", "minor")
- correctedSentence (grammatically corrected version of this sentence)
- improvementTip (one practical tip for this sentence)

2. COMPLETE CORRECTED SPEECH
In "correctedSpeech", provide a full grammatically corrected version of the user transcript.
- Preserve the user original message, ideas, and order.
- Fix all grammar, verb forms, articles, prepositions, and sentence structures.

3. CALIBRATED RATING SCALE (0-5)
Rate each criterion strictly based on evidence:
  0 = Absent / not attempted
  1 = Very poor — frequent major errors throughout
  2 = Below average — noticeable errors, communication unclear at times
  3 = Average — communicates adequately with several errors
  4 = Good — few minor errors, clear communication
  5 = Excellent — near-perfect, sophisticated, zero major errors

Rules for ratings:
- Do NOT default to 3. If there are 3+ major errors, max grammar rating = 2. If 5+ errors, max = 1.
- If speech is near-perfect with zero errors and strong vocabulary/structure, award 4 or 5 for grammar and clarity.
- If speech is completely unrelated to the topic, rate topic relevance = 0 or 1.

4. POSITIVE OBSERVATIONS & STRENGTHS
- ONLY include a positive observation if there is specific transcript evidence.
- NEVER output generic claims like "Good sentence construction" or "Correct verb tense usage" if errors are present.
- If there are grammar errors, positiveObservations MUST be an empty array [].

5. PRONUNCIATION
State: "Pronunciation could not be reliably evaluated from transcript text alone."

CRITERIA TO RATE (0 to 5 each):
${criteriaDescription}

## REQUIRED OUTPUT FORMAT: Respond with ONLY valid JSON (no markdown formatting):
{\n  "summary": "<1-2 sentence factual summary of what the user discussed>",\n  "ratings": " + JSON.stringify(ratingKeysExample) + ",\n  "evidence": " + JSON.stringify(ratingKeysExample) + ",\n  "improvement": " + JSON.stringify(ratingKeysExample) + ",\n  "strengths": ["<Evidence-backed strength with transcript example>"],\n  "areasToImprove": ["<Actionable area to improve based on detected errors>"],\n  "positiveObservations": ["<Specific positive observation with evidence, OR empty array if errors exist>"],\n  "sentenceAnalysis": [\n    {\n      "sentenceIndex": 1,\n      "original": "<exact sentence from transcript>",\n      "isCorrect": false,\n      "errors": [\n        {\n          "category": "Subject-Verb Agreement | Verb Tense | Auxiliary Verbs | Articles | Prepositions | Word Usage | Word Form | Sentence Structure | Natural Expression | Transcription Artifact | Other",\n          "youSaid": "<problematic phrase>",\n          "correction": "<corrected phrase>",\n          "explanation": "<grammar rule explanation>",\n          "severity": "major | moderate | minor"\n        }\n      ],\n      "correctedSentence": "<corrected sentence>",\n      "improvementTip": "<improvement tip>"\n    }\n  ],\n  "mistakes": [\n    {\n      "category": "Grammar | Subject-Verb Agreement | Verb Tense | Articles | Prepositions | Word Usage | Word Form | Sentence Structure",\n      "errorType": "<short error name>",\n      "youSaid": "<EXACT problematic phrase>",\n      "correction": "<corrected version>",\n      "explanation": "<grammar rule explanation>",\n      "severity": "major | moderate | minor"\n    }\n  ],\n  "mistakeAnalysis": [\n    {\n      "category": "Grammar | Tense | Word Usage | Articles | Prepositions | Subject-Verb Agreement | Sentence Structure | Word Formation | Natural Expression",\n      "errorType": "<short error name>",\n      "youSaid": "<EXACT phrase>",\n      "original": "<EXACT sentence>",\n      "problem": "<what is wrong>",\n      "correction": "<corrected version>",\n      "betterAlternative": "<optional refined alternative>",\n      "explanation": "<grammar rule>",\n      "severity": "major | moderate | minor",\n      "isStyleOnly": false,\n      "isTranscriptionArtifact": false\n    }\n  ],\n  "wordMistakes": [\n    {\n      "spokenWord": "<problematic word>",\n      "problem": "<what is wrong>",\n      "betterWord": "<better word>",\n      "explanation": "<explanation>",\n      "severity": "major | moderate | minor"\n    }\n  ],\n  "correctedSpeech": "<complete grammatically corrected version of the transcript>",\n  "errorSummary": { "major": 0, "moderate": 0, "minor": 0 },\n  "categoryBreakdown": { "grammarErrors": 0, "wordUsageErrors": 0, "articleErrors": 0, "tenseErrors": 0, "svAgreementErrors": 0, "prepositionErrors": 0, "sentenceStructureErrors": 0 },\n  "pronunciationAnalysis": "Pronunciation could not be reliably evaluated from transcript text alone.",\n  "fluencyDelivery": "<observation on continuity and flow>",\n  "topicRelevance": "<observation on topic alignment>",\n  "mentorAdvice": ["<advice 1 based on actual errors>", "<advice 2>"],\n  "aiFeedback": "<2-3 sentence coaching summary grounded in actual transcript evidence>"\n}`;
};

const scanTranscriptHeuristics = (transcript) => {
  const mistakes = [];
  const text = transcript.trim();
  let match;

  const auxBaseRegex = /\b(i am|we are|they are|he is|she is|it is)\s+(go|went|play|eat|work|study|speak|see|do|make|live|come|take|give|run|drive|write|read|listen|watch|buy|sell|communicate|help|discuss|need|agree|talk|share|provide|learn|create|support|tell|show|think)\b/gi;
  while ((match = auxBaseRegex.exec(text)) !== null) {
    const aux = match[1].toLowerCase();
    const verb = match[2].toLowerCase();
    const subj = aux.split(' ')[0];
    let correction = '';
    if (verb === 'agree') {
      correction = (subj === 'he' || subj === 'she' || subj === 'it') ? (subj + ' agrees') : (subj + ' agree');
    } else if (verb === 'went') {
      correction = subj + ' went';
    } else if (subj === 'it' || subj === 'he' || subj === 'she') {
      correction = subj + ' ' + verb + 's';
    } else {
      correction = subj + ' ' + verb;
    }
    mistakes.push({
      category: 'Auxiliary Verbs',
      errorType: 'Auxiliary Verb + Base Verb Misuse',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used auxiliary verb "' + aux.split(' ')[1] + '" with base verb "' + verb + '".',
      correction,
      explanation: 'Do not use auxiliary verb "' + aux.split(' ')[1] + '" directly before full verb "' + verb + '". Use "' + correction + '".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "I goes / we goes / they goes / you goes" (first/second/third-plural pronoun + -s verb) Ã¢â€â‚¬
  const nonThirdPersonSVerbRegex = /\b(i|we|they|you)\s+(goes|comes|takes|gives|sees|knows|makes|thinks|wants|looks|runs|works|plays|speaks|eats|writes|reads|helps|buys)\b/gi;
  while ((match = nonThirdPersonSVerbRegex.exec(text)) !== null) {
    const pron = match[1];
    const verb = match[2];
    const baseVerb = verb.endsWith('es') && !verb.endsWith('sees') ? verb.slice(0, -2) : verb.slice(0, -1);
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Pronoun-Verb Disagreement',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used third-person singular verb "' + verb + '" with pronoun "' + pron + '".',
      correction: pron + ' ' + (verb === 'goes' ? 'go' : baseVerb),
      explanation: 'The pronoun "' + pron + '" takes the base form of the verb ("' + (verb === 'goes' ? 'go' : baseVerb) + '"), not the "-s" form ("' + verb + '").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "don't likes / doesn't likes / didn't likes" (auxiliary + conjugated -s verb) Ã¢â€â‚¬Ã¢â€â‚¬
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
      youSaid: match[0],
      original: match[0],
      problem: 'Used conjugated verb "' + verb + '" after auxiliary "' + aux + '".',
      correction: aux + ' ' + baseVerb,
      explanation: 'Auxiliary verbs like "' + aux + '" must be followed by the base form of the verb ("' + baseVerb + '").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "buyed / teached / goed / eated" (irregular past tense errors) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const IRREGULAR_PAST_ERRORS = {
    buyed: 'bought', teached: 'taught', catched: 'caught', bringed: 'brought', fighted: 'fought',
    thinked: 'thought', seed: 'saw', comed: 'came', goed: 'went', eated: 'ate', runned: 'ran',
    writed: 'wrote', singed: 'sang', slepted: 'slept', knowed: 'knew', speaked: 'spoke',
    breaked: 'broke', choosed: 'chose', drived: 'drove', gived: 'gave', taked: 'took'
  };
  const irregularPastRegex = /\b(buyed|teached|catched|bringed|fighted|thinked|seed|comed|goed|eated|runned|writed|singed|slepted|knowed|speaked|breaked|choosed|drived|gived|taked)\b/gi;
  while ((match = irregularPastRegex.exec(text)) !== null) {
    const wrong = match[0].toLowerCase();
    const correct = IRREGULAR_PAST_ERRORS[wrong] || wrong;
    mistakes.push({
      category: 'Verb Tense',
      errorType: 'Irregular Past Tense Error',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used non-standard regularized past tense "' + match[0] + '".',
      correction: correct,
      explanation: 'The past tense of this verb is irregular: use "' + correct + '" instead of "' + match[0] + '".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "two brother / three friend" (number + singular countable noun) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const numberSingularNounRegex = /\b(two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(brother|sister|friend|student|car|book|dog|cat|house|day|month|year|boy|girl|hour|minute|dollar|rupee|issue|problem|mistake|reason)\b/gi;
  while ((match = numberSingularNounRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Singular/Plural',
      errorType: 'Plural Noun Required After Number',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular noun "' + match[2] + '" after count "' + match[1] + '".',
      correction: match[1] + ' ' + match[2] + 's',
      explanation: 'Quantities greater than one require the plural form of the noun ("' + match[2] + 's").',
      isStyleOnly: false
    });
  }

  const MODAL_OR_PARTICLE = new Set(['can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'to', 'did', 'do', 'does', 'not', 'has', 'have', 'had']);
  const svAgreementRegex = /\b(spending|using|doing|platform|linkedin|technology|education|internet|time)\s+([a-z]+)?\s*(provide|cause|help|enable|become|waste|affect|make|take|create|reduce|harm|limit|distract|impact|lower)\b/gi;
  while ((match = svAgreementRegex.exec(text)) !== null) {
    const subj = match[1];
    const middleWord = (match[2] || '').toLowerCase().trim();
    if (MODAL_OR_PARTICLE.has(middleWord)) continue;
    const middle = match[2] ? match[2] + ' ' : '';
    const verb = match[3];
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Singular Subject-Verb Disagreement',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Singular subject "' + subj + '" used with base verb "' + verb + '".',
      correction: subj + ' ' + middle + verb + 's',
      explanation: 'Singular subjects and gerunds ("' + subj + '") require third-person singular verb ending in "-s" ("' + verb + 's").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "communicate each other / meet each other" (missing preposition "with") Ã¢â€â‚¬Ã¢â€â‚¬
  const communicateEachOtherRegex = /\b(communicate|meet|talk|interact|connect|share|discuss)\s+each\s+other\b/gi;
  while ((match = communicateEachOtherRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Missing Preposition "with"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing preposition "with" before "each other".',
      correction: match[1] + ' with each other',
      explanation: 'The verb "' + match[1] + '" requires the preposition "with" before "each other" (e.g., "communicate with each other").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "this apps / this students / this peoples" (this + plural noun) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const thisPluralRegex = /\bthis\s+(apps|students|peoples|things|phones|platforms|websites|devices|users|people|friends|teachers|children|books)\b/gi;
  while ((match = thisPluralRegex.exec(text)) !== null) {
    const noun = match[1];
    mistakes.push({
      category: 'Grammar',
      errorType: 'Demonstrative Pronoun + Plural Noun Mismatch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular demonstrative "this" with plural noun "' + noun + '".',
      correction: 'these ' + noun,
      explanation: 'Use "these" (not "this") with plural nouns. "This" is for singular nouns.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "peoples" used as count plural (should be "people") Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const peoplesRegex = /\b(peoples)\b/gi;
  while ((match = peoplesRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Form',
      errorType: 'Incorrect Plural of "People"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: '"Peoples" is incorrect when referring to individuals or people in general.',
      correction: 'people',
      explanation: '"People" is already plural. Use "people" instead of "peoples" unless specifically referring to distinct ethnic/national groups.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "there important / there problem / there solution" (there used as article) Ã¢â€â‚¬
  const thereArticleRegex = /\b(there|their)\s+(important|major|main|key|significant|critical|best|big|new|old|great|bad|good|common|various|several|most)\s+(part|role|place|reason|way|thing|impact|effect|feature|benefit|advantage|disadvantage|problem|solution|issue)\b/gi;
  while ((match = thereArticleRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Articles',
      errorType: 'Wrong Word Used as Article',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "' + match[1] + '" instead of indefinite article "an" or "a".',
      correction: (/^[aeiou]/i.test(match[2]) ? 'an ' : 'a ') + match[2] + ' ' + match[3],
      explanation: '"' + match[1] + '" should be replaced with the correct article "' + (/^[aeiou]/i.test(match[2]) ? 'an' : 'a') + '" before the noun phrase.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "extract knowledge / extract information" (wrong colocation: should be "gain") Ã¢â€â‚¬
  const extractKnowledgeRegex = /\b(extract|take|steal)\s+(knowledge|information|education|skills|learning)\b/gi;
  while ((match = extractKnowledgeRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Incorrect Verb Collocation',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: '"' + match[1] + '" is not the natural verb collocating with "' + match[2] + '".',
      correction: 'gain ' + match[2],
      explanation: 'Use "gain ' + match[2] + '" or "acquire ' + match[2] + '". The verb "' + match[1] + '" is not a natural collocate for "' + match[2] + '".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "Falls informations / Falls information" (ASR artifact for "false information") Ã¢â€â‚¬
  const fallsInfoRegex = /\b(falls?)\s+(information|informations|info|news|facts)\b/gi;
  while ((match = fallsInfoRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Speech Recognition Glitch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Speech recognition captured "' + match[0] + '" instead of "false information".',
      correction: 'false information',
      explanation: 'This is a speech-recognition error. The intended phrase is "false information" (misinformation).',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "tips students / tips to students" (ASR artifact: "it helps students") Ã¢â€â‚¬Ã¢â€â‚¬
  const tipsStudentsRegex = /\btips\s+(students|people|users|learners)\b/gi;
  while ((match = tipsStudentsRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Speech Recognition Glitch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Speech recognition captured "' + match[0] + '" — likely "helps ' + match[1] + '".',
      correction: 'helps ' + match[1],
      explanation: 'This appears to be a transcription artifact. The intended phrase was likely "it helps ' + match[1] + '".',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "criterions" (non-standard plural; should be "criteria") Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const criterionsRegex = /\bcriterions\b/gi;
  while ((match = criterionsRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Form',
      errorType: 'Irregular Plural Error',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: '"Criterions" is not the standard plural of "criterion".',
      correction: 'criteria',
      explanation: 'The correct plural of "criterion" is "criteria" (not "criterions").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "communicate people / help students communicate people" (missing "with") Ã¢â€â‚¬
  const communicatePeopleRegex = /\b(communicate|interact|connect)\s+(people|students|users|others|friends|everyone|someone)\b/gi;
  while ((match = communicatePeopleRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Missing Preposition "with"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing preposition "with" after "' + match[1] + '" before the object "' + match[2] + '".',
      correction: match[1] + ' with ' + match[2],
      explanation: 'The verb "' + match[1] + '" requires the preposition "with" before its object.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "it ends / it end students" (ASR for "it expands" / "it helps") Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const itEndsStudentsRegex = /\bit\s+ends?\s+(students|people|users|learners|knowledge)\b/gi;
  while ((match = itEndsStudentsRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Speech Recognition Glitch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: '"' + match[0] + '" is likely a transcription artifact.',
      correction: 'it expands ' + match[1],
      explanation: 'This appears to be a speech-recognition error. The intended phrase was likely "it expands ' + match[1] + '" or "it helps ' + match[1] + '".',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "WrestleMania / Ren media / Linking" (obvious ASR glitches) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const obviousASRGlitchRegex = /\b(WrestleMania|wrestlemania|Ren\s+media|ren\s+media|linking\s+Facebook|Linked\s+In|criterion\s+people)\b/gi;
  while ((match = obviousASRGlitchRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Speech Recognition Glitch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: '"' + match[0] + '" appears to be a speech-recognition error.',
      correction: 'social media apps',
      explanation: 'This is a transcription artifact. The intended phrase was likely "social media" or a specific app name like "LinkedIn".',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "than you skills / thank you skills" (ASR glitch for "learn new skills") Ã¢â€â‚¬Ã¢â€â‚¬
  const thanYouSkillsRegex = /\b(than\s+you\s+skills|thank\s+you\s+skills)\b/gi;
  while ((match = thanYouSkillsRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Speech Recognition Glitch',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Speech recognition captured "' + match[0] + '" instead of "learn new skills".',
      correction: 'learn new skills',
      explanation: 'This appears to be an automated transcription artifact. The intended spoken phrase was likely "learn new skills".',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "daily life communicate" (missing connector "to") Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const dailyLifeCommunicateRegex = /\bdaily\s+life\s+communicate\b/gi;
  while ((match = dailyLifeCommunicateRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Sentence Structure',
      errorType: 'Missing Infinitive Particle "to"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing infinitive "to" before the verb "communicate".',
      correction: 'daily life to communicate',
      explanation: 'Use "to communicate" or start a new clause with "It allows us to communicate".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "platform like YouTube" (should be plural "platforms like") Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const platformLikeRegex = /\bplatform\s+like\s+([a-z0-9]+(?:\s+and\s+[a-z0-9]+)?)\b/gi;
  while ((match = platformLikeRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Singular/Plural',
      errorType: 'Plural Noun Required for Examples',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular "platform" before multiple examples ("' + match[1] + '").',
      correction: 'platforms like ' + match[1],
      explanation: 'When introducing multiple examples with "like", use the plural noun "platforms".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "sometime mental health" (missing verb / word form) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const sometimeMentalRegex = /\bsometime\s+(?:our\s+)?(mental\s+health|physical\s+health)\b/gi;
  while ((match = sometimeMentalRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Sentence Structure',
      errorType: 'Missing Verb with Adverb',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing verb after adverb "sometimes".',
      correction: 'sometimes affects ' + match[1],
      explanation: 'Adverbs like "sometimes" must modify a verb (e.g. "sometimes affects ' + match[1] + '", "sometimes harms ' + match[1] + '").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "media answer disadvantages" (ASR glitch for "media also has disadvantages") Ã¢â€â‚¬
  const mediaAnswerDisadvRegex = /\b(?:should\s+)?media\s+(?:answer|also)\s+disadvantages\b/gi;
  while ((match = mediaAnswerDisadvRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Sentence Structure',
      errorType: 'Awkward Phrasing / Transcription Glitch',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Unclear sentence structure in "' + match[0] + '".',
      correction: 'media also has disadvantages',
      explanation: 'Use clear phrasing: "social media also has disadvantages" or "we should consider its disadvantages".',
      isStyleOnly: false
    });
  }

  const thirdPersonPronounRegex = /\b(it|he|she)\s+(also\s+|just\s+|never\s+|always\s+)?(communicate|provide|learn|share|stay|cause|waste|affect|depend)\b/gi;
  while ((match = thirdPersonPronounRegex.exec(text)) !== null) {
    const pron = match[1];
    const adv = match[2] || '';
    const verb = match[3];
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Third-Person Singular Disagreement',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Third-person singular pronoun "' + pron + '" used with base verb "' + verb + '".',
      correction: pron + ' ' + adv + verb + 's',
      explanation: 'Third-person singular pronouns ("' + pron + '") require verb ending in "-s" ("' + verb + 's").',
      isStyleOnly: false
    });
  }

  const didYouNounRegex = /\bdid\s+you\s+(concentration|education|communication|attention|health)\b/gi;
  while ((match = didYouNounRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Sentence Structure',
      errorType: 'Incorrect Auxiliary + Noun Construction',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used auxiliary "did you" directly before noun "' + match[1] + '".',
      correction: 'affects ' + match[1],
      explanation: 'Auxiliary "did" must be followed by a base verb, not a noun ("' + match[1] + '"). Use "affects ' + match[1] + '".',
      isStyleOnly: false
    });
  }

  const detailsOnRegex = /\b(details|detail)\s+on\s+how\b/gi;
  while ((match = detailsOnRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Incorrect Verb/Word Choice',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "details on how" instead of "depends on how".',
      correction: 'depends on how',
      explanation: 'In the context of conditional outcomes, use "it depends on how", not "it details on how".',
      isStyleOnly: false
    });
  }

  const interHealthRegex = /\b(inter\s+health|internal\s+health)\b/gi;
  while ((match = interHealthRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Incorrect Adjective Choice',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "' + match[0] + '" instead of "mental health".',
      correction: 'mental health',
      explanation: 'When referring to psychological well-being alongside physical health, use "mental health".',
      isStyleOnly: false
    });
  }

  const causeEditionRegex = /\b(cause|causing)\s+(edition|addition)\b/gi;
  while ((match = causeEditionRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Transcription Artifact',
      errorType: 'Possible Speech-Recognition Glitch',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Speech recognition captured "' + match[2] + '" instead of "addiction".',
      correction: match[1] + ' addiction',
      explanation: 'This appears to be a speech-recognition glitch. Intended phrase was likely "causes addiction".',
      isStyleOnly: false,
      isTranscriptionArtifact: true
    });
  }

  const pastPresentRegex = /\b(yesterday|last (?:week|night|year|month))\s+([a-z]+)\s+(go|meet|see|take|come|give|is|are)\b/gi;
  while ((match = pastPresentRegex.exec(text)) !== null) {
    const verb = match[3].toLowerCase();
    const pastForms = { go:'went',meet:'met',see:'saw',take:'took',come:'came',give:'gave',is:'was',are:'were' };
    if (pastForms[verb]) {
      mistakes.push({
        category: 'Tense', errorType: 'Incorrect Past Tense', severity: 'major',
        youSaid: match[0], original: match[0],
        problem: 'Used present tense "' + verb + '" with past time marker "' + match[1] + '".',
        correction: match[1] + ' ' + match[2] + ' ' + pastForms[verb],
        explanation: '"' + match[1] + '" refers to past time — use past tense "' + pastForms[verb] + '" instead of "' + verb + '".',
        isStyleOnly: false
      });
    }
  }

  const pluralWasRegex = /\b(we|they|you)\s+was\b/gi;
  while ((match = pluralWasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement', errorType: 'Plural Subject-Verb Disagreement', severity: 'major',
      youSaid: match[0], original: match[0],
      problem: 'Used singular verb "was" with plural pronoun "' + match[1] + '".',
      correction: match[1] + ' were',
      explanation: 'The plural pronoun "' + match[1] + '" requires the plural verb "were" instead of "was".',
      isStyleOnly: false
    });
  }

  const discussAboutRegex = /\b(discuss|discussed|discussing|discusses)\s+about\b/gi;
  while ((match = discussAboutRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Word Usage', errorType: 'Unnecessary Preposition', severity: 'moderate',
      youSaid: match[0], original: match[0],
      problem: 'Used unnecessary preposition "about" with transitive verb "' + match[1] + '".',
      correction: match[1],
      explanation: 'The verb "' + match[1] + '" takes a direct object without requiring "about".',
      isStyleOnly: false
    });
  }

  const manySingularRegex = /\b(many|several|few)\s+(idea|thing|problem|reason|result)\b/gi;
  while ((match = manySingularRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Singular/Plural', errorType: 'Noun Pluralization Error', severity: 'moderate',
      youSaid: match[0], original: match[0],
      problem: 'Singular noun "' + match[2] + '" used with plural quantifier "' + match[1] + '".',
      correction: match[1] + ' ' + match[2] + 's',
      explanation: 'The quantifier "' + match[1] + '" must be followed by a plural noun ("' + match[2] + 's").',
      isStyleOnly: false
    });
  }

  const COMMON_MODAL_MISUSE = ['helps','goes','makes','gives','comes','takes','runs','does','says',
    'plays','works','needs','knows','wants','looks','turns','stays','becomes','gets','puts','lets','keeps','sends','shows','brings','sets','asks'];
  const modalSVerbRegex = /\b(can|could|will|would|should|may|might|must)\s+([a-z]+s)\b/gi;
  while ((match = modalSVerbRegex.exec(text)) !== null) {
    const verb = match[2].toLowerCase();
    if (COMMON_MODAL_MISUSE.includes(verb)) {
      const baseVerb = verb.slice(0, -1);
      mistakes.push({
        category: 'Modal Verbs', errorType: 'Modal Verb Form Error', severity: 'major',
        youSaid: match[0], original: match[0],
        problem: 'Modal verb "' + match[1] + '" followed by conjugated verb "' + verb + '".',
        correction: match[1] + ' ' + baseVerb,
        explanation: 'Modal verbs like "' + match[1] + '" must be followed by the base form ("' + baseVerb + '"), not "' + verb + '".',
        isStyleOnly: false
      });
    }
  }

  const asBecomeRegex = /\b(as\s+become|as\s+been)\b/gi;
  while ((match = asBecomeRegex.exec(text)) !== null) {
    const verbPart = match[0].toLowerCase().includes('been') ? 'been' : 'become';
    mistakes.push({
      category: 'Grammar',
      errorType: 'Incorrect Auxiliary Verb',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "as ' + verbPart + '" instead of perfect auxiliary "has ' + verbPart + '".',
      correction: 'has ' + verbPart,
      explanation: 'Use auxiliary verb "has" (or "have") before past participle "' + verbPart + '", not preposition "as".',
      isStyleOnly: false
    });
  }

  const neitherNotRegex = /\bneither\s+([^.\n]+?)\s+not\s+([^.\n]+?)\b/gi;
  while ((match = neitherNotRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Grammar',
      errorType: 'Incorrect Conjunction',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "not" with "neither" instead of paired correlative conjunction "nor".',
      correction: 'neither ' + match[1] + ' nor ' + match[2],
      explanation: 'The correct correlative conjunction pair is "neither...nor", not "neither...not".',
      isStyleOnly: false
    });
  }

  const importantPartRegex = /\b(become|is|was|represents)\s+important\s+part\b/gi;
  while ((match = importantPartRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Articles',
      errorType: 'Missing Article',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing indefinite article "an" before vowel-sound adjective "important".',
      correction: match[1] + ' an important part',
      explanation: 'Singular countable noun phrase "important part" requires indefinite article "an".',
      isStyleOnly: false
    });
  }

  const platformProvideRegex = /\b(platform)\s+like\s+([a-z0-9]+)\s+provide\b/gi;
  while ((match = platformProvideRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Plural Noun / Verb Disagreement',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Singular noun "platform" used with plural verb "provide".',
      correction: 'platforms like ' + match[2] + ' provide',
      explanation: 'Use plural subject "platforms" with plural verb "provide" (or "platform...provides").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "Social media are / is" â€” mass nouns treated as singular Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // "Social media" is treated as singular (like "the press", "the news").
  const massNounPluralVerbRegex = /\b(social\s+media|the\s+media|the\s+news|the\s+information|the\s+data)\s+are\b/gi;
  while ((match = massNounPluralVerbRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Mass Noun + Plural Verb',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: '"' + match[1] + '" is treated as singular in modern English and requires "is", not "are".',
      correction: match[1] + ' is',
      explanation: 'In modern usage, "' + match[1] + '" functions as a singular noun and takes the singular verb "is".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Modal + conjugated verb (extends COMMON_MODAL_MISUSE with "uses", "reduces", etc.) Ã¢â€â‚¬Ã¢â€â‚¬
  // The existing COMMON_MODAL_MISUSE list may not cover all conjugated verbs ending in -s.
  // Catch any modal + [-s verb] patterns not already caught above.
  const EXTENDED_MODAL_S_VERBS = new Set([
    'uses','reduces','increases','improves','affects','allows','creates','brings',
    'provides','causes','enables','helps','makes','takes','gives','runs','does',
    'says','plays','works','needs','knows','wants','looks','turns','stays',
    'becomes','gets','puts','lets','keeps','sends','shows','sets','asks',
    'goes','comes'
  ]);
  const extendedModalRegex = /\b(can|could|will|would|should|may|might|must)\s+([a-z]{3,}s)\b/gi;
  while ((match = extendedModalRegex.exec(text)) !== null) {
    const verb = match[2].toLowerCase();
    if (EXTENDED_MODAL_S_VERBS.has(verb)) {
      const baseVerb = verb.endsWith('es') && !verb.endsWith('oes') && !verb.endsWith('ses')
        ? verb.slice(0, -2)  // e.g. "uses" â†’ "use", "reduces" â†’ "reduc" — handle below
        : verb.slice(0, -1);
      // Better base-form derivation for -es verbs
      let correctBase;
      if (verb === 'uses') correctBase = 'use';
      else if (verb === 'reduces') correctBase = 'reduce';
      else if (verb === 'increases') correctBase = 'increase';
      else if (verb === 'improves') correctBase = 'improve';
      else if (verb === 'provides') correctBase = 'provide';
      else if (verb === 'enables') correctBase = 'enable';
      else if (verb === 'causes') correctBase = 'cause';
      else if (verb === 'creates') correctBase = 'create';
      else if (verb === 'allows') correctBase = 'allow';
      else if (verb === 'affects') correctBase = 'affect';
      else if (verb === 'brings') correctBase = 'bring';
      else correctBase = verb.slice(0, -1);

      // Avoid duplicate with existing COMMON_MODAL_MISUSE check
      const alreadyCaught = mistakes.some(m =>
        (m.youSaid || '').toLowerCase() === match[0].toLowerCase()
      );
      if (!alreadyCaught) {
        mistakes.push({
          category: 'Modal Verbs',
          errorType: 'Modal Verb Form Error',
          severity: 'major',
          youSaid: match[0],
          original: match[0],
          problem: 'Modal verb "' + match[1] + '" followed by conjugated verb "' + verb + '".',
          correction: match[1] + ' ' + correctBase,
          explanation: 'Modal verbs like "' + match[1] + '" must be followed by the base form of the verb ("' + correctBase + '"), not the conjugated form "' + verb + '".',
          isStyleOnly: false
        });
      }
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Gerund/noun subject + unconjugated verb (spending reduce, time reduce, etc.) Ã¢â€â‚¬Ã¢â€â‚¬
  // Patterns: "spending ... reduce", "time ... reduce" (should be "reduces")
  const gerundSubjectVerbRegex = /\b(spending|time|usage|use|growth|access|exposure|lack|increase|decrease)\s+(?:too\s+much\s+|of\s+|on\s+\w+\s+)?(reduce|increase|affect|cause|impact|harm|help|improve|lower|raise|boost)\b/gi;
  while ((match = gerundSubjectVerbRegex.exec(text)) !== null) {
    const subj = match[1];
    const verb = match[2];
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Gerund/Noun Subject + Unconjugated Verb',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'The noun/gerund subject "' + subj + '" requires the third-person singular form of the verb "' + verb + 's".',
      correction: match[0].replace(new RegExp('\\b' + verb + '\\b', 'gi'), verb + 's'),
      explanation: '"' + subj + '" is a singular noun subject. In the simple present tense, the verb must agree: "' + verb + 's".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "he don't / she don't / it don't" Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const thirdPersonDontRegex = /\b(he|she|it)\s+don't\b/gi;
  while ((match = thirdPersonDontRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Third-Person Singular Auxiliary Error',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used plural auxiliary "don\'t" with third-person singular pronoun "' + match[1] + '".',
      correction: match[1] + " doesn't",
      explanation: 'Third-person singular pronouns ("he", "she", "it") require "doesn\'t", not "don\'t".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "I doesn't / we doesn't / they doesn't / you doesn't" Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const nonThirdPersonDoesntRegex = /\b(i|we|they|you)\s+doesn't\b/gi;
  while ((match = nonThirdPersonDoesntRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Auxiliary Verb Agreement Error',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular auxiliary "doesn\'t" with pronoun "' + match[1] + '".',
      correction: match[1] + " don't",
      explanation: 'Pronouns like "' + match[1] + '" require auxiliary verb "don\'t", not "doesn\'t".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "did + past tense verb" (did went, did came, did saw, didn't went) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const didPastRegex = /\b(did|didn't)\s+(went|came|saw|took|gave|became|spoke|told|made|knew|got)\b/gi;
  const PAST_TO_BASE = { went: 'go', came: 'come', saw: 'see', took: 'take', gave: 'give', became: 'become', spoke: 'speak', told: 'tell', made: 'make', knew: 'know', got: 'get' };
  while ((match = didPastRegex.exec(text)) !== null) {
    const aux = match[1];
    const verb = match[2].toLowerCase();
    const base = PAST_TO_BASE[verb] || verb;
    mistakes.push({
      category: 'Verb Tense',
      errorType: 'Double Past Tense Marking',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used past tense verb "' + verb + '" after auxiliary "' + aux + '".',
      correction: aux + ' ' + base,
      explanation: 'Auxiliary verb "' + aux + '" already indicates past tense, so the following main verb must be in base form ("' + base + '").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "a + vowel" article error (a important, a apple, a idea, a opportunity, a industry) Ã¢â€â‚¬
  const aVowelRegex = /\ba\s+(important|apple|idea|opportunity|industry|example|issue|error|hour|individual|organization|activity|interview|algorithm|application)\b/gi;
  while ((match = aVowelRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Articles',
      errorType: 'Indefinite Article Error',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Used article "a" before vowel sound in "' + match[1] + '".',
      correction: 'an ' + match[1],
      explanation: 'Words beginning with a vowel sound take the indefinite article "an", not "a".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "an + consonant" article error (an university, an unique, an European) Ã¢â€â‚¬
  const anConsonantRegex = /\ban\s+(university|unique|european|useful|user|uniform|one)\b/gi;
  while ((match = anConsonantRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Articles',
      errorType: 'Indefinite Article Error',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Used article "an" before consonant "y"/"w" sound in "' + match[1] + '".',
      correction: 'a ' + match[1],
      explanation: 'Words beginning with a "yu" sound take the indefinite article "a", not "an".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "one of my friend / one of the student" (missing plural after 'one of') Ã¢â€â‚¬
  const oneOfSingularRegex = /\bone\s+of\s+(?:my|the|our|these|those)\s+(friend|student|problem|reason|issue|example|factor|advantage|challenge|aspect)\b/gi;
  while ((match = oneOfSingularRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Singular/Plural',
      errorType: 'Plural Noun Required After "One of"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular noun "' + match[1] + '" after "one of".',
      correction: match[0] + 's',
      explanation: 'The construction "one of [the/my...]" must be followed by a plural noun ("' + match[1] + 's").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Uncountable nouns with plural -s (informations, advices, furnitures, equipments, feedbacks) Ã¢â€â‚¬
  const uncountablePluralRegex = /\b(informations|advices|furnitures|equipments|feedbacks|evidences)\b/gi;
  const UNCOUNTABLE_MAP = { informations: 'information', advices: 'advice', furnitures: 'furniture', equipments: 'equipment', feedbacks: 'feedback', evidences: 'evidence' };
  while ((match = uncountablePluralRegex.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    const correctWord = UNCOUNTABLE_MAP[word] || word;
    mistakes.push({
      category: 'Word Form',
      errorType: 'Uncountable Noun Pluralization',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Added plural "-s" to uncountable noun "' + match[0] + '".',
      correction: correctWord,
      explanation: '"' + correctWord + '" is an uncountable noun and has no plural form with "-s".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "more better / more easier / most best" (double comparatives/superlatives) Ã¢â€â‚¬
  const doubleComparativeRegex = /\b(more\s+(?:better|easier|faster|harder|simpler|clearer|higher|lower)|most\s+(?:best|worst|fastest|easiest|clearest))\b/gi;
  while ((match = doubleComparativeRegex.exec(text)) !== null) {
    const phrase = match[0];
    const single = phrase.replace(/\b(more|most)\s+/i, '');
    mistakes.push({
      category: 'Grammar',
      errorType: 'Double Comparative/Superlative',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Used redundant "' + phrase.split(' ')[0] + '" with comparative/superlative "' + single + '".',
      correction: single,
      explanation: '"' + single + '" is already comparative/superlative — do not combine it with "' + phrase.split(' ')[0] + '".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "listen music / listen podcast" (missing preposition 'to') Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const listenToRegex = /\b(listen|listens|listening|listened)\s+(music|podcast|songs|radio|audio|teacher|speaker)\b/gi;
  while ((match = listenToRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Missing Preposition "to"',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Missing preposition "to" after "' + match[1] + '".',
      correction: match[1] + ' to ' + match[2],
      explanation: 'The verb "listen" requires the preposition "to" before its object ("' + match[1] + ' to ' + match[2] + '").',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "good in" (e.g. good in English / good in communication) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const goodInRegex = /\b(good|great|skilled|expert)\s+in\s+(english|math|science|communication|speaking|coding|programming|writing)\b/gi;
  while ((match = goodInRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Prepositions',
      errorType: 'Incorrect Preposition with Adjective',
      severity: 'moderate',
      youSaid: match[0],
      original: match[0],
      problem: 'Used "in" with "' + match[1] + '" instead of "at".',
      correction: match[1] + ' at ' + match[2],
      explanation: 'Use "good at", "great at", or "skilled at" when describing proficiency in an activity or subject.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "revert back / return back / repeat again" (redundant adverbs) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const redundantAdverbRegex = /\b(revert\s+back|return\s+back|repeat\s+again|reply\s+back)\b/gi;
  while ((match = redundantAdverbRegex.exec(text)) !== null) {
    const verb = match[0].split(' ')[0];
    mistakes.push({
      category: 'Word Usage',
      errorType: 'Redundant Phrasing',
      severity: 'minor',
      youSaid: match[0],
      original: match[0],
      problem: 'Used redundant adverb after "' + verb + '".',
      correction: verb,
      explanation: '"' + verb + '" already implies the backward/repetitive action — "' + match[0].split(' ')[1] + '" is redundant.',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "I has / we has / they has / you has" Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const pluralHasRegex = /\b(i|we|they|you)\s+has\b/gi;
  while ((match = pluralHasRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Incorrect Auxiliary "has"',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used singular verb "has" with pronoun "' + match[1] + '".',
      correction: match[1] + ' have',
      explanation: 'The pronoun "' + match[1] + '" requires the verb "have", not "has".',
      isStyleOnly: false
    });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ "he have / she have / it have" Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const singularHaveRegex = /\b(he|she|it)\s+have\b/gi;
  while ((match = singularHaveRegex.exec(text)) !== null) {
    mistakes.push({
      category: 'Subject-Verb Agreement',
      errorType: 'Third-Person Singular Verb Error',
      severity: 'major',
      youSaid: match[0],
      original: match[0],
      problem: 'Used base verb "have" with third-person singular pronoun "' + match[1] + '".',
      correction: match[1] + ' has',
      explanation: 'Third-person singular pronouns ("he", "she", "it") require "has", not "have".',
      isStyleOnly: false
    });
  }

  // Deduplicate heuristic mistakes by phrase match
  const uniqueMistakes = [];
  mistakes.forEach(m => {
    const key = (m.youSaid || m.original || '').toLowerCase().trim();
    if (!key) return;
    const exists = uniqueMistakes.some(u => {
      const uKey = (u.youSaid || u.original || '').toLowerCase().trim();
      return uKey === key || (uKey.includes(key) && u.category === m.category);
    });
    if (!exists) {
      uniqueMistakes.push(m);
    }
  });

  return uniqueMistakes;
};

const buildWordMistakesFromList = (mistakes) => {
  if (!Array.isArray(mistakes)) return [];
  return mistakes.map(m => ({
    spokenWord: m.youSaid || m.original,
    problem: m.problem || m.errorType || 'Grammar or word usage issue',
    betterWord: m.correction || m.betterAlternative || '',
    explanation: m.explanation || '',
    severity: m.severity || 'moderate'
  }));
};

const buildRuleBasedSentenceAnalysis = (userTranscript, mistakes) => {
  const rawSentences = userTranscript.split(/(?<=[.?!])\s+|(?:\n+)/).filter(Boolean);
  const sentences = rawSentences.length > 0 ? rawSentences : [userTranscript];

  return sentences.map((s, idx) => {
    const sentLower = s.toLowerCase();
    const sentenceMistakes = mistakes.filter(m => sentLower.includes((m.youSaid || '').toLowerCase()));

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
        youSaid: m.youSaid,
        correction: m.correction,
        explanation: m.explanation,
        severity: m.severity
      })),
      correctedSentence: correctedSentence !== s ? correctedSentence : s,
      improvementTip: sentenceMistakes.length > 0
        ? ('Review the ' + sentenceMistakes[0].category.toLowerCase() + ' error "' + sentenceMistakes[0].youSaid + '".')
        : 'Good sentence structure.'
    };
  });
};

const fallbackEvaluation = (rubric, userTranscript, activityName, topic, aiUnavailableReason = '') => {
  const words = userTranscript.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount <= 3) {
    return buildInsufficientSpeechResult(rubric, 'No meaningful speech detected. Please speak for a longer duration.');
  }

  const heuristicMistakes = scanTranscriptHeuristics(userTranscript);
  const hardErrorCount = heuristicMistakes.filter(m => !m.isStyleOnly && !m.isTranscriptionArtifact).length;
  const topicMatched = checkTopicRelevanceInText(topic, userTranscript);

  // DYNAMIC RATING CALCULATOR:
  // No hardcoded 60 scores!
  const ratingsMap = {};
  const evidenceMap = {};
  const improvementMap = {};

  rubric.criteria.forEach(c => {
    const cap = getMaxRatingForWordCount(wordCount, c.key);
    let r = cap;

    if (c.key.toLowerCase().includes('grammar') || c.key.toLowerCase().includes('accuracy')) {
      if (hardErrorCount >= 5) r = 1;
      else if (hardErrorCount >= 3) r = 2;
      else if (hardErrorCount >= 2) r = 2;
      else if (hardErrorCount >= 1) r = 3;
      else r = Math.min(5, cap);
    } else if (c.key.toLowerCase().includes('relevance') || c.key.toLowerCase().includes('topic')) {
      r = topicMatched ? Math.min(5, cap) : 1;
    } else {
      if (hardErrorCount >= 4) r = Math.min(2, cap);
      else if (hardErrorCount >= 2) r = Math.min(2, cap);
      else if (hardErrorCount >= 1) r = Math.min(3, cap);
      else r = Math.min(5, cap);
    }

    ratingsMap[c.key] = r;
    evidenceMap[c.key] = 'Evaluation based on transcript analysis of ' + wordCount + ' words and ' + hardErrorCount + ' detected errors.';
    improvementMap[c.key] = 'Practise speaking for longer with clear sentence structures.';
  });

  const result = calculateScore(rubric, ratingsMap, evidenceMap, improvementMap, false);
  const wordMistakes = buildWordMistakesFromList(heuristicMistakes);
  const sentenceAnalysis = buildRuleBasedSentenceAnalysis(userTranscript, heuristicMistakes);

  let correctedSpeech = userTranscript;
  heuristicMistakes.forEach(m => {
    if (m.youSaid && m.correction) {
      const regex = new RegExp(m.youSaid.replace(/[^\w\s]/g, ''), 'gi');
      correctedSpeech = correctedSpeech.replace(regex, m.correction);
    }
  });

  const feedbackMsg = aiUnavailableReason
    ? ('Detailed AI evaluation could not connect to Gemini (' + aiUnavailableReason + '). Rule-based analysis evaluated your speech and detected ' + hardErrorCount + ' issue(s).')
    : ('Analysis complete. Detected ' + hardErrorCount + ' issue(s) in your speech.');

  let positiveObs = [];
  if (hardErrorCount === 0 && wordCount >= 35 && topicMatched && !aiUnavailableReason) {
    positiveObs = ['Demonstrated clear sentence formation across spoken points.'];
  }

  let strengths = [];
  if (hardErrorCount === 0 && wordCount >= 35 && topicMatched && !aiUnavailableReason) {
    strengths = ['Maintained relevant topic discussion with structured thoughts.'];
  }

  const formattedIssues = heuristicMistakes.map(m => ({
    youSaid: m.youSaid || m.original || '',
    original: m.original || m.youSaid || '',
    problem: m.problem || m.explanation || 'Grammar or word usage issue.',
    correction: m.correction || m.betterAlternative || '',
    betterAlternative: m.betterAlternative || m.correction || '',
    explanation: m.explanation || m.problem || '',
    category: m.category || 'Grammar',
    errorType: m.errorType || m.category || 'Grammar Error',
    improvement: m.improvement || ('Check ' + (m.errorType || m.category).toLowerCase() + ' in future speech.'),
    severity: m.severity || 'moderate',
    isStyleOnly: !!m.isStyleOnly,
    isTranscriptionArtifact: !!m.isTranscriptionArtifact
  }));

  // Only mark as 'error' if the AI failed for a runtime reason (network error, invalid JSON etc.)
  // and the rule scanner was unable to provide useful data.
  // When Gemini is simply not configured, the rule scanner IS the intended analysis path —
  // its result (including 0 errors) should be returned as 'success', not 'error'.
  const isRuntimeAIError = !!aiUnavailableReason && !aiUnavailableReason.toLowerCase().includes('not configured') && !aiUnavailableReason.toLowerCase().includes('api key');
  const mistakeAnalysisData = {
    status: isRuntimeAIError ? 'error' : 'success',
    issueCount: isRuntimeAIError ? 0 : formattedIssues.length,
    issues: isRuntimeAIError ? [] : formattedIssues,
    errorMessage: isRuntimeAIError ? 'Speech analysis could not be completed. Please try analyzing the session again.' : null
  };

  console.log('[1] TRANSCRIPT:', userTranscript);
  console.log('[3] NORMALIZED MISTAKES:', formattedIssues);
  console.log('[4] FINAL MISTAKE COUNT:', formattedIssues.length);
  console.log('[5] FINAL RESPONSE:', mistakeAnalysisData);

  return {
    ...result,
    hasSpeech: true,
    speechDetected: true,
    aiAnalysisCompleted: !aiUnavailableReason,
    confidence: wordCount > 50 ? 0.75 : 0.6,
    summary: 'Speech of ' + wordCount + ' words on "' + (topic || activityName) + '". Detected ' + hardErrorCount + ' error(s).',
    strengths,
    areasToImprove: [
      hardErrorCount > 0
        ? (hardErrorCount + ' grammar/usage issue(s) detected — review the detailed analysis below.')
        : 'Elaborate further on your ideas with supporting examples.',
      'Practice speaking with complete, well-formed sentences.'
    ],
    positiveObservations: positiveObs,
    mistakeAnalysis: mistakeAnalysisData,
    mistakes: formattedIssues,
    wordMistakes,
    wordAnalysis: wordMistakes,
    sentenceAnalysis,
    correctedSpeech: correctedSpeech !== userTranscript ? correctedSpeech : userTranscript,
    errorSummary: {
      major: heuristicMistakes.filter(m => m.severity === 'major').length,
      moderate: heuristicMistakes.filter(m => m.severity === 'moderate').length,
      minor: heuristicMistakes.filter(m => m.severity === 'minor').length
    },
    categoryBreakdown: {
      grammarErrors: heuristicMistakes.filter(m => m.category === 'Grammar' || m.category === 'Auxiliary Verbs').length,
      wordUsageErrors: heuristicMistakes.filter(m => m.category === 'Word Usage').length,
      articleErrors: 0,
      tenseErrors: heuristicMistakes.filter(m => m.category === 'Tense').length,
      svAgreementErrors: heuristicMistakes.filter(m => m.category === 'Subject-Verb Agreement').length,
      prepositionErrors: heuristicMistakes.filter(m => m.category === 'Prepositions').length,
      sentenceStructureErrors: heuristicMistakes.filter(m => m.category === 'Sentence Structure').length
    },
    pronunciationAnalysis: 'Pronunciation requires audio-level analysis. The current speech transcript can evaluate language usage, but it cannot reliably determine exact pronunciation.',
    fluencyDelivery: wordCount > 50 ? 'Speech captured across multiple sentences.' : 'Brief speech sample.',
    topicRelevance: topicMatched ? 'Speech mentions topic keywords.' : 'Limited alignment with the given topic.',
    mentorAdvice: [
      hardErrorCount > 0 ? 'Review the detected grammar errors below and practice correcting those patterns.' : 'Focus on expanding your points with reasons.',
      'Aim to speak continuously for 60–90 seconds for a full evaluation.'
    ],
    aiFeedback: feedbackMsg
  };
};

export const evaluateTranscript = async ({ transcript, activityName, topic, activityType, durationSeconds }) => {
  const cleanTranscript = (transcript || '').trim();
  const userSpokenText = extractUserSpokenContent(cleanTranscript);

  console.log('\n=======================================================');
  console.log('--- [LANGUAGETOOL + CONTENT EVALUATION PIPELINE START] ---');
  console.log('Activity:', activityName);
  console.log('Topic:', topic || 'N/A');
  console.log('[DEBUG] RAW transcript received (first 200 chars):', JSON.stringify(cleanTranscript.substring(0, 200)));
  console.log('[DEBUG] RAW transcript length (chars):', cleanTranscript.length);
  console.log('[DEBUG] After extractUserSpokenContent (first 200 chars):', JSON.stringify(userSpokenText.substring(0, 200)));
  console.log('[DEBUG] userSpokenText length (chars):', userSpokenText.length);
  console.log('=======================================================\n');


  const EMPTY_FIELDS = {
    wordMistakes: [], wordAnalysis: [], sentenceAnalysis: [], correctedSpeech: '',
    errorSummary: { major: 0, moderate: 0, minor: 0 },
    categoryBreakdown: { grammarErrors: 0, wordUsageErrors: 0, articleErrors: 0, tenseErrors: 0, svAgreementErrors: 0, prepositionErrors: 0, sentenceStructureErrors: 0, typoErrors: 0 }
  };

  // Helper to build zero criteria list
  const buildEmptyCriteriaList = () => [
    { key: 'grammar', label: 'Grammar Accuracy', weight: 20, rating: 0, weightedScore: 0, maxWeightedScore: 20, evidence: 'No speech was detected in this session.', improvement: 'Speak clearly into the microphone.' },
    { key: 'topicRelevance', label: 'Topic Relevance', weight: 20, rating: 0, weightedScore: 0, maxWeightedScore: 20, evidence: 'No speech was detected in this session.', improvement: 'Discuss the given topic directly.' },
    { key: 'contentDepth', label: 'Content Depth', weight: 20, rating: 0, weightedScore: 0, maxWeightedScore: 20, evidence: 'No speech was detected in this session.', improvement: 'Provide explanations and examples.' },
    { key: 'topicCoverage', label: 'Topic Coverage', weight: 15, rating: 0, weightedScore: 0, maxWeightedScore: 15, evidence: 'No speech was detected in this session.', improvement: 'Cover multiple perspectives on the topic.' },
    { key: 'vocabulary', label: 'Vocabulary & Word Choice', weight: 10, rating: 0, weightedScore: 0, maxWeightedScore: 10, evidence: 'No speech was detected in this session.', improvement: 'Use descriptive vocabulary.' },
    { key: 'structure', label: 'Structure & Flow', weight: 10, rating: 0, weightedScore: 0, maxWeightedScore: 10, evidence: 'No speech was detected in this session.', improvement: 'Organize speech with clear points.' },
    { key: 'fluency', label: 'Fluency & Delivery', weight: 5, rating: 0, weightedScore: 0, maxWeightedScore: 5, evidence: 'No speech was detected in this session.', improvement: 'Maintain continuous spoken pace.' }
  ];

  // 1. Tier 0: Empty Speech Check -> Score 0
  if (!userSpokenText || userSpokenText.length === 0) {
    console.log('[EVALUATOR RESULT] Tier 0: Empty speech -> Score 0');
    return {
      criteria: buildEmptyCriteriaList(),
      finalScore: 0,
      performanceLevel: 'Very Poor',
      hasSpeech: false,
      speechDetected: false,
      isEmptySpeech: true,
      aiAnalysisCompleted: true,
      aiAnalysisAvailable: true,
      confidence: 0,
      summary: 'No spoken content detected.',
      ...EMPTY_FIELDS,
      strengths: [],
      areasToImprove: ['Make sure microphone is unmuted and speak clearly.'],
      positiveObservations: [],
      mentorAdvice: [
        'Ensure your microphone is enabled in browser settings.',
        'Speak clearly and continuously before submitting your session.'
      ],
      mistakeAnalysis: {
        status: 'no_speech',
        issueCount: 0,
        issues: [],
        mistakes: [],
        errorMessage: null
      },
      mistakes: [],
      pronunciationAnalysis: 'No speech available for pronunciation analysis.',
      fluencyDelivery: 'No speech detected.',
      topicRelevance: 'Not applicable — no speech was recorded.',
      aiFeedback: 'No speech detected. Please speak into the microphone to receive an evaluation.'
    };
  }

  // 2. Tier 1: Insufficient Speech Check (single word/empty OR only generic greetings) -> Score 0
  // IMPORTANT: wordCount <= 1 only — even 2–3 word real speech must reach the full evaluator.
  // isOnlyGeneric handles cases like "hello mic test" (all greeting/filler words).
  const words = tokenizeWords(userSpokenText);
  const wordCount = words.length;
  const isOnlyGeneric = wordCount > 0 && words.every(w => ['hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening', 'test', 'testing', 'mic', 'one', 'two', 'three', 'okay', 'yes', 'no', 'thanks', 'thank'].includes(w));

  if (wordCount <= 1 || isOnlyGeneric) {
    console.log(`[EVALUATOR RESULT] Tier 1: Insufficient speech ("${userSpokenText}") -> Score 0`);
    return {
      criteria: buildEmptyCriteriaList(),
      finalScore: 0,
      performanceLevel: 'Very Poor',
      hasSpeech: false,
      speechDetected: false,
      isEmptySpeech: true,
      aiAnalysisCompleted: true,
      aiAnalysisAvailable: true,
      confidence: 0.1,
      summary: `Insufficient speech detected ("${userSpokenText}").`,
      ...EMPTY_FIELDS,
      strengths: [],
      areasToImprove: ['Speak for at least 3-5 complete sentences on the topic.'],
      positiveObservations: [],
      mentorAdvice: [
        'Speak for at least 3-5 complete sentences.',
        'Explain your opinion with reasons and examples.'
      ],
      mistakeAnalysis: {
        status: 'no_speech',
        issueCount: 0,
        issues: [],
        mistakes: [],
        errorMessage: null
      },
      mistakes: [],
      pronunciationAnalysis: 'Pronunciation could not be evaluated from insufficient speech.',
      fluencyDelivery: 'Insufficient speech to measure fluency or pacing.',
      topicRelevance: 'Insufficient speech to determine topic alignment.',
      aiFeedback: 'Insufficient speech detected. Please speak for a longer duration to receive a full evaluation.'
    };
  }

  // 3. Step 1: Send COMPLETE transcript to LanguageTool Public HTTP API
  console.log('[EVALUATOR] Calling LanguageTool Public HTTP API...');
  const ltStart = Date.now();
  const ltResult = await checkWithLanguageTool(userSpokenText);
  console.log(`[EVALUATOR] LanguageTool responded in ${Date.now() - ltStart}ms | Success: ${ltResult.success}`);

  // If LanguageTool API failed: Return explicit error status (NO fabricated 100 or default score)
  if (!ltResult.success) {
    console.warn('⚠️ LanguageTool API failed:', ltResult.error);
    return {
      aiAnalysisAvailable: false,
      analysisError: `Grammar checking service (LanguageTool) is unavailable: ${ltResult.error}. Please check your network and try again.`,
      finalScore: 0,
      performanceLevel: 'Poor',
      hasSpeech: true,
      speechDetected: true,
      isEmptySpeech: false,
      aiAnalysisCompleted: false,
      summary: 'Grammar checking service is temporarily unavailable.',
      mistakeAnalysis: {
        status: 'error',
        issueCount: 0,
        issues: [],
        mistakes: [],
        errorMessage: `LanguageTool API is temporarily unavailable: ${ltResult.error}`
      },
      mistakes: [],
      wordMistakes: [],
      sentenceAnalysis: [],
      correctedSpeech: userSpokenText,
      strengths: [],
      positiveObservations: [],
      areasToImprove: ['Grammar checking is currently unavailable. Please try submitting again.'],
      mentorAdvice: ['Verify your internet connection to reach the LanguageTool API.']
    };
  }

  // Step 2: Filter formatting issues, process LanguageTool matches & calculate Grammar Score
  const normalizedMistakes = getConsolidatedSpokenMistakes(userSpokenText, ltResult.matches);
  const grammarScore = calculateGrammarScore(wordCount, normalizedMistakes);
  const correctedSpeech = buildCorrectedSpeech(userSpokenText, normalizedMistakes);
  const sentenceAnalysis = buildSentenceAnalysis(userSpokenText, normalizedMistakes);

  const wordMistakes = normalizedMistakes
    .filter(m => m.youSaid && m.correction && !m.youSaid.includes(' '))
    .map(m => ({
      word: m.youSaid,
      original: m.youSaid,
      correction: m.correction,
      category: m.category,
      explanation: m.explanation,
      severity: m.severity
    }));

  // Step 3: Run Deterministic Local Content & Topic Analysis
  console.log('[EVALUATOR] Running deterministic local content analyzer...');
  const contentResult = evaluateContentLocally({
    transcript: userSpokenText,
    topic: topic || activityName,
    durationSeconds
  });

  const {
    topicRelevance: relevanceScore,
    contentDepth: depthScore,
    topicCoverage: coverageScore,
    vocabulary: vocabularyScore,
    structure: structureScore,
    fluency: fluencyScore
  } = contentResult.dimensions;

  // Step 4: Calculate Overall Score
  // Dimensions:
  // Grammar Accuracy: 20%
  // Topic Relevance: 20%
  // Content Depth: 20%
  // Topic Coverage: 15%
  // Vocabulary: 10%
  // Structure: 10%
  // Fluency: 5%
  let rawWeightedSum =
    (grammarScore    * 0.20) +
    (relevanceScore  * 0.20) +
    (depthScore      * 0.20) +
    (coverageScore   * 0.15) +
    (vocabularyScore * 0.10) +
    (structureScore  * 0.10) +
    (fluencyScore    * 0.05);

  // Evidence-based calibration & continuous sufficiency penalties:
  // 1. Off-topic penalty: If speech is largely irrelevant, overall score cannot be high
  if (relevanceScore < 25) {
    rawWeightedSum = Math.min(rawWeightedSum, 40);
  } else if (relevanceScore < 40) {
    rawWeightedSum = Math.min(rawWeightedSum, 50);
  }

  // 2. Short content penalty (continuous sufficiency):
  // Short responses cannot demonstrate depth, coverage, or substance
  if (wordCount < 8) {
    rawWeightedSum = Math.min(rawWeightedSum, 40);
  } else if (wordCount < 15) {
    rawWeightedSum = Math.min(rawWeightedSum, 50);
  } else if (wordCount < 25) {
    rawWeightedSum = Math.min(rawWeightedSum, 62);
  } else if (wordCount < 40) {
    rawWeightedSum = Math.min(rawWeightedSum, 74);
  }

  // 3. Strict 80+ and 90+ calibration:
  // To reach 80+, multiple dimensions must be strong (>= 75)
  const strongDimCount = [grammarScore, relevanceScore, depthScore, coverageScore, vocabularyScore, structureScore].filter(s => s >= 75).length;
  if (strongDimCount < 4 && rawWeightedSum > 79) {
    rawWeightedSum = 78;
  }
  // To reach 90+, response must be genuinely exceptional across all key dimensions
  if (rawWeightedSum >= 90) {
    const isExceptional = grammarScore >= 90 && relevanceScore >= 85 && depthScore >= 80 && coverageScore >= 80 && wordCount >= 65;
    if (!isExceptional) {
      rawWeightedSum = 88;
    }
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(rawWeightedSum)));

  // Strict performance level mapping
  const getStrictLevel = (s) => {
    if (s >= 90) return 'Exceptional';
    if (s >= 80) return 'Excellent';
    if (s >= 75) return 'Very Good';
    if (s >= 65) return 'Good';
    if (s >= 55) return 'Average';
    if (s >= 45) return 'Below Average';
    if (s >= 30) return 'Weak';
    return 'Very Poor';
  };
  const performanceLevel = getStrictLevel(finalScore);

  console.log(`[EVALUATOR] Calculated Final Score: ${finalScore}/100 (${performanceLevel})`);
  console.log(`  Grammar: ${grammarScore} | Relevance: ${relevanceScore} | Depth: ${depthScore} | Coverage: ${coverageScore} | Vocab: ${vocabularyScore} | Structure: ${structureScore} | Fluency: ${fluencyScore}`);

  // Build criteria array matching the 7 dimensions
  const calcWeighted = (score, weight) => Math.round((score / 100) * weight * 10) / 10;
  const calcRating = (score) => Math.max(0, Math.min(5, Math.round((score / 100) * 5)));

  const criteria = [
    {
      key: 'grammar',
      label: 'Grammar Accuracy',
      weight: 20,
      rating: calcRating(grammarScore),
      weightedScore: calcWeighted(grammarScore, 20),
      maxWeightedScore: 20,
      evidence: normalizedMistakes.length === 0
        ? `No grammar or spelling errors detected across ${wordCount} spoken words.`
        : `LanguageTool detected ${normalizedMistakes.length} error(s) across ${wordCount} words (Score: ${grammarScore}/100).`,
      improvement: normalizedMistakes.length > 0
        ? 'Review the identified grammar and spelling corrections below.'
        : 'Maintain strong grammatical control across longer spoken answers.'
    },
    {
      key: 'topicRelevance',
      label: 'Topic Relevance',
      weight: 20,
      rating: calcRating(relevanceScore),
      weightedScore: calcWeighted(relevanceScore, 20),
      maxWeightedScore: 20,
      evidence: contentResult.details?.relevance?.keywordHits?.length > 0
        ? `Speech mentions topic keywords (${contentResult.details.relevance.keywordHits.slice(0, 3).join(', ')}) across ${Math.round((contentResult.details.relevance.sentenceRatio || 0) * 100)}% of sentences.`
        : `Limited keyword overlap with topic "${topic || activityName}".`,
      improvement: relevanceScore >= 75
        ? 'Strong topic alignment and focus.'
        : `Anchor your speech directly around the core topic "${topic || activityName}".`
    },
    {
      key: 'contentDepth',
      label: 'Content Depth',
      weight: 20,
      rating: calcRating(depthScore),
      weightedScore: calcWeighted(depthScore, 20),
      maxWeightedScore: 20,
      evidence: `Detected ${contentResult.details?.depth?.causalCount || 0} causal explanation(s) and ${contentResult.details?.depth?.examplesCount || 0} concrete example(s).`,
      improvement: depthScore >= 75
        ? 'Good depth of explanation with supporting reasoning.'
        : 'Include more causal explanations ("because", "as a result") and concrete examples.'
    },
    {
      key: 'topicCoverage',
      label: 'Topic Coverage',
      weight: 15,
      rating: calcRating(coverageScore),
      weightedScore: calcWeighted(coverageScore, 15),
      maxWeightedScore: 15,
      evidence: `Covered ${contentResult.details?.coverage?.perspectivesCovered || 0} perspective(s) (benefits, challenges, solutions) across ${wordCount} words.`,
      improvement: coverageScore >= 75
        ? 'Broad coverage touching upon multiple facets.'
        : 'Broaden your answer by addressing both advantages and challenges or proposing solutions.'
    },
    {
      key: 'vocabulary',
      label: 'Vocabulary & Word Choice',
      weight: 10,
      rating: calcRating(vocabularyScore),
      weightedScore: calcWeighted(vocabularyScore, 10),
      maxWeightedScore: 10,
      evidence: `Type-token ratio: ${Math.round((contentResult.details?.vocabulary?.ttr || 0) * 100)}% (${contentResult.details?.vocabulary?.uniqueCount || 0} unique words out of ${wordCount}).`,
      improvement: vocabularyScore >= 75
        ? 'Good vocabulary diversity.'
        : 'Use a wider variety of descriptive words and avoid repetitive basic wording.'
    },
    {
      key: 'structure',
      label: 'Structure & Flow',
      weight: 10,
      rating: calcRating(structureScore),
      weightedScore: calcWeighted(structureScore, 10),
      maxWeightedScore: 10,
      evidence: `${contentResult.details?.structure?.sentenceCount || 0} sentence(s) with ${contentResult.details?.structure?.transitionsCount || 0} connector(s).${contentResult.details?.structure?.hasConclusion ? ' Conclusion included.' : ''}`,
      improvement: structureScore >= 75
        ? 'Clear organization and progression.'
        : 'Structure your speech with an opening, body transitions ("moreover", "however"), and a closing.'
    },
    {
      key: 'fluency',
      label: 'Fluency & Delivery',
      weight: 5,
      rating: calcRating(fluencyScore),
      weightedScore: calcWeighted(fluencyScore, 5),
      maxWeightedScore: 5,
      evidence: `Filler word rate: ${Math.round((contentResult.details?.fluency?.fillerRate || 0) * 100)}% (${contentResult.details?.fluency?.fillerCount || 0} fillers).${contentResult.details?.fluency?.wpm ? ` Pace: ${contentResult.details.fluency.wpm} WPM.` : ''}`,
      improvement: (contentResult.details?.fluency?.fillerCount || 0) > 0
        ? `Replace filler words ("${contentResult.details.fluency.detectedFillers.slice(0, 3).join('", "')}") with brief pauses.`
        : 'Maintain steady pacing and continuous speech delivery.'
    }
  ];

  // Strengths
  const strengths = [];
  if (grammarScore >= 80) strengths.push('Strong grammatical accuracy with minimal language errors.');
  if (relevanceScore >= 75) strengths.push(`Maintained relevance to topic "${topic || activityName}".`);
  if (depthScore >= 75) strengths.push('Supported ideas with causal reasoning and examples.');
  if (vocabularyScore >= 75) strengths.push('Good vocabulary range and lexical diversity.');
  if (structureScore >= 75) strengths.push('Well-structured speech with clear transitions.');

  // Areas to improve
  const areasToImprove = [];
  if (normalizedMistakes.length > 0) areasToImprove.push(`Review ${normalizedMistakes.length} detected grammar/spelling error(s) below.`);
  if (depthScore < 65) areasToImprove.push('Provide deeper explanations using "because" and concrete examples.');
  if (coverageScore < 60) areasToImprove.push('Cover multiple perspectives such as benefits, drawbacks, and practical solutions.');
  if (structureScore < 65) areasToImprove.push('Improve structure with connecting transitions and a conclusion.');
  if (contentResult.details?.fluency?.fillerCount > 2) areasToImprove.push(`Reduce filler word usage (${contentResult.details.fluency.fillerCount} detected).`);

  // Positive observations
  const positiveObservations = [];
  if (normalizedMistakes.length === 0 && wordCount >= 30) {
    positiveObservations.push('Demonstrated good grammatical control across sustained speech.');
  }
  if (contentResult.details?.fluency?.fillerCount === 0 && wordCount >= 25) {
    positiveObservations.push('Spoke fluently without reliance on filler words.');
  }

  // Mentor advice
  const mentorAdvice = [];
  if (normalizedMistakes.length > 0) {
    mentorAdvice.push('Review the LanguageTool grammar suggestions below to refine sentence structure.');
  } else {
    mentorAdvice.push('Excellent grammar accuracy! Now focus on adding more illustrative examples.');
  }
  if (depthScore < 65) {
    mentorAdvice.push('Elaborate on why your points matter by linking cause and effect.');
  } else {
    mentorAdvice.push('Continue practicing 60–90 second speeches to build effortless fluency.');
  }

  // Mistake analysis & breakdowns
  const mistakeAnalysisData = {
    status: 'success',
    issueCount: normalizedMistakes.length,
    issues: normalizedMistakes,
    mistakes: normalizedMistakes,
    errorMessage: null
  };

  const errorSummary = {
    major: normalizedMistakes.filter(m => m.severity === 'major').length,
    moderate: normalizedMistakes.filter(m => m.severity === 'moderate').length,
    minor: normalizedMistakes.filter(m => m.severity === 'minor').length
  };

  const categoryBreakdown = {
    grammarErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('grammar')).length,
    wordUsageErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('word') || (m.category || '').toLowerCase().includes('confused')).length,
    articleErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('article')).length,
    tenseErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('tense')).length,
    svAgreementErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('agreement')).length,
    prepositionErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('preposition')).length,
    sentenceStructureErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('structure') || (m.category || '').toLowerCase().includes('style')).length,
    typoErrors: normalizedMistakes.filter(m => (m.category || '').toLowerCase().includes('typo') || m.issueType === 'misspelling').length
  };

  return {
    criteria,
    finalScore,
    performanceLevel,
    aiAnalysisAvailable: true,
    aiAnalysisCompleted: true,
    hasSpeech: true,
    speechDetected: true,
    isEmptySpeech: false,
    confidence: wordCount >= 60 ? 0.92 : wordCount >= 30 ? 0.82 : 0.65,
    summary: `Evaluation analyzed ${wordCount} spoken words on "${topic || activityName}". Detected ${normalizedMistakes.length} language issue(s).`,
    strengths,
    areasToImprove,
    positiveObservations,
    mentorAdvice,
    mistakeAnalysis: mistakeAnalysisData,
    mistakes: normalizedMistakes,
    wordMistakes,
    wordAnalysis: wordMistakes,
    sentenceAnalysis,
    correctedSpeech: correctedSpeech || userSpokenText,
    errorSummary,
    categoryBreakdown,
    pronunciationAnalysis: 'Pronunciation is evaluated separately via acoustic audio analysis when available.',
    fluencyDelivery: `Fluency evaluated from ${wordCount} words (${contentResult.details?.fluency?.fillerCount || 0} fillers).`,
    topicRelevance: relevanceScore >= 70 ? 'Speech aligns closely with topic keywords and concepts.' : 'Limited alignment with the given topic.',
    aiFeedback: `Evaluation complete. Overall score: ${finalScore}/100 (${performanceLevel}). Grammar Accuracy: ${grammarScore}/100, Relevance: ${relevanceScore}/100, Depth: ${depthScore}/100.`
  };
};



function extractAllRawMistakes(parsed) {
  const list = [];
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.mistakeAnalysis)) {
      list.push(...parsed.mistakeAnalysis);
    }
    if (Array.isArray(parsed.sentenceAnalysis)) {
      parsed.sentenceAnalysis.forEach(sa => {
        if (sa && Array.isArray(sa.errors)) {
          sa.errors.forEach(err => {
            if (err && (err.youSaid || sa.original)) {
              list.push({
                category: err.category || 'Grammar',
                errorType: err.errorType || err.category || 'Grammar Error',
                youSaid: err.youSaid || sa.original,
                original: sa.original || err.youSaid,
                problem: err.explanation || err.problem || 'Grammar or sentence structure issue.',
                correction: err.correction || '',
                explanation: err.explanation || '',
                severity: err.severity || 'moderate',
                isStyleOnly: false,
                isTranscriptionArtifact: !!err.isTranscriptionArtifact
              });
            }
          });
        }
      });
    }
    if (Array.isArray(parsed.wordMistakes)) {
      parsed.wordMistakes.forEach(wm => {
        if (wm && wm.spokenWord) {
          list.push({
            category: 'Word Usage',
            errorType: 'Word Choice Issue',
            youSaid: wm.spokenWord,
            original: wm.spokenWord,
            problem: wm.problem || 'Incorrect or unnatural word usage.',
            correction: wm.betterWord || '',
            explanation: wm.explanation || '',
            severity: wm.severity || 'moderate'
          });
        }
      });
    }
  } else if (Array.isArray(parsed)) {
    list.push(...parsed);
  }
  return list;
}

function filterValidMistakes(parsedInput, userTranscript) {
  const textLower = userTranscript.toLowerCase();
  const textNorm = textLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const textTokens = new Set(textNorm.split(/\s+/).filter(w => w.length > 1));
  const rawList = extractAllRawMistakes(parsedInput);
  const validFromAI = [];
  const removedFromAI = [];

  rawList.forEach(m => {
    if (!m || typeof m !== 'object') return;
    const phrase = (m.youSaid || m.original || '').trim();
    if (!phrase || phrase.length < 1) {
      removedFromAI.push({ item: m, reason: 'Empty phrase' });
      return;
    }

    const phraseLower = phrase.toLowerCase();
    const phraseNorm = phraseLower.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    const phraseTokens = phraseNorm.split(/\s+/).filter(w => w.length > 1);

    // 1. Direct or normalized substring match
    const isDirectMatch = textLower.includes(phraseLower) || textNorm.includes(phraseNorm);

    // 2. Token overlap: if any token from the mistake is in the transcript
    const meaningfulTokens = phraseTokens.filter(w => w.length > 2);
    const matchedTokens = meaningfulTokens.filter(t => textTokens.has(t));
    const isTokenMatch = meaningfulTokens.length === 0
      ? phraseTokens.some(t => textTokens.has(t))
      : (matchedTokens.length >= 1 || (matchedTokens.length / meaningfulTokens.length) >= 0.33);

    // 3. Check if sentence context exists
    const origSent = (m.original || '').toLowerCase().replace(/[^\w\s]/g, '');
    const isOrigSentMatch = origSent && origSent.split(/\s+/).filter(w => w.length > 2).some(t => textTokens.has(t));

    if (isDirectMatch || isTokenMatch || isOrigSentMatch || phraseTokens.length === 0) {
      validFromAI.push({
        category: m.category || 'Grammar',
        errorType: m.errorType || m.category || 'Grammar Error',
        youSaid: m.youSaid || m.original || phrase,
        original: m.original || m.youSaid || phrase,
        problem: m.problem || m.explanation || 'Grammar or word usage issue.',
        correction: m.correction || m.betterAlternative || '',
        betterAlternative: m.betterAlternative || m.correction || '',
        explanation: m.explanation || m.problem || 'Incorrect grammar or word usage.',
        severity: m.severity || 'moderate',
        isStyleOnly: !!m.isStyleOnly,
        isTranscriptionArtifact: !!m.isTranscriptionArtifact
      });
    } else {
      removedFromAI.push({ item: m, reason: 'No matching tokens in transcript' });
    }
  });

  const heuristicMistakes = scanTranscriptHeuristics(userTranscript);
  const combined = [...validFromAI];

  heuristicMistakes.forEach(hm => {
    const isDup = combined.some(m =>
      (m.youSaid || '').toLowerCase().includes((hm.youSaid || '').toLowerCase()) ||
      (hm.youSaid || '').toLowerCase().includes((m.youSaid || '').toLowerCase())
    );
    if (!isDup) combined.push(hm);
  });

  return { validMistakes: combined, removedMistakes: removedFromAI };
}

function filterValidSentenceAnalysis(sentenceAnalysis, userTranscript) {
  if (!Array.isArray(sentenceAnalysis)) return [];
  const textNorm = userTranscript.toLowerCase().replace(/[^\w\s]/g, '');

  return sentenceAnalysis
    .filter(s => s && typeof s === 'object' && s.original && s.original.trim().length > 0)
    .map(s => {
      const fragment = (s.original || '').toLowerCase().replace(/[^\w\s]/g, '').trim().substring(0, 20);
      if (fragment && !textNorm.includes(fragment)) return null;
      return {
        sentenceIndex: s.sentenceIndex || 1,
        original: s.original || '',
        isCorrect: !!s.isCorrect,
        errors: Array.isArray(s.errors) ? s.errors.filter(e => e && e.youSaid && e.correction) : [],
        correctedSentence: s.correctedSentence || s.original || '',
        improvementTip: s.improvementTip || ''
      };
    })
    .filter(Boolean);
}