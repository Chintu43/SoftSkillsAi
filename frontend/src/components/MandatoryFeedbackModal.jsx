import React, { useState } from 'react';
import { Star, Sparkles, MessageSquare, AlertCircle, X } from 'lucide-react';
import { api } from '../services/api';

/**
 * MandatoryFeedbackModal — Post-evaluation feedback popup modal.
 * Appears after AI evaluation score and results are rendered.
 */
export const MandatoryFeedbackModal = ({ sessionId, activityName, onFeedbackSuccess, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const starLabels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  const currentActiveRating = hoverRating || rating;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!rating || rating < 1 || rating > 5) {
      setErrorMessage('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await api.submitFeedback({
        sessionId,
        rating,
        description: description.trim()
      });

      onFeedbackSuccess({
        rating,
        description: description.trim(),
        ...result?.feedback
      });
    } catch (err) {
      console.error('Feedback submission failed:', err);
      setErrorMessage(err.message || 'Unable to submit feedback. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="feedback-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 12, 24, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        className="glass-card"
        style={{
          position: 'relative',
          maxWidth: '540px',
          width: '100%',
          padding: '36px 32px',
          textAlign: 'center',
          borderRadius: '24px',
          background: 'linear-gradient(145deg, rgba(26, 32, 58, 0.96), rgba(15, 20, 38, 0.98))',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.65), 0 0 40px rgba(99, 102, 241, 0.15)'
        }}
      >
        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
            aria-label="Close feedback modal"
          >
            <X size={18} />
          </button>
        )}

        {/* Header Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
          }}
        >
          <Sparkles size={32} />
        </div>

        {/* Title & Subtitle */}
        <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
          How was your SkillForge AI experience?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          {activityName ? `How would you rate your ${activityName} AI evaluation experience?` : 'Please rate your practice session experience to help us improve.'}
        </p>

        {/* Star Rating Section */}
        <div style={{ marginBottom: '22px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}
          >
            {[1, 2, 3, 4, 5].map((starValue) => {
              const isFilled = currentActiveRating >= starValue;
              return (
                <button
                  key={starValue}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setRating(starValue);
                    setErrorMessage(null);
                  }}
                  onMouseEnter={() => setHoverRating(starValue)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    transition: 'transform 0.15s ease',
                    transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                    outline: 'none'
                  }}
                  aria-label={`${starValue} Star${starValue > 1 ? 's' : ''}`}
                >
                  <Star
                    size={38}
                    fill={isFilled ? '#FBBF24' : 'none'}
                    color={isFilled ? '#F59E0B' : 'rgba(255, 255, 255, 0.25)'}
                    strokeWidth={isFilled ? 1.5 : 1.5}
                  />
                </button>
              );
            })}
          </div>

          <div style={{ height: '22px', fontSize: '0.9rem', fontWeight: 700, color: rating > 0 ? '#FBBF24' : 'var(--text-dim)' }}>
            {currentActiveRating > 0 ? `${currentActiveRating} Star${currentActiveRating > 1 ? 's' : ''} — ${starLabels[currentActiveRating]}` : 'Select a Star Rating'}
          </div>
        </div>

        {/* Description Input Section */}
        <div style={{ textAlign: 'left', marginBottom: '20px' }}>
          <label
            htmlFor="feedback-description"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.92rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}
          >
            <MessageSquare size={16} color="#818CF8" /> How was your session?
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            placeholder="Tell us how the session was. Were there any issues or fallbacks?"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5
            }}
          />
        </div>

        {/* Error Alert Display */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '0.88rem',
              fontWeight: 600,
              marginBottom: '20px'
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mandatory Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: '1rem',
            fontWeight: 800,
            borderRadius: '12px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.75 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {isSubmitting ? (
            <>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              Submitting...
            </>
          ) : (
            'Submit Feedback'
          )}
        </button>

        {/* Maybe Later Option */}
        {onClose && (
          <div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.86rem',
                marginTop: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                textDecoration: 'underline'
              }}
            >
              Maybe Later
            </button>
          </div>
        )}

        {/* Note */}
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '12px 0 0 0' }}>
          Thank you for helping us continuously improve SkillForge AI!
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

