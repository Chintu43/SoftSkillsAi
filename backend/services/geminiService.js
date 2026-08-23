import { GoogleGenerativeAI } from '@google/generative-ai';
import { evaluateTranscript } from './evaluation/evaluator.js';

const getGenAI = () => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.warn('⚠️ Gemini API initialization warning:', err.message);
    return null;
  }
};

/**
 * Validate custom user topic for JAM / Group Discussion / Debate
 */
export const validateCustomTopic = async (topic, activityName) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return {
      valid: false,
      topic: topic || '',
      message: 'Topic is too short. Please enter a meaningful topic (e.g., "AI is the future").'
    };
  }

  const cleanTopic = topic.trim();
  const words = cleanTopic.split(/\s+/);

  if (words.length === 1 && cleanTopic.length > 5) {
    const vowelCount = (cleanTopic.match(/[aeiou]/gi) || []).length;
    if (vowelCount === 0 || vowelCount / cleanTopic.length < 0.15) {
      return {
        valid: false,
        topic: cleanTopic,
        message: 'This topic is not suitable for a soft-skills session.'
      };
    }
  }

  if (words.length >= 2 && new Set(words.map(w => w.toLowerCase())).size === 1 && !['yes', 'no', 'go'].includes(words[0].toLowerCase())) {
    return {
      valid: false,
      topic: cleanTopic,
      message: 'Repetitive phrase detected. Please enter a proper topic.'
    };
  }

  const toxicKeywords = ['bitch', 'fuck', 'shit', 'idiot', 'asshole', 'kill', 'hate'];
  if (toxicKeywords.some(kw => cleanTopic.toLowerCase().includes(kw))) {
    return {
      valid: false,
      topic: cleanTopic,
      message: 'Topic contains inappropriate language. Please maintain professional standards.'
    };
  }

  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `
You are an AI topic validator for a Soft Skills & Communication Training Platform.
Evaluate if the user topic: "${cleanTopic}" is meaningful, appropriate, safe, and discussable for the activity "${activityName || 'General Practice'}".

Creative, imaginative, simple, or philosophical topics ARE VALID.
Only mark invalid if the input is random gibberish, vulgar/abusive, or complete spam.

Return strictly valid JSON format:
{
  "valid": boolean,
  "topic": "${cleanTopic}",
  "message": "This is a valid discussion topic."
}`;

      const response = await model.generateContent(prompt);
      const cleanJson = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        valid: parsed.valid !== undefined ? parsed.valid : true,
        topic: parsed.topic || cleanTopic,
        message: parsed.message || (parsed.valid ? 'This is a valid discussion topic.' : 'Topic is not suitable.')
      };
    } catch (e) {
      console.warn('Gemini topic validation API warning:', e.message);
    }
  }

  return {
    valid: true,
    topic: cleanTopic,
    message: 'This is a valid discussion topic.'
  };
};

/**
 * AI Transcript Performance Evaluator.
 * Delegates directly to the strict rubric-based evaluator.
 * No legacy hardcoded high-score fallback exists.
 */
export const analyzeTranscriptWithGemini = async ({ transcript, activityName, topic, activityType }) => {
  const result = await evaluateTranscript({ transcript, activityName, topic, activityType });

  // Map result into legacy format expected by any external callers
  const flatScores = {
    overall:        result.finalScore,
    communication:  findScore(result, 'communication', 'communicationClarity'),
    fluency:        findScore(result, 'fluency', 'individualFluency'),
    confidence:     findScore(result, 'confidence', 'speakingConfidence'),
    grammar:        findScore(result, 'grammar', 'grammarVocabulary'),
    vocabulary:     findScore(result, 'vocabulary', 'vocabularyVariety'),
    clarity:        findScore(result, 'clarity', 'communicationClarity'),
    topicRelevance: findScore(result, 'topicRelevance', 'relevance'),
    professionalism:findScore(result, 'professionalism'),
    leadership:     findScore(result, 'leadership', 'initiative')
  };

  return {
    isEmptySpeech:   result.isEmptySpeech,
    scores:          flatScores,
    criteria:        result.criteria,
    finalScore:      result.finalScore,
    performanceLevel:result.performanceLevel,
    strengths:       result.strengths,
    areasToImprove:  result.areasToImprove,
    positiveObservations: result.positiveObservations || [],
    mistakes:        result.mistakeAnalysis,
    mistakeAnalysis: result.mistakeAnalysis,
    aiFeedback:      result.aiFeedback
  };
};

function findScore(result, ...keys) {
  if (!result.criteria || !Array.isArray(result.criteria)) return result.finalScore || 0;
  for (const k of keys) {
    const c = result.criteria.find(x => x.key === k);
    if (c && c.weight > 0) {
      return Math.min(100, Math.round((c.weightedScore / c.weight) * 100));
    }
  }
  return result.finalScore || 0;
}

/**
 * Generate AI Debate Counterargument for Individual AI Voice Debate
 */
