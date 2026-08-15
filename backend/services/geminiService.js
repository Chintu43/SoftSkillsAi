import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (err) {
    console.warn('⚠️ Gemini API initialization warning:', err.message);
  }
}

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

  // Basic Heuristic Safety & Junk Checks
  const words = cleanTopic.split(/\s+/);
  
  // Single word random string test (e.g. "asdfgh")
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

  // Repetitive words check (e.g. "hello hello hello")
  if (words.length >= 2 && new Set(words.map(w => w.toLowerCase())).size === 1 && !['yes', 'no', 'go'].includes(words[0].toLowerCase())) {
    return {
      valid: false,
      topic: cleanTopic,
      message: 'Repetitive phrase detected. Please enter a proper topic.'
    };
  }

  // Toxic keywords check
  const toxicKeywords = ['bitch', 'fuck', 'shit', 'idiot', 'asshole', 'kill', 'hate'];
  if (toxicKeywords.some(kw => cleanTopic.toLowerCase().includes(kw))) {
    return {
      valid: false,
      topic: cleanTopic,
      message: 'Topic contains inappropriate language. Please maintain professional standards.'
    };
  }

  // Gemini AI validation if available
  if (genAI) {
    try {
      const model = genAI.getGenerativeAIModel({ model: 'gemini-1.5-flash' });
      const prompt = `
You are an AI topic validator for a Soft Skills & Communication Training Platform.
Evaluate if the user topic: "${cleanTopic}" is meaningful, appropriate, safe, and discussable for the activity "${activityName || 'General Practice'}".

Creative, imaginative, simple, or philosophical topics (e.g., "AI is the future", "If birds could talk", "Life without smartphones", "Future of technology") ARE VALID.

Only mark invalid if the input is random gibberish (e.g. "asdfgh", "123456", "#$%@"), vulgar/abusive, or complete spam.

Return strictly valid JSON format:
{
  "valid": boolean,
  "topic": "${cleanTopic}",
  "message": "This is a valid discussion topic." (or reason if invalid)
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

  // Default fallback for valid topics
  return {
    valid: true,
    topic: cleanTopic,
    message: 'This is a valid discussion topic.'
  };
};

/**
 * AI Transcript Performance Evaluator
 */
export const analyzeTranscriptWithGemini = async ({ transcript, activityName, topic, activityType }) => {
  const cleanTranscript = (transcript || '').trim();

  // STRICT REQUIREMENT: If transcript is empty, return 0 scores across all metrics. Do NOT generate fake speech!
  if (!cleanTranscript || cleanTranscript.length === 0) {
    return {
      isEmptySpeech: true,
      scores: {
        overall: 0,
        communication: 0,
        fluency: 0,
        confidence: 0,
        grammar: 0,
        vocabulary: 0,
        clarity: 0,
        topicRelevance: 0,
        professionalism: 0,
        leadership: 0,
        listening: 0,
        teamwork: 0,
        criticalThinking: 0
      },
      strengths: [],
      areasToImprove: ['Try speaking for the full session duration so your communication skills can be evaluated.'],
      mistakes: [],
      aiFeedback: 'You did not speak during this session.'
    };
  }

  // Real transcript evaluation via Gemini AI
  if (genAI) {
    try {
      const model = genAI.getGenerativeAIModel({ model: 'gemini-1.5-flash' });
      const prompt = `
You are an expert AI Soft Skills Coach evaluating a user's speech transcript for the activity: "${activityName}" (Topic: "${topic || 'General'}").

USER TRANSCRIPT:
"${cleanTranscript}"

CRITICAL RULE: Evaluate ONLY the speech contained in this transcript. Do not invent sentences, quotes, mistakes, or statements that are not present in the transcript.

Evaluate performance and return strictly valid JSON:
{
  "scores": {
    "overall": <number 0-100>,
    "communication": <number 0-100>,
    "fluency": <number 0-100>,
    "confidence": <number 0-100>,
    "grammar": <number 0-100>,
    "vocabulary": <number 0-100>,
    "clarity": <number 0-100>,
    "topicRelevance": <number 0-100>,
    "professionalism": <number 0-100>,
    "leadership": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "areasToImprove": ["<area 1>", "<area 2>"],
  "mistakes": [
    {
      "original": "<exact phrase from transcript>",
      "better": "<improved phrasing>",
      "reason": "<explanation>"
    }
  ],
  "aiFeedback": "<Encouraging 2-3 sentence coaching feedback based ONLY on transcript>"
}`;

      const response = await model.generateContent(prompt);
      const cleanJsonStr = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      if (parsed.scores && parsed.strengths) {
        return parsed;
      }
    } catch (err) {
      console.warn('Gemini API call error (using transcript rule evaluator):', err.message);
    }
  }

  // Fallback evaluator ONLY for non-empty transcripts (analyzing REAL words)
  const words = cleanTranscript.split(/\s+/);
  const wordCount = words.length;
  const fillers = ['basically', 'actually', 'like', 'um', 'uh', 'you know', 'literally', 'so yeah', 'i mean'];
  let fillerCount = 0;
  fillers.forEach(f => {
    const regex = new RegExp(`\\b${f}\\b`, 'gi');
    const matches = cleanTranscript.match(regex);
    if (matches) fillerCount += matches.length;
  });

  const fluency = Math.min(95, Math.max(55, Math.round(70 + (wordCount > 30 ? 15 : wordCount * 0.4) - fillerCount * 3)));
  const confidence = Math.min(96, Math.max(50, Math.round(75 + (wordCount > 50 ? 12 : 5) - fillerCount * 2)));
  const grammar = Math.min(94, Math.max(60, Math.round(78 - (fillerCount > 2 ? 4 : 0))));
  const vocabulary = Math.min(95, Math.max(55, Math.round(68 + (new Set(words.map(w => w.toLowerCase())).size > 20 ? 15 : 8))));
  const clarity = Math.min(95, Math.max(60, Math.round((fluency + confidence) / 2)));
  const topicRelevance = Math.min(96, Math.max(65, Math.round(82 + (topic && cleanTranscript.toLowerCase().includes(topic.toLowerCase().split(' ')[0]) ? 10 : 0))));
  const professionalism = Math.min(95, Math.max(60, Math.round(78 + (fillerCount < 3 ? 10 : -5))));
  const leadership = Math.min(92, Math.max(50, Math.round(72 + (wordCount > 60 ? 10 : 0))));

  const communication = Math.round((fluency + clarity + confidence) / 3);
  const overall = Math.round(
    communication * 0.15 +
    fluency * 0.15 +
    confidence * 0.15 +
    grammar * 0.10 +
    vocabulary * 0.10 +
    clarity * 0.10 +
    topicRelevance * 0.10 +
    professionalism * 0.10 +
    leadership * 0.05
  );

  const strengths = [];
  if (confidence >= 75) strengths.push('Good vocal confidence and steady delivery');
  if (topicRelevance >= 80) strengths.push('Strong topic alignment with relevant points');
  if (strengths.length === 0) strengths.push('Clear articulation and willing engagement');

  const areasToImprove = [];
  if (fillerCount > 0) areasToImprove.push(`Reduce filler word usage (${fillerCount} detected)`);
  if (wordCount < 40) areasToImprove.push('Elaborate more on your ideas');
  if (areasToImprove.length === 0) areasToImprove.push('Work on vocal modulation and pauses');

  const mistakes = [];
  if (cleanTranscript.toLowerCase().includes('basically') || cleanTranscript.toLowerCase().includes('actually')) {
    mistakes.push({
      original: words.slice(0, 8).join(' '),
      better: 'I am genuinely focused on this topic.',
      reason: 'Filler words reduce executive impact.'
    });
  }

  return {
    scores: { overall, communication, fluency, confidence, grammar, vocabulary, clarity, topicRelevance, professionalism, leadership },
    strengths,
    areasToImprove,
    mistakes,
    aiFeedback: `Good effort on your ${activityName || 'practice'} session! Your speech addressed the topic. Focus on pausing intentionally instead of using filler words.`
  };
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

  if (genAI && topic) {
    try {
      const model = genAI.getGenerativeAIModel({ model: 'gemini-1.5-flash' });
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

  if (genAI) {
    try {
      const model = genAI.getGenerativeAIModel({ model: 'gemini-1.5-flash' });
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
