/**
 * contentAnalyzer.js — Deterministic Local Linguistic & Content Analyzer
 *
 * Evaluates speech transcripts along multiple measurable linguistic dimensions:
 * 1. Topic Relevance (20%)
 * 2. Content Depth (20%)
 * 3. Topic Coverage (15%)
 * 4. Vocabulary Diversity & Quality (10%)
 * 5. Structural Progression & Cohesion (10%)
 * 6. Fluency & Delivery Indicators (5%)
 *
 * Fully deterministic: NO external LLMs, NO Gemini, NO OpenRouter.
 */

// ── 1. FILLER WORDS & PHRASES ───────────────────────────────────────────────
export const FILLER_WORDS = new Set([
  'um', 'uh', 'erm', 'hmm', 'ah', 'like', 'actually', 'basically', 'honestly',
  'literally', 'seriously', 'you know', 'i mean', 'sort of', 'kind of', 'right'
]);

// ── 2. STOP WORDS FOR TOPIC EXTRACTION ──────────────────────────────────────
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down',
  'of', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'should', 'now', 'its', 'their', 'this', 'that'
]);

// ── 3. TOPIC CONCEPT DICTIONARIES FOR POPULAR TOPICS ────────────────────────
const TOPIC_CONCEPT_DICTIONARIES = {
  'social media': [
    'communication', 'education', 'learning', 'distraction', 'addiction', 'mental health',
    'privacy', 'cyberbullying', 'productivity', 'opportunities', 'disadvantages', 'advantages',
    'habits', 'academic', 'awareness', 'balance', 'focus', 'connection', 'peers', 'information',
    'screen time', 'instagram', 'facebook', 'youtube', 'tiktok', 'online', 'platforms'
  ],
  'students': [
    'education', 'learning', 'school', 'college', 'university', 'academic', 'study', 'grades',
    'exams', 'classes', 'teachers', 'future', 'career', 'knowledge', 'youth', 'children'
  ],
  'artificial intelligence': [
    'automation', 'future', 'jobs', 'efficiency', 'algorithms', 'ethics', 'innovation',
    'skills', 'creativity', 'impact', 'workplace', 'tools', 'productivity', 'progress',
    'technology', 'computer', 'machine learning', 'data', 'smart', 'software'
  ],
  'climate change': [
    'pollution', 'renewable', 'energy', 'emissions', 'temperature', 'carbon', 'sustainability',
    'ecosystem', 'planet', 'conservation', 'ice caps', 'solutions', 'nature', 'green', 'waste',
    'global warming', 'environment', 'fossil fuels', 'atmosphere', 'wildlife', 'trees'
  ],
  'remote work': [
    'flexibility', 'communication', 'isolation', 'productivity', 'work-life', 'balance',
    'virtual', 'collaboration', 'discipline', 'home', 'office', 'digital', 'commute', 'meetings'
  ],
  'time management': [
    'priorities', 'schedule', 'deadlines', 'procrastination', 'goals', 'planning', 'focus',
    'efficiency', 'routine', 'distractions', 'tasks', 'productivity', 'balance', 'calendar'
  ],
  'teamwork': [
    'collaboration', 'support', 'trust', 'cooperation', 'goals', 'communication', 'respect',
    'unity', 'team', 'members', 'coordination', 'synergy', 'effort', 'together'
  ],
  'leadership': [
    'vision', 'guidance', 'decision', 'responsibility', 'inspiration', 'motivation',
    'empathy', 'leader', 'initiative', 'example', 'influence', 'strategy', 'integrity'
  ]
};

// ── 4. LINGUISTIC INDICATORS ────────────────────────────────────────────────
const EXAMPLE_INDICATORS = [
  'for example', 'for instance', 'such as', 'specifically', 'to illustrate',
  'case in point', 'in particular', 'in my experience', 'like when', 'an example of this'
];

const CAUSE_EFFECT_INDICATORS = [
  'because', 'due to', 'as a result', 'therefore', 'thus', 'consequently',
  'since', 'which means', 'leads to', 'in order to', 'causes', 'results in',
  'this leads to', 'the reason is', 'this is why'
];

const CONTRAST_ARGUMENT_INDICATORS = [
  'however', 'on the other hand', 'on the contrary', 'meanwhile', 'although',
  'even though', 'while', 'despite', 'in contrast', 'nevertheless', 'alternatively',
  'furthermore', 'moreover', 'in addition', 'besides', 'on one hand'
];

