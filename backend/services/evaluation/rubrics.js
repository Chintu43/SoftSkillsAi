/**
 * Activity-specific rubrics for SkillForge AI strict evaluation.
 * Each rubric defines criteria with weights that sum to 100.
 * Ratings are 0–5; weightedScore = (rating/5) × weight.
 *
 * IMPORTANT: Do NOT add a generic fallback that silently returns
 * another activity's rubric. Every activity must have its own entry.
 */

export const RUBRICS = {

  // ─── INDIVIDUAL ────────────────────────────────────────────────────────────

  jam: {
    label: 'JAM Session',
    criteria: [
      { key: 'topicRelevance',    label: 'Relevance to Topic',    weight: 20 },
      { key: 'contentIdeas',      label: 'Content & Ideas',       weight: 20 },
      { key: 'fluency',           label: 'Fluency',               weight: 20 },
      { key: 'organization',      label: 'Organization',          weight: 10 },
      { key: 'vocabulary',        label: 'Vocabulary',            weight: 10 },
      { key: 'grammar',           label: 'Grammar',               weight:  5 },
      { key: 'pronunciation',     label: 'Pronunciation',         weight:  5 },
      { key: 'confidenceDelivery',label: 'Confidence & Delivery', weight:  5 },
      { key: 'timeManagement',    label: 'Time Management',       weight:  5 },
    ]
  },

  selfIntroduction: {
    label: 'Self Introduction',
    criteria: [
      { key: 'structureOrg',      label: 'Structure & Organization',  weight: 15 },
      { key: 'relevantInfo',      label: 'Relevant Information',      weight: 20 },
      { key: 'communicationClarity', label: 'Communication Clarity',  weight: 15 },
      { key: 'fluency',           label: 'Fluency',                   weight: 15 },
      { key: 'confidence',        label: 'Confidence',                weight: 10 },
      { key: 'vocabulary',        label: 'Vocabulary',                weight: 10 },
      { key: 'grammar',           label: 'Grammar',                   weight:  5 },
      { key: 'pronunciation',     label: 'Pronunciation',             weight:  5 },
      { key: 'bodyLanguage',      label: 'Composure & Pacing',        weight:  5 },
    ]
  },

  interview: {
    label: 'Interview Practice',
    criteria: [
      { key: 'answerRelevance',   label: 'Relevance of Answer',   weight: 20 },
      { key: 'answerQuality',     label: 'Quality of Answer',     weight: 20 },
      { key: 'communication',     label: 'Communication',         weight: 15 },
      { key: 'confidence',        label: 'Confidence',            weight: 10 },
      { key: 'professionalism',   label: 'Professionalism',       weight: 10 },
      { key: 'fluency',           label: 'Fluency',               weight: 10 },
      { key: 'examplesEvidence',  label: 'Examples / Evidence',   weight:  5 },
      { key: 'grammarVocabulary', label: 'Grammar & Vocabulary',  weight:  5 },
      { key: 'questionUnderstanding', label: 'Question Understanding', weight: 5 },
    ]
  },

  storytelling: {
    label: 'Storytelling',
    criteria: [
      { key: 'storyStructure',    label: 'Story Structure',       weight: 20 },
      { key: 'creativityOriginality', label: 'Creativity & Originality', weight: 15 },
      { key: 'content',          label: 'Content',               weight: 15 },
      { key: 'fluency',          label: 'Fluency',               weight: 15 },
      { key: 'engagement',       label: 'Engagement',            weight: 10 },
      { key: 'vocabulary',       label: 'Vocabulary',            weight: 10 },
      { key: 'voiceModulation',  label: 'Voice Modulation',      weight:  5 },
      { key: 'pronunciation',    label: 'Pronunciation',         weight:  5 },
      { key: 'conclusion',       label: 'Conclusion / Message',  weight:  5 },
    ]
  },

  impromptu: {
    label: 'Impromptu Speaking',
    criteria: [
      { key: 'spontaneousThinking', label: 'Spontaneous Thinking', weight: 20 },
      { key: 'relevance',          label: 'Relevance',            weight: 20 },
      { key: 'ideasContent',       label: 'Ideas & Content',      weight: 15 },
      { key: 'fluency',            label: 'Fluency',              weight: 15 },
      { key: 'organization',       label: 'Organization',         weight: 10 },
      { key: 'vocabulary',         label: 'Vocabulary',           weight:  5 },
      { key: 'grammar',            label: 'Grammar',              weight:  5 },
      { key: 'confidence',         label: 'Confidence',           weight:  5 },
      { key: 'timeManagement',     label: 'Time Management',      weight:  5 },
    ]
  },

  communication: {
    label: 'Communication Practice',
    criteria: [
      { key: 'clarity',           label: 'Clarity',                   weight: 20 },
      { key: 'fluency',           label: 'Fluency',                   weight: 15 },
      { key: 'activeCommunication', label: 'Active Communication',    weight: 15 },
      { key: 'vocabulary',        label: 'Vocabulary',                weight: 10 },
      { key: 'grammar',           label: 'Grammar',                   weight: 10 },
      { key: 'pronunciation',     label: 'Pronunciation',             weight: 10 },
      { key: 'listeningRelevance',label: 'Response Relevance',        weight: 10 },
      { key: 'confidence',        label: 'Confidence',                weight: 10 },
    ]
  },

  vocabulary: {
    label: 'Vocabulary Practice',
    criteria: [
      { key: 'correctUsage',      label: 'Correct Word Usage',    weight: 30 },
      { key: 'meaningUnderstanding', label: 'Meaning Understanding', weight: 20 },
      { key: 'contextualUsage',   label: 'Contextual Usage',      weight: 15 },
      { key: 'vocabularyVariety', label: 'Vocabulary Variety',    weight: 15 },
      { key: 'pronunciation',     label: 'Pronunciation',         weight: 10 },
      { key: 'sentenceFormation', label: 'Sentence Formation',    weight: 10 },
    ]
  },

  situational: {
    label: 'Situational Speaking',
    criteria: [
      { key: 'situationUnderstanding', label: 'Understanding Situation', weight: 20 },
      { key: 'appropriateness',   label: 'Appropriateness',       weight: 20 },
      { key: 'problemSolving',    label: 'Problem Solving',       weight: 15 },
      { key: 'communicationClarity', label: 'Communication Clarity', weight: 15 },
      { key: 'professionalism',   label: 'Professionalism',       weight: 10 },
      { key: 'empathyAwareness',  label: 'Empathy & Social Awareness', weight: 10 },
      { key: 'fluency',           label: 'Fluency',               weight:  5 },
      { key: 'confidence',        label: 'Confidence',            weight:  5 },
    ]
  },

  presentation: {
    label: 'Presentation Practice',
    criteria: [
      { key: 'contentKnowledge',  label: 'Content Knowledge',     weight: 20 },
      { key: 'organization',      label: 'Organization',          weight: 15 },
      { key: 'delivery',          label: 'Delivery',              weight: 15 },
      { key: 'communication',     label: 'Communication',         weight: 10 },
      { key: 'confidence',        label: 'Confidence',            weight: 10 },
      { key: 'audienceEngagement',label: 'Audience Engagement',   weight: 10 },
      { key: 'voiceModulation',   label: 'Voice Modulation',      weight:  5 },
      { key: 'bodyLanguage',      label: 'Body Language',         weight:  5 },
      { key: 'timeManagement',    label: 'Time Management',       weight: 10 },
    ]
  },

  leadership: {
    label: 'Leadership Practice',
    criteria: [
      { key: 'initiative',        label: 'Initiative',            weight: 20 },
      { key: 'decisionMaking',    label: 'Decision Making',       weight: 15 },
      { key: 'communication',     label: 'Communication',         weight: 15 },
      { key: 'problemSolving',    label: 'Problem Solving',       weight: 15 },
      { key: 'teamCoordination',  label: 'Team Coordination',     weight: 15 },
      { key: 'responsibility',    label: 'Responsibility',        weight: 10 },
      { key: 'confidence',        label: 'Confidence',            weight:  5 },
      { key: 'listening',         label: 'Listening',             weight:  5 },
    ]
  },

  confidence: {
    label: 'Confidence Practice',
    criteria: [
      { key: 'speakingConfidence',label: 'Speaking Confidence',   weight: 20 },
      { key: 'fluency',           label: 'Fluency',               weight: 15 },
      { key: 'voiceStability',    label: 'Voice Stability',       weight: 15 },
      { key: 'clarity',           label: 'Clarity',               weight: 15 },
      { key: 'bodyLanguage',      label: 'Composure',             weight: 10 },
      { key: 'eyeContact',        label: 'Eye Contact / Focus',   weight: 10 },
      { key: 'assertiveness',     label: 'Assertiveness',         weight: 10 },
      { key: 'composure',         label: 'Calmness Under Pressure', weight: 5 },
    ]
  },

  pronunciation: {
    label: 'Pronunciation Practice',
    criteria: [
      { key: 'wordAccuracy',      label: 'Word Pronunciation Accuracy', weight: 30 },
      { key: 'sentencePronunciation', label: 'Sentence Pronunciation', weight: 20 },
      { key: 'intelligibility',   label: 'Intelligibility',       weight: 20 },
      { key: 'stress',            label: 'Word Stress',           weight: 10 },
      { key: 'rhythm',            label: 'Rhythm & Pace',         weight: 10 },
      { key: 'intonation',        label: 'Intonation',            weight:  5 },
      { key: 'fluency',           label: 'Fluency',               weight:  5 },
    ]
  },

  // ─── GROUP ─────────────────────────────────────────────────────────────────

  groupDiscussion: {
    label: 'Group Discussion',
    criteria: [
      { key: 'qualityOfIdeas',    label: 'Quality of Ideas',      weight: 20 },
      { key: 'relevanceLogic',    label: 'Relevance & Logic',     weight: 15 },
      { key: 'communication',     label: 'Communication',         weight: 15 },
      { key: 'listening',         label: 'Listening',             weight: 15 },
      { key: 'participation',     label: 'Participation',         weight: 10 },
      { key: 'teamwork',          label: 'Teamwork',              weight: 10 },
      { key: 'leadership',        label: 'Leadership',            weight:  5 },
      { key: 'respect',           label: 'Respect',               weight:  5 },
      { key: 'confidence',        label: 'Confidence',            weight:  5 },
    ]
  },

  debate: {
    label: 'Debate',
    criteria: [
      { key: 'argumentQuality',   label: 'Argument Quality',      weight: 20 },
      { key: 'evidenceExamples',  label: 'Evidence & Examples',   weight: 15 },
      { key: 'logicalReasoning',  label: 'Logical Reasoning',     weight: 15 },
      { key: 'rebuttal',          label: 'Rebuttal',              weight: 15 },
      { key: 'relevance',         label: 'Relevance',             weight: 10 },
      { key: 'communication',     label: 'Communication',         weight: 10 },
      { key: 'confidence',        label: 'Confidence',            weight:  5 },
      { key: 'respect',           label: 'Respect & Professionalism', weight: 5 },
      { key: 'closingSynthesis',  label: 'Closing & Synthesis',   weight:  5 },
    ]
  },

  teamDiscussion: {
    label: 'Team Discussion',
    criteria: [
      { key: 'relevantContributions', label: 'Relevant Contributions', weight: 20 },
      { key: 'listening',         label: 'Listening',             weight: 15 },
      { key: 'collaboration',     label: 'Collaboration',         weight: 15 },
      { key: 'communication',     label: 'Communication',         weight: 15 },
      { key: 'problemSolving',    label: 'Problem Solving',       weight: 10 },
      { key: 'respect',           label: 'Respect',               weight: 10 },
      { key: 'participation',     label: 'Participation',         weight:  5 },
      { key: 'leadership',        label: 'Leadership',            weight:  5 },
      { key: 'adaptability',      label: 'Adaptability',          weight:  5 },
    ]
  },

  collaborativeProblemSolving: {
    label: 'Collaborative Problem Solving',
    criteria: [
      { key: 'solutionQuality',   label: 'Solution Quality',      weight: 20 },
      { key: 'problemUnderstanding', label: 'Problem Understanding', weight: 15 },
      { key: 'ideaGeneration',    label: 'Idea Generation',       weight: 15 },
      { key: 'logicalReasoning',  label: 'Logical Reasoning',     weight: 15 },
      { key: 'collaboration',     label: 'Collaboration',         weight: 15 },
      { key: 'decisionMaking',    label: 'Decision Making',       weight: 10 },
      { key: 'communication',     label: 'Communication',         weight:  5 },
      { key: 'adaptability',      label: 'Adaptability',          weight:  5 },
    ]
  },

  groupJAM: {
    label: 'Group JAM',
    criteria: [
      { key: 'topicRelevance',    label: 'Topic Relevance',       weight: 15 },
      { key: 'ideasContent',      label: 'Ideas & Content',       weight: 15 },
      { key: 'individualFluency', label: 'Individual Fluency',    weight: 15 },
      { key: 'continuity',        label: 'Continuity',            weight: 10 },
      { key: 'listening',         label: 'Listening',             weight: 10 },
      { key: 'speakerTransitions',label: 'Speaker Transitions',   weight: 10 },
      { key: 'teamCoordination',  label: 'Team Coordination',     weight: 10 },
      { key: 'vocabulary',        label: 'Vocabulary',            weight:  5 },
      { key: 'confidence',        label: 'Confidence',            weight:  5 },
      { key: 'timeManagement',    label: 'Time Management',       weight:  5 },
    ]
  },

  mockInterviewPanel: {
    label: 'Mock Interview Panel',
    criteria: [
      { key: 'answerQuality',     label: 'Answer Quality',        weight: 20 },
      { key: 'relevance',         label: 'Relevance',             weight: 15 },
      { key: 'communication',     label: 'Communication',         weight: 15 },
      { key: 'confidence',        label: 'Confidence',            weight: 10 },
      { key: 'professionalism',   label: 'Professionalism',       weight: 10 },
      { key: 'subjectKnowledge',  label: 'Subject Knowledge',     weight: 10 },
      { key: 'followUpHandling',  label: 'Follow-up Handling',    weight: 10 },
      { key: 'listening',         label: 'Listening',             weight:  5 },
      { key: 'bodyLanguage',      label: 'Composure',             weight:  5 },
    ]
  },
};

