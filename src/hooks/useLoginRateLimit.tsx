import { useState, useEffect, useCallback } from 'react';

interface RateLimitState {
  attempts: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'login_rate_limit';

function getStoredState(email: string): RateLimitState {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${email}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clear expired lockout
      if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
        localStorage.removeItem(`${STORAGE_KEY}_${email}`);
        return { attempts: 0, lockedUntil: null };
      }
      return parsed;
    }
  } catch {
    // Invalid stored data
  }
  return { attempts: 0, lockedUntil: null };
}

function saveState(email: string, state: RateLimitState) {
  localStorage.setItem(`${STORAGE_KEY}_${email}`, JSON.stringify(state));
}

export function useLoginRateLimit(email: string) {
  const [state, setState] = useState<RateLimitState>(() => getStoredState(email));
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Update state when email changes
  useEffect(() => {
    setState(getStoredState(email));
  }, [email]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!state.lockedUntil) {
      setRemainingTime(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, state.lockedUntil! - Date.now());
      setRemainingTime(remaining);
      
      if (remaining === 0) {
        // Lockout expired, reset state
        const newState = { attempts: 0, lockedUntil: null };
        setState(newState);
        saveState(email, newState);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [state.lockedUntil, email]);

  const isLocked = state.lockedUntil !== null && Date.now() < state.lockedUntil;
  const attemptsRemaining = MAX_ATTEMPTS - state.attempts;

  const recordFailedAttempt = useCallback(() => {
    const currentState = getStoredState(email);
    const newAttempts = currentState.attempts + 1;
    
    let newState: RateLimitState;
    if (newAttempts >= MAX_ATTEMPTS) {
      newState = {
        attempts: newAttempts,
        lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
      };
    } else {
      newState = {
        attempts: newAttempts,
        lockedUntil: null,
      };
    }
    
    saveState(email, newState);
    setState(newState);
    
    return newState;
  }, [email]);

  const resetAttempts = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY}_${email}`);
    setState({ attempts: 0, lockedUntil: null });
  }, [email]);

  const formatRemainingTime = useCallback(() => {
    if (remainingTime <= 0) return '';
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  return {
    isLocked,
    attemptsRemaining,
    remainingTime,
    formatRemainingTime,
    recordFailedAttempt,
    resetAttempts,
    maxAttempts: MAX_ATTEMPTS,
  };
}