const CONCLUSION_INDICATORS = [
  'in conclusion', 'to summarize', 'to sum up', 'overall', 'ultimately',
  'finally', 'in the end', 'to wrap up', 'in summary', 'to conclude', 'all in all'
];

const PROS_INDICATORS = [
  'benefit', 'advantage', 'opportunity', 'useful', 'helpful', 'positive',
  'improve', 'growth', 'strength', 'asset', 'valuable', 'gain'
];

const CONS_INDICATORS = [
  'disadvantage', 'drawback', 'problem', 'risk', 'harm', 'distraction',
  'negative', 'challenge', 'addiction', 'danger', 'obstacle', 'loss', 'downside'
];

const SOLUTION_INDICATORS = [
  'should', 'must', 'need to', 'recommend', 'suggest', 'solution',
  'balance', 'mitigate', 'regulate', 'prevent', 'manage', 'strategy'
];

/**
 * Tokenize string into normalized words.
 */
export function tokenizeWords(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/[^\w\s']/g, ' ');
  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Split text into meaningful sentences.
 */
export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.?!])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Extract topic keywords and associated concepts.
 */
export function extractTopicConcepts(topic) {
  if (!topic || typeof topic !== 'string') return { keywords: [], conceptPool: [] };

  const cleanTopic = topic.toLowerCase().replace(/[^\w\s]/g, ' ');
  const rawWords = cleanTopic.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const keywords = [...new Set(rawWords)];

  const conceptPool = new Set(keywords);

  // Match against concept dictionaries
  for (const [key, dict] of Object.entries(TOPIC_CONCEPT_DICTIONARIES)) {
    if (cleanTopic.includes(key)) {
      dict.forEach(w => conceptPool.add(w));
    } else {
      // Check if topic keywords overlap with key words
      const keyWords = key.split(/\s+/);
      if (keyWords.some(kw => keywords.includes(kw))) {
        dict.forEach(w => conceptPool.add(w));
      }
    }
  }

  return {
    keywords,
    conceptPool: Array.from(conceptPool)
  };
}

/**
 * Analyze speech fluency & filler word rate.
 */
export function analyzeFluency(words = [], durationSeconds = 0) {
  if (words.length === 0) return { fillerCount: 0, fillerRate: 0, detectedFillers: [], wpm: 0, score: 0 };

  const detectedFillers = [];
  let fillerCount = 0;
  let repetitionsCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const pair = i < words.length - 1 ? `${word} ${words[i + 1]}` : '';

    if (FILLER_WORDS.has(pair)) {
      fillerCount++;
      detectedFillers.push(pair);
      i++;
    } else if (FILLER_WORDS.has(word)) {
      fillerCount++;
      detectedFillers.push(word);
    }

    if (i < words.length - 1 && word === words[i + 1] && word.length > 2) {
      repetitionsCount++;
    }
  }

  const fillerRate = words.length > 0 ? (fillerCount / words.length) : 0;
  const repetitionRate = words.length > 0 ? (repetitionsCount / words.length) : 0;

  const dur = parseInt(durationSeconds, 10) || 0;
  const wpm = dur > 0 ? Math.round((words.length / dur) * 60) : 0;

  // Fluency score (0–100)
  let score = 88;
  if (words.length < 8) {
    score = 40;
  } else if (words.length < 15) {
    score = 65;
  } else if (words.length < 30) {
    score = 75;
  }


  // Deductions for fillers & repetitions
  if (fillerRate > 0.10) score -= 30;
  else if (fillerRate > 0.05) score -= 18;
  else if (fillerRate > 0.02) score -= 8;

  if (repetitionRate > 0.05) score -= 15;
  else if (repetitionRate > 0.02) score -= 8;

  // Reward optimal WPM if duration was recorded
  if (wpm >= 110 && wpm <= 160) score += 6;
  else if (wpm > 0 && (wpm < 80 || wpm > 190)) score -= 10;

  score = Math.max(15, Math.min(95, score));
  return { fillerCount, fillerRate, repetitionRate, detectedFillers, wpm, score };
}

/**
 * Analyze vocabulary variety and depth.
 */
