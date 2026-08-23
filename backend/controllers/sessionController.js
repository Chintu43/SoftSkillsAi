import { Store } from '../services/store.js';
import { evaluateTranscript } from '../services/evaluation/evaluator.js';
import { getPerformanceLevel } from '../services/evaluation/scoreCalculator.js';

export const createSession = async (req, res) => {
  try {
    const { activityType, activityName, topic, durationSeconds, transcript } = req.body;
    const userId   = req.user.id;
    const userName = req.user.name;

    console.log("EVALUATION TRANSCRIPT:", transcript);

    // --- Run strict rubric-based AI evaluation ---
    const evaluation = await evaluateTranscript({
      transcript,
      activityName,
      topic,
      activityType
    });

    console.log("=== MISTAKE ANALYSIS DEBUG ===");
    console.log("TRANSCRIPT:", transcript);
    console.log("RAW ANALYSIS:", evaluation);
    console.log("PARSED ANALYSIS:", evaluation.mistakeAnalysis);
    console.log("NORMALIZED MISTAKES:", evaluation.mistakes);

    // Build legacy flat scores from new criteria for backward-compatible dashboard updates
    // (store.updateUserStats still uses these field names)
    const flatScores = buildFlatScores(evaluation);

    const sessionData = {
      userId,
      userName,
      activityType:    activityType || 'individual',
      activityName:    activityName || 'Practice Session',
      topic:           topic || 'General Topic',
      durationSeconds: durationSeconds || 60,
      transcript:      (transcript || '').trim(),

      // New structured evaluation — stored alongside legacy fields
      criteria:         evaluation.criteria || [],
      finalScore:       evaluation.finalScore,
      performanceLevel: evaluation.performanceLevel,
      isEmptySpeech:    evaluation.isEmptySpeech || false,

      // Legacy flat scores (dashboard backward compatibility)
      scores: {
        overall:        evaluation.finalScore,
        communication:  flatScores.communication,
        fluency:        flatScores.fluency,
        confidence:     flatScores.confidence,
        grammar:        flatScores.grammar,
        vocabulary:     flatScores.vocabulary,
        clarity:        flatScores.clarity,
        topicRelevance: flatScores.topicRelevance,
        professionalism: flatScores.professionalism,
        leadership:     flatScores.leadership,
        listening:      flatScores.listening,
        teamwork:       flatScores.teamwork
      },

      strengths:             evaluation.strengths || [],
      areasToImprove:        evaluation.areasToImprove || [],
      positiveObservations:  evaluation.positiveObservations || [],
      mistakeAnalysis:       evaluation.mistakeAnalysis || {},
      mistakes:              evaluation.mistakes || [], // legacy alias
      aiFeedback:            evaluation.aiFeedback || '',
      summary:               evaluation.summary || '',
      hasSpeech:             evaluation.hasSpeech !== undefined ? evaluation.hasSpeech : !evaluation.isEmptySpeech,
      speechDetected:        evaluation.speechDetected !== undefined ? evaluation.speechDetected : !evaluation.isEmptySpeech,
      confidence:            evaluation.confidence || 0,
      wordMistakes:          evaluation.wordMistakes || [],
      wordAnalysis:          evaluation.wordAnalysis || [],
      pronunciationAnalysis: evaluation.pronunciationAnalysis || '',
      fluencyDelivery:       evaluation.fluencyDelivery || '',
      topicRelevance:        evaluation.topicRelevance || '',
      mentorAdvice:          evaluation.mentorAdvice || [],
      sentenceAnalysis:      evaluation.sentenceAnalysis || [],
      correctedSpeech:       evaluation.correctedSpeech || '',
      errorSummary:          evaluation.errorSummary || { major: 0, moderate: 0, minor: 0 },
      categoryBreakdown:     evaluation.categoryBreakdown || {}
    };

    const session = await Store.createSession(sessionData);

    // Update user dashboard stats (running averages)
    await Store.updateUserStats(userId, sessionData);

    console.log("FINAL RESPONSE:", session);

    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Error analyzing and saving session' });
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const sessions = await Store.getUserSessions(req.user.id);
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Error retrieving sessions' });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const session = await Store.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Get session by ID error:', error);
    res.status(500).json({ message: 'Error retrieving session' });
  }
};

/**
 * Map new criteria array back to legacy flat score fields for
 * Store.updateUserStats and the existing dashboard display.
 * If a criterion exists, convert its weightedScore to a 0–100 scale.
 */
function buildFlatScores(evaluation) {
  const criteriaList = evaluation.criteria || [];

  const find = (...keys) => {
    for (const k of keys) {
      const c = criteriaList.find((x) => x.key === k);
      if (c) {
        // Convert weightedScore (out of weight) → percentage (out of 100)
        if (c.weight > 0) {
          return Math.min(100, Math.round((c.weightedScore / c.weight) * 100));
        }
      }
    }
    return evaluation.finalScore || 0;
  };

  return {
    communication:  find('communication', 'communicationClarity', 'activeCommunication'),
    fluency:        find('fluency', 'individualFluency'),
    confidence:     find('confidence', 'speakingConfidence', 'confidenceDelivery'),
    grammar:        find('grammar', 'grammarVocabulary', 'sentenceFormation'),
    vocabulary:     find('vocabulary', 'vocabularyVariety', 'correctUsage'),
    clarity:        find('clarity', 'communicationClarity'),
    topicRelevance: find('topicRelevance', 'relevance', 'answerRelevance'),
    professionalism:find('professionalism'),
    leadership:     find('leadership', 'initiative'),
    listening:      find('listening'),
    teamwork:       find('teamwork', 'collaboration', 'teamCoordination'),
  };
}
