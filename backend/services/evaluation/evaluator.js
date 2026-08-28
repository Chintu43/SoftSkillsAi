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

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRubric } from './rubrics.js';
import { calculateScore, buildZeroResult, buildInsufficientSpeechResult } from './scoreCalculator.js';

const getGenAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.warn('⚠️ Gemini API init warning:', err.message);
    return null;
  }
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

  // ── "I goes / we goes / they goes / you goes" (first/second/third-plural pronoun + -s verb) ─
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

  // ── "don't likes / doesn't likes / didn't likes" (auxiliary + conjugated -s verb) ──
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

  // ── "buyed / teached / goed / eated" (irregular past tense errors) ─────────
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

  // ── "two brother / three friend" (number + singular countable noun) ─────────
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

  // ── "communicate each other / meet each other" (missing preposition "with") ──
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

  // ── "this apps / this students / this peoples" (this + plural noun) ─────────
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

  // ── "peoples" used as count plural (should be "people") ──────────────────────
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

  // ── "there important / there problem / there solution" (there used as article) ─
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

  // ── "extract knowledge / extract information" (wrong colocation: should be "gain") ─
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

  // ── "Falls informations / Falls information" (ASR artifact for "false information") ─
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

  // ── "tips students / tips to students" (ASR artifact: "it helps students") ──
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

  // ── "criterions" (non-standard plural; should be "criteria") ──────────────
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

  // ── "communicate people / help students communicate people" (missing "with") ─
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

  // ── "it ends / it end students" (ASR for "it expands" / "it helps") ─────────
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

  // ── "WrestleMania / Ren media / Linking" (obvious ASR glitches) ─────────────
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

  // ── "than you skills / thank you skills" (ASR glitch for "learn new skills") ──
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

  // ── "daily life communicate" (missing connector "to") ────────────────────
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

  // ── "platform like YouTube" (should be plural "platforms like") ──────────
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

  // ── "sometime mental health" (missing verb / word form) ───────────────────
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

  // ── "media answer disadvantages" (ASR glitch for "media also has disadvantages") ─
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

  // ── "Social media are / is" — mass nouns treated as singular ─────────────
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

  // ── Modal + conjugated verb (extends COMMON_MODAL_MISUSE with "uses", "reduces", etc.) ──
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
        ? verb.slice(0, -2)  // e.g. "uses" → "use", "reduces" → "reduc" — handle below
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

  // ── Gerund/noun subject + unconjugated verb (spending reduce, time reduce, etc.) ──
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

  // ── "he don't / she don't / it don't" ─────────────────────────────────────
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

  // ── "I doesn't / we doesn't / they doesn't / you doesn't" ──────────────────
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

  // ── "did + past tense verb" (did went, did came, did saw, didn't went) ───
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

  // ── "a + vowel" article error (a important, a apple, a idea, a opportunity, a industry) ─
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

  // ── "an + consonant" article error (an university, an unique, an European) ─
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

  // ── "one of my friend / one of the student" (missing plural after 'one of') ─
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

  // ── Uncountable nouns with plural -s (informations, advices, furnitures, equipments, feedbacks) ─
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

  // ── "more better / more easier / most best" (double comparatives/superlatives) ─
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

  // ── "listen music / listen podcast" (missing preposition 'to') ────────────
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

  // ── "good in" (e.g. good in English / good in communication) ───────────────
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

  // ── "revert back / return back / repeat again" (redundant adverbs) ─────────
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

  // ── "I has / we has / they has / you has" ─────────────────────────────────
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

  // ── "he have / she have / it have" ─────────────────────────────────────────
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

