import { analyzeTranscriptWithGemini, getAICoachResponse, validateCustomTopic } from '../services/geminiService.js';
import { Store } from '../services/store.js';

export const validateTopicController = async (req, res) => {
  try {
    const { topic, activityName } = req.body;
    const result = await validateCustomTopic(topic, activityName);
    res.json(result);
  } catch (error) {
    console.error('Validate topic controller error:', error);
    res.status(500).json({ isValid: false, message: 'Error validating topic. Please try again.' });
  }
};

export const analyzeTranscript = async (req, res) => {
  try {
    const { transcript, activityName, topic, activityType } = req.body;
    const result = await analyzeTranscriptWithGemini({ transcript, activityName, topic, activityType });
    res.json(result);
  } catch (error) {
    console.error('AI analyze error:', error);
    res.status(500).json({ message: 'Error analyzing transcript' });
  }
};

export const getCoachFeedback = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const user = req.user ? await Store.findUserById(req.user.id) : null;
    const answer = await getAICoachResponse(question, user);
    res.json({ answer });
  } catch (error) {
    console.error('AI coach error:', error);
    res.status(500).json({ message: 'Error generating AI coach response' });
  }
};

export const getInterviewQuestions = async (req, res) => {
  try {
    const questions = [
      "Tell me about yourself and your background.",
      "What are your core strengths and how do you apply them?",
      "What is your biggest professional weakness, and how are you working to overcome it?",
      "Why should our organization hire you over other candidates?",
      "Where do you see your career progressing in five years?"
    ];
    res.json({ questions });
  } catch (error) {
    res.status(500).json({ message: 'Error loading interview questions' });
  }
};