export function analyzeVocabulary(words = []) {
  if (words.length === 0) return { uniqueCount: 0, ttr: 0, score: 0 };

  const unique = new Set(words);
  const ttr = unique.size / words.length;

  // Advanced words (7+ characters, excluding common fillers/stopwords)
  const advancedWords = words.filter(w => w.length >= 7 && !STOP_WORDS.has(w) && !FILLER_WORDS.has(w));
  const advancedRate = words.length > 0 ? (advancedWords.length / words.length) : 0;

  // Continuous sufficiency curve for vocabulary
  let score = 50;
  if (words.length < 8) {
    score = Math.round(20 + (ttr * 15));
  } else if (words.length < 15) {
    score = Math.round(35 + (ttr * 20));
  } else if (words.length < 35) {
    score = Math.round(45 + (ttr * 30));
  } else {
    // Normal length speech
    score = Math.round(45 + (ttr * 35) + (advancedRate * 50));
  }

  score = Math.max(15, Math.min(92, score));
  return {
    uniqueCount: unique.size,
    totalCount: words.length,
    ttr: Math.round(ttr * 100) / 100,
    advancedCount: advancedWords.length,
    score
  };
}

/**
 * Analyze structural progression: opening, transitions, connectors, conclusion.
 */
export function analyzeStructure(transcript, sentences = []) {
  const sentenceCount = sentences.length;
  if (sentenceCount === 0) return { score: 0, hasOpening: false, hasConclusion: false, transitionsFound: [] };

  const lowerText = transcript.toLowerCase();
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const hasOpening = sentences[0] && (
    sentences[0].split(/\s+/).length >= 5 &&
    /today|talk about|discuss|topic|opinion|believe|consider|view/i.test(sentences[0])
  );

  const hasConclusion = CONCLUSION_INDICATORS.some(c => lowerText.includes(c));

  const transitionsFound = [];
  [...CONTRAST_ARGUMENT_INDICATORS, ...CAUSE_EFFECT_INDICATORS].forEach(ind => {
    if (lowerText.includes(ind) && !transitionsFound.includes(ind)) {
      transitionsFound.push(ind);
    }
  });

  // Structural score continuous calculation
  let score = 20;
  if (sentenceCount === 1) {
    score = wordCount < 8 ? 15 : 25;
  } else if (sentenceCount === 2) {
    score = 40;
  } else if (sentenceCount === 3) {
    score = 55;
  } else if (sentenceCount <= 5) {
    score = 68;
  } else {
    score = 78;
  }

  if (hasOpening) score += 6;
  if (hasConclusion) score += 8;
  score += Math.min(12, transitionsFound.length * 3);

  score = Math.max(15, Math.min(92, score));
  return {
    sentenceCount,
    hasOpening: !!hasOpening,
    hasConclusion,
    transitionsCount: transitionsFound.length,
    transitionsFound,
    score
  };
}

/**
 * Analyze Topic Relevance (20%).
 * Evaluates direct keyword presence, concept alignment, and sentence relevance density.
 */
export function analyzeTopicRelevance(transcript, sentences, topic) {
  if (!topic || !transcript) return { score: 50, relevantSentenceCount: 0, keywordHits: [] };

  const { keywords, conceptPool } = extractTopicConcepts(topic);
  const lowerText = transcript.toLowerCase();
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  // Find direct keyword matches
  const keywordHits = keywords.filter(kw => lowerText.includes(kw));

  // Find concept matches
  const conceptHits = conceptPool.filter(c => lowerText.includes(c));

  // Sentence-level relevance
  let relevantSentenceCount = 0;
  sentences.forEach(s => {
    const sLower = s.toLowerCase();
    const isRelevant = keywords.some(k => sLower.includes(k)) ||
      conceptPool.filter(c => sLower.includes(c)).length >= 2;
    if (isRelevant) relevantSentenceCount++;
  });

  const sentenceRatio = sentences.length > 0 ? (relevantSentenceCount / sentences.length) : 0;

  // Continuous relevance calculation
  let score = 15;
  if (keywords.length === 0) {
    score = 70; // generic topic
  } else {
    const keywordRatio = keywordHits.length / keywords.length;
    score = Math.round((keywordRatio * 45) + (sentenceRatio * 35) + Math.min(20, conceptHits.length * 3));
  }

  // Heavy penalty if completely off topic
  if (keywordHits.length === 0 && conceptHits.length <= 1) {
    score = Math.min(25, score);
  }

  // Short response cannot demonstrate full topical depth
  if (wordCount < 8) {
    score = Math.min(42, score);
  }

  score = Math.max(10, Math.min(95, score));
  return {
    score,
    keywordHits,
    conceptHits,
    relevantSentenceCount,
    sentenceRatio: Math.round(sentenceRatio * 100) / 100
  };
}