export const evaluateTranscript = async ({ transcript, activityName, topic, activityType }) => {
  const cleanTranscript = (transcript || '').trim();
  const rubric = getRubric(activityName);
  const userSpokenText = extractUserSpokenContent(cleanTranscript);
  const genAI = getGenAI();

  console.log('\n=======================================================');
  console.log('--- [AI EVALUATOR PIPELINE START] ---');
  console.log('Activity:', activityName);
  console.log('Topic:', topic || 'N/A');
  console.log('Transcript Length (chars):', userSpokenText.length);
  console.log('Transcript Snippet:', userSpokenText.length > 0 ? ('"' + userSpokenText.substring(0, 120) + '..."') : '[EMPTY]');
  console.log('Gemini API Key Active:', !!genAI);
  console.log('=======================================================\n');

  const EMPTY_FIELDS = {
    wordMistakes: [], wordAnalysis: [], sentenceAnalysis: [], correctedSpeech: '',
    errorSummary: { major: 0, moderate: 0, minor: 0 },
    categoryBreakdown: { grammarErrors: 0, wordUsageErrors: 0, articleErrors: 0, tenseErrors: 0, svAgreementErrors: 0, prepositionErrors: 0, sentenceStructureErrors: 0 }
  };

  if (!userSpokenText || userSpokenText.length === 0) {
    console.log('[EVALUATOR RESULT] Tier 0: Empty speech -> Score 0');
    return {
      ...buildZeroResult(rubric, true),
      hasSpeech: false,
      speechDetected: false,
      aiAnalysisCompleted: true,
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

  const normalizedText = userSpokenText.toLowerCase().replace(/[^\w\s']/g, '');
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const isOnlyGenericWords = wordCount > 0 && words.every(w => GENERIC_GREETINGS.has(w));
  if (wordCount <= 3 || isOnlyGenericWords) {
    console.log('[EVALUATOR RESULT] Tier 1: Insufficient speech ("' + userSpokenText + '") -> Score 0');
    return {
      ...buildInsufficientSpeechResult(rubric, 'No meaningful speech detected. Please speak for a longer duration.'),
      hasSpeech: false,
      speechDetected: false,
      aiAnalysisCompleted: true,
      confidence: 0.1,
      summary: 'Insufficient speech detected ("' + userSpokenText + '").',
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

  const hasTopicKeywords = checkTopicRelevanceInText(topic, userSpokenText);

  if (genAI) {
    try {
      console.log('[1] TRANSCRIPT:', userSpokenText);
      console.log('[EVALUATOR] Calling Gemini API for deep linguistic evaluation...');
      console.log('[PERF] Gemini started');
      const geminiStart = Date.now();
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = buildEvaluationPrompt(rubric, userSpokenText, activityName, topic, wordCount);
      const response = await model.generateContent(prompt);
      const rawText = response.response.text();
      console.log(`[PERF] Gemini completed: ${Date.now() - geminiStart} ms`);

      const parseStart = Date.now();
      let raw = rawText.replace(/^```json/gi, '').replace(/^```/gi, '').replace(/```$/gi, '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) raw = jsonMatch[0];

      const parsed = JSON.parse(raw);
      console.log(`[PERF] Gemini parsing: ${Date.now() - parseStart} ms`);

      if (parsed) {
        console.log('[EVALUATOR] Gemini response successfully parsed!');

        // GEMINI IS THE ONLY AUTHORITY — NO filterValidMistakes(), NO regex/heuristic filtering
        const rawGeminiMistakes = Array.isArray(parsed.mistakes) && parsed.mistakes.length > 0
          ? parsed.mistakes
          : (Array.isArray(parsed.mistakeAnalysis) ? parsed.mistakeAnalysis : []);

        const validMistakes = rawGeminiMistakes.map(m => ({
          category: m.category || 'Grammar',
          errorType: m.errorType || m.category || 'Grammar Error',
          youSaid: m.youSaid || m.original || '',
          original: m.original || m.youSaid || '',
          problem: m.problem || m.explanation || 'Grammar or word usage issue.',
          correction: m.correction || m.betterAlternative || '',
          betterAlternative: m.betterAlternative || m.correction || '',
          explanation: m.explanation || m.problem || 'Grammar rule explanation.',
          severity: m.severity || 'moderate',
          isStyleOnly: !!m.isStyleOnly,
          isTranscriptionArtifact: !!m.isTranscriptionArtifact
        }));

        console.log('[2] GEMINI MISTAKES:', rawGeminiMistakes);
        console.log('[3] DIRECT GEMINI MISTAKES:', validMistakes);

        const totalErrorCount = validMistakes.length;
        const hardGrammarErrorCount = validMistakes.filter(m => m.severity === 'major' || m.severity === 'moderate').length;

        const validatedRatings = {};
        rubric.criteria.forEach(c => {
          let r = Math.min(5, Math.max(0, Math.round(Number(parsed.ratings?.[c.key] || 0))));
          r = Math.min(r, getMaxRatingForWordCount(wordCount, c.key));

          if ((c.key.toLowerCase().includes('relevance') || c.key.toLowerCase().includes('topic')) && !hasTopicKeywords) {
            r = Math.min(r, 1);
          }

          if (c.key.toLowerCase().includes('grammar') || c.key.toLowerCase().includes('accuracy') || c.key.toLowerCase().includes('fluency') || c.key.toLowerCase().includes('clarity')) {
            if (totalErrorCount >= 7) r = Math.min(r, 1);
            else if (totalErrorCount >= 4) r = Math.min(r, 2);
            else if (totalErrorCount >= 2) r = Math.min(r, 3);
            else if (totalErrorCount >= 1) r = Math.min(r, 3);
          }

          validatedRatings[c.key] = r;
        });

        const result = calculateScore(rubric, validatedRatings, parsed.evidence || {}, parsed.improvement || {});
        console.log("[FINAL SCORE]:", result.finalScore);
        const validSentenceAnalysis = Array.isArray(parsed.sentenceAnalysis) ? parsed.sentenceAnalysis : [];
        const wordMistakes = Array.isArray(parsed.wordMistakes) && parsed.wordMistakes.length > 0
          ? parsed.wordMistakes.map(wm => ({ ...wm, severity: wm.severity || 'moderate' }))
          : buildWordMistakesFromList(validMistakes);

        let positiveObservations = [];
        if (totalErrorCount === 0 && wordCount >= 35 && hasTopicKeywords) {
          if (Array.isArray(parsed.positiveObservations) && parsed.positiveObservations.length > 0) {
            positiveObservations = parsed.positiveObservations.slice(0, 3);
          }
        }

        let validStrengths = [];
        if (wordCount >= 35 && result.finalScore >= 45 && totalErrorCount <= 1 && Array.isArray(parsed.strengths)) {
          validStrengths = parsed.strengths.filter(s => s && s.length > 5).slice(0, 3);
        }

        const errorSummary = parsed.errorSummary || {
          major: validMistakes.filter(m => m.severity === 'major').length,
          moderate: validMistakes.filter(m => m.severity === 'moderate').length,
          minor: validMistakes.filter(m => m.severity === 'minor').length
        };

        const categoryBreakdown = parsed.categoryBreakdown || {
          grammarErrors: validMistakes.filter(m => m.category === 'Grammar').length,
          wordUsageErrors: validMistakes.filter(m => m.category === 'Word Usage').length,
          articleErrors: validMistakes.filter(m => m.category === 'Articles').length,
          tenseErrors: validMistakes.filter(m => m.category === 'Tense').length,
          svAgreementErrors: validMistakes.filter(m => m.category === 'Subject-Verb Agreement').length,
          prepositionErrors: validMistakes.filter(m => m.category === 'Prepositions').length,
          sentenceStructureErrors: validMistakes.filter(m => m.category === 'Sentence Structure').length
        };

        const formattedIssues = validMistakes.map(m => ({
          youSaid: m.youSaid || m.original || '',
          original: m.original || m.youSaid || '',
          problem: m.problem || m.explanation || 'Grammar or word usage issue.',
          correction: m.correction || m.betterAlternative || '',
          betterAlternative: m.betterAlternative || m.correction || '',
          explanation: m.explanation || m.problem || '',
          category: m.category || 'Grammar',
          errorType: m.errorType || m.category || 'Grammar Error',
          improvement: m.improvement || m.improvementTip || ('Check ' + (m.errorType || m.category).toLowerCase() + ' in future speech.'),
          severity: m.severity || 'moderate',
          isStyleOnly: !!m.isStyleOnly,
          isTranscriptionArtifact: !!m.isTranscriptionArtifact
        }));

        const mistakeAnalysisData = {
          status: 'success',
          issueCount: formattedIssues.length,
          issues: formattedIssues,
          errorMessage: null
        };

        console.log('[4] FINAL MISTAKE COUNT:', formattedIssues.length);
        console.log('[5] FINAL RESPONSE:', mistakeAnalysisData);
        console.log('[EVALUATOR SUCCESS] Final Score: ' + result.finalScore + ' | Errors Detected: ' + totalErrorCount);

        return {
          ...result,
          aiAnalysisAvailable: true,
          analysisError: null,
          hasSpeech: true,
          speechDetected: true,
          aiAnalysisCompleted: true,
          confidence: wordCount >= 100 ? 0.95 : wordCount >= 50 ? 0.85 : 0.7,
          summary: parsed.summary || ('Speech of ' + wordCount + ' words on "' + (topic || activityName) + '".'),
          strengths: validStrengths,
          areasToImprove: Array.isArray(parsed.areasToImprove) ? parsed.areasToImprove.slice(0, 4) : [],
          positiveObservations,
          mistakeAnalysis: mistakeAnalysisData,
          mistakes: formattedIssues,
          wordMistakes,
          wordAnalysis: wordMistakes,
          sentenceAnalysis: validSentenceAnalysis,
          correctedSpeech: typeof parsed.correctedSpeech === 'string' ? parsed.correctedSpeech.trim() : userSpokenText,
          errorSummary,
          categoryBreakdown,
          pronunciationAnalysis: parsed.pronunciationAnalysis || 'Pronunciation could not be reliably evaluated from transcript text alone.',
          fluencyDelivery: parsed.fluencyDelivery || 'Speech continuity assessed from transcript.',
          topicRelevance: parsed.topicRelevance || (hasTopicKeywords ? 'Topic keywords present in speech.' : 'Limited alignment with the given topic.'),
          mentorAdvice: Array.isArray(parsed.mentorAdvice) && parsed.mentorAdvice.length > 0
            ? parsed.mentorAdvice.slice(0, 4)
            : ['Practice speaking for longer durations on a single topic.', 'Review the grammar errors detected below.'],
          aiFeedback: typeof parsed.aiFeedback === 'string' ? parsed.aiFeedback : ''
        };
      }
    } catch (err) {
      console.warn('⚠️ Gemini evaluation error:', err.message);
      return {
        aiAnalysisAvailable: false,
        analysisError: 'AI evaluation unavailable. Please try again.',
        finalScore: 0,
        performanceLevel: 'Poor',
        hasSpeech: true,
        speechDetected: true,
        aiAnalysisCompleted: false,
        summary: 'AI evaluation unavailable. Please try again.',
        mistakeAnalysis: {
          status: 'error',
          issueCount: 0,
          issues: [],
          errorMessage: 'AI evaluation unavailable. Please try again.'
        },
        mistakes: [],
        wordMistakes: [],
        sentenceAnalysis: [],
        correctedSpeech: userSpokenText,
        strengths: [],
        positiveObservations: [],
        areasToImprove: ['AI evaluation is currently unavailable. Please try again later.'],
        mentorAdvice: ['Ensure your API key is configured and check your connection before retrying.']
      };
    }
  }

  console.warn('⚠️ Gemini API Key not configured');
  return {
    aiAnalysisAvailable: false,
    analysisError: 'AI evaluation unavailable. Please try again.',
    finalScore: 0,
    performanceLevel: 'Poor',
    hasSpeech: true,
    speechDetected: true,
    aiAnalysisCompleted: false,
    summary: 'AI evaluation unavailable. Please try again.',
    mistakeAnalysis: {
      status: 'error',
      issueCount: 0,
      issues: [],
      errorMessage: 'AI evaluation unavailable. Please try again.'
    },
    mistakes: [],
    wordMistakes: [],
    sentenceAnalysis: [],
    correctedSpeech: userSpokenText,
    strengths: [],
    positiveObservations: [],
    areasToImprove: ['AI evaluation is currently unavailable. Please try again later.'],
    mentorAdvice: ['Ensure your API key is configured and check your connection before retrying.']
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