export const generateDebateCounterargumentService = async ({ topic, userArgument, conversationHistory, roundNumber }) => {
  const historyStr = Array.isArray(conversationHistory)
    ? conversationHistory.map(h => `${h.speaker === 'USER' ? 'Human Opponent' : 'AI Opponent'}: ${h.text}`).join('\n\n')
    : '';

  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `You are an opposing debater participating in a live verbal debate with a human opponent.

DEBATE TOPIC: "${topic || 'General Debate Topic'}"
CURRENT ROUND: ${roundNumber || 1} of 5

CONVERSATION HISTORY:
${historyStr}

HUMAN OPPONENT'S LATEST ARGUMENT:
"${userArgument || ''}"

DEBATER INSTRUCTIONS:
- You are NOT a friendly assistant or chatbot. You are the OPPOSING DEBATER.
- Analyze the user's argument carefully. Challenge weak points, unproven assumptions, or logical flaws.
- Provide ONE or TWO strong counter-arguments (around 40-75 words, 20-60 seconds of spoken delivery).
- End with a sharp, challenging question for the human opponent to defend their stance.
- Do NOT repeat arguments from earlier rounds.
- Keep the language natural, articulate, professional, and clear when spoken aloud.

Return ONLY the raw spoken counterargument text. No markdown, no "AI Opponent:", no extra headers.`;

      const response = await model.generateContent(prompt);
      const text = response.response.text().replace(/^AI Opponent:\s*/i, '').trim();
      if (text) return text;
    } catch (err) {
      console.warn('Gemini debate counterargument error:', err.message);
    }
  }

  // Fallback counterarguments if offline or Gemini is unavailable
  const fallbackCounterarguments = [
    `While your argument regarding "${topic}" sounds plausible, it overlooks a key economic and social reality. How do you address the risk of unexpected consequences for the broader community?`,
    `I understand your perspective, but there is significant counter-evidence. If we adopt your position unconditionally, how can we prevent systemic imbalance and misuse?`,
    `That is a fair point, but you have not addressed the primary flaw in that reasoning. Why should we prioritize short-term convenience over long-term stability?`,
    `Your point addresses one aspect of "${topic}", but ignores the fundamental ethical question. How can you justify that stance when alternative approaches yield far safer outcomes?`,
    `In this final round, your argument still leaves the core challenge unanswered. What concrete safeguard would you propose to guarantee your approach actually succeeds?`
  ];

  const idx = Math.min(fallbackCounterarguments.length - 1, Math.max(0, (roundNumber || 1) - 1));
  return fallbackCounterarguments[idx];
};

export const checkGroupContentSafety = async (transcript, topic) => {
  if (!transcript || transcript.trim().length < 5) {
    return { isViolation: false, warningMessage: '' };
  }

  const toxicKeywords = ['bitch', 'idiot', 'stupid', 'fuck', 'shit', 'asshole', 'shut up', 'hate you', 'dumb'];
  const textLower = transcript.toLowerCase();
  
  const containsAbuse = toxicKeywords.some(kw => textLower.includes(kw));
  if (containsAbuse) {
    return {
      isViolation: true,
      reason: 'Inappropriate or abusive language detected.',
      warningMessage: 'Please maintain professional language and treat fellow participants respectfully.'
    };
  }

  const genAI = getGenAI();
  if (genAI && topic) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `
Check if the participant speech transcript in a group discussion on topic "${topic}" violates community guidelines (off-topic, vulgar, abusive, personal attacks, or repeated spam).

TRANSCRIPT: "${transcript}"

Return JSON ONLY:
{
  "isViolation": boolean,
  "reason": "string",
  "warningMessage": "string"
}`;
      const response = await model.generateContent(prompt);
      const cleanJson = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {}
  }

  return { isViolation: false, warningMessage: '' };
};

export const getAICoachResponse = async (userQuestion, userContext) => {
  const contextStr = userContext ? `User Level: ${userContext.level}, Overall Score: ${userContext.overallScore}/100, Sessions: ${userContext.sessionsCompleted}.` : '';

  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const prompt = `You are SkillForge AI Coach, a world-class communication and soft skills mentor.
${contextStr}
Answer the user's question with actionable, empathetic, and expert advice. Keep it engaging, structured with clear bullet points, and around 150-200 words.

User Question: "${userQuestion}"`;

      const response = await model.generateContent(prompt);
      return response.response.text();
    } catch (e) {
      console.warn('AI Coach Gemini error:', e.message);
    }
  }

  const q = userQuestion.toLowerCase();
  if (q.includes('confidence')) {
    return `To boost your vocal confidence:
• **Breathe & Pause**: Take a deep breath before answering. Pausing for 2 seconds builds authority.
• **Maintain Moderate Speed**: Speaking too fast signals anxiety. Aim for 130-150 words per minute.
• **Use Strong Assertive Phrasing**: Replace "I think maybe" with "In my experience" or "My analysis shows".
• **Practice Daily**: Use the JAM Session or Impromptu Speaking activity right here on SkillForge AI!`;
  }
  if (q.includes('fluency') || q.includes('filler')) {
    return `To eliminate filler words and boost fluency:
• **Embrace Silence**: When searching for words, pause silently instead of saying "um" or "basically".
• **Chunk Your Thoughts**: Deliver ideas in clear 5-to-7 word phrases.
• **Record & Review**: Listen back to your practice session transcripts to spot repeat triggers.
• **Expand Vocabulary**: Use varied transition words like *Furthermore*, *Consequently*, and *Specifically*.`;
  }

  return `Great question! Developing soft skills is an ongoing journey. Focus on:
1. **Structuring your thoughts** using the PREP framework (Point, Reason, Example, Point).
2. **Active listening** during group sessions.
3. **Daily short practice** using our 2-minute JAM and Interview modules.
Your current score of ${userContext?.overallScore || 0} shows great potential. Keep practicing!`;
};
