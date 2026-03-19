import { useState, useEffect, useCallback } from 'react';

interface RateLimitState {
  attempts: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'login_rate_limit';

const store = new Map<string, RateLimitState>();

function getStoredState(email: string): RateLimitState {
  const stored = store.get(email);
  if (stored) {
    if (stored.lockedUntil && Date.now() > stored.lockedUntil) {
      store.delete(email);
      return { attempts: 0, lockedUntil: null };
    }
    return stored;
  }
  return { attempts: 0, lockedUntil: null };
}

function saveState(email: string, state: RateLimitState) {
  store.set(email, state);
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
    store.delete(email);
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
