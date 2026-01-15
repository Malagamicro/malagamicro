import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface UseSessionTimeoutOptions {
  timeoutMs?: number;       // Total timeout duration (default: 30 min)
  warningMs?: number;       // Show warning before timeout (default: 2 min)
  onTimeout?: () => void;   // Called when session times out
}

const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING = 2 * 60 * 1000;  // 2 minutes before timeout

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    warningMs = DEFAULT_WARNING,
    onTimeout,
  } = options;

  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeoutMs);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleTimeout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    
    if (onTimeout) {
      onTimeout();
    } else {
      await signOut();
    }
  }, [clearAllTimers, onTimeout, signOut]);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setRemainingTime(warningMs);
    
    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [warningMs]);

  const resetTimer = useCallback(() => {
    if (!user) return;
    
    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowWarning(false);
    setRemainingTime(warningMs);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      startCountdown();
    }, timeoutMs - warningMs);

    // Set final timeout
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, timeoutMs);
  }, [user, clearAllTimers, timeoutMs, warningMs, startCountdown, handleTimeout]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      // Throttle activity detection to avoid excessive resets
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        resetTimer();
      }
    };

    // Start initial timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetTimer, clearAllTimers]);

  const formatTime = useCallback((ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    showWarning,
    remainingTime,
    formattedTime: formatTime(remainingTime),
    extendSession,
    logout: handleTimeout,
  };
}