/**
 * Analyze Topic Coverage (15%).
 * Evaluates breadth across multiple perspectives (benefits, drawbacks, solutions, outcomes).
 */
export function analyzeTopicCoverage(transcript, wordCount, topic) {
  const lowerText = transcript.toLowerCase();
  const { conceptPool } = extractTopicConcepts(topic);

  // Measure distinct concept coverage
  const matchedConcepts = conceptPool.filter(c => lowerText.includes(c));

  // Multi-perspective markers
  const hasPros = PROS_INDICATORS.some(w => lowerText.includes(w));
  const hasCons = CONS_INDICATORS.some(w => lowerText.includes(w));
  const hasSolutions = SOLUTION_INDICATORS.some(w => lowerText.includes(w));

  const perspectivesCovered = [hasPros, hasCons, hasSolutions].filter(Boolean).length;

  // Continuous sufficiency curve for topic coverage
  let score = 20;
  if (wordCount < 8) {
    score = 15;
  } else if (wordCount < 15) {
    score = 25; // 13 words cannot cover a topic broadly
  } else if (wordCount < 30) {
    score = 35 + (perspectivesCovered * 8);
  } else if (wordCount < 60) {
    score = 48 + (perspectivesCovered * 10) + Math.min(15, matchedConcepts.length * 2);
  } else {
    score = 60 + (perspectivesCovered * 10) + Math.min(20, matchedConcepts.length * 2);
  }

  score = Math.max(15, Math.min(92, score));
  return {
    score,
    matchedConceptsCount: matchedConcepts.length,
    perspectivesCovered,
    hasPros,
    hasCons,
    hasSolutions
  };
}

/**
 * Analyze Content Depth (20%).
 * Evaluates supporting ideas, examples, causal explanations, and reasoning density.
 */
export function analyzeContentDepth(transcript, sentences, wordCount) {
  const lowerText = transcript.toLowerCase();

  // Examples detected
  const examplesDetected = EXAMPLE_INDICATORS.filter(ex => lowerText.includes(ex));

  // Causal/explanatory links detected
  const causalDetected = CAUSE_EFFECT_INDICATORS.filter(ce => lowerText.includes(ce));

  // Continuous sufficiency curve for content depth
  // A short 4-20 word response cannot demonstrate deep reasoning
  let baseScore = 20;
  if (wordCount < 8) {
    baseScore = 15;
  } else if (wordCount < 15) {
    baseScore = 22;
  } else if (wordCount < 30) {
    baseScore = 35;
  } else if (wordCount < 60) {
    baseScore = 52;
  } else if (wordCount < 100) {
    baseScore = 68;
  } else {
    baseScore = 78;
  }


  const exampleBonus = Math.min(12, examplesDetected.length * 6);
  const causalBonus = Math.min(12, causalDetected.length * 4);

  let score = Math.round(baseScore + exampleBonus + causalBonus);
  score = Math.max(15, Math.min(94, score));

  return {
    score,
    examplesCount: examplesDetected.length,
    examplesDetected,
    causalCount: causalDetected.length,
    causalDetected
  };
}

/**
 * Master Content Evaluation Function.
 * Returns the 6 content dimensions + comprehensive metadata.
 */
export function evaluateContentLocally({ transcript, topic, durationSeconds }) {
  const cleanText = (transcript || '').trim();
  const words = tokenizeWords(cleanText);
  const sentences = splitSentences(cleanText);
  const wordCount = words.length;

  const relevance = analyzeTopicRelevance(cleanText, sentences, topic);
  const coverage = analyzeTopicCoverage(cleanText, wordCount, topic);
  const depth = analyzeContentDepth(cleanText, sentences, wordCount);
  const vocabulary = analyzeVocabulary(words);
  const structure = analyzeStructure(cleanText, sentences);
  const fluency = analyzeFluency(words, durationSeconds);

  return {
    wordCount,
    sentenceCount: sentences.length,
    dimensions: {
      topicRelevance: relevance.score,
      topicCoverage: coverage.score,
      contentDepth: depth.score,
      vocabulary: vocabulary.score,
      structure: structure.score,
      fluency: fluency.score
    },
    details: {
      relevance,
      coverage,
      depth,
      vocabulary,
      structure,
      fluency
    }
  };
}