/**
 * Map activity name strings (as stored/passed around the app) to rubric keys.
 * This covers both activity IDs from IndividualPractice and group activityType strings.
 */
export const ACTIVITY_TO_RUBRIC_KEY = {
  // Individual activity IDs
  'jam':                        'jam',
  'self-intro':                 'selfIntroduction',
  'interview':                  'interview',
  'storytelling':               'storytelling',
  'impromptu':                  'impromptu',
  'communication':              'communication',
  'vocabulary':                 'vocabulary',
  'situational':                'situational',
  'presentation':               'presentation',
  'leadership':                 'leadership',
  'confidence':                 'confidence',
  'pronunciation':              'pronunciation',
  'ai-voice-debate':            'debate',

  // Activity names (as stored in activityName field)
  'JAM Session':                'jam',
  'Self Introduction':          'selfIntroduction',
  'Interview Practice':         'interview',
  'Storytelling':               'storytelling',
  'Impromptu Speaking':         'impromptu',
  'Communication Practice':     'communication',
  'Vocabulary Practice':        'vocabulary',
  'Situational Speaking':       'situational',
  'Presentation Practice':      'presentation',
  'Leadership Practice':        'leadership',
  'Confidence Practice':        'confidence',
  'Pronunciation Practice':     'pronunciation',
  'AI Voice Debate':            'debate',

  // Group activity type strings
  'Group Discussion':           'groupDiscussion',
  'Debate':                     'debate',
  'Team Discussion':            'teamDiscussion',
  'Collaborative Problem Solving': 'collaborativeProblemSolving',
  'Group JAM':                  'groupJAM',
  'Mock Interview Panel':       'mockInterviewPanel',
};

/**
 * Resolve a rubric given an activityName or activityType string.
 * Returns null if no rubric is found (must be handled by caller).
 */
export const getRubric = (activityName) => {
  const key = ACTIVITY_TO_RUBRIC_KEY[activityName];
  return key ? RUBRICS[key] : null;
};
