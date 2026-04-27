import { useEffect, useRef, useState } from 'react';
import type { LetterGrade } from '../../types';
import { GRADE_COLORS } from '../../utils/constants';

interface Props {
  grade: LetterGrade;
  score: number;
  onComplete: () => void;
}

export function AnimatedGradeReveal({ grade, score, onComplete }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const [showGrade, setShowGrade] = useState(false);
  const [pulse, setPulse] = useState(false);
  const frameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDialogElement>(null);

  const color = GRADE_COLORS[grade];

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof globalThis !== 'undefined' &&
    'matchMedia' in globalThis &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* eslint-disable react-hooks/set-state-in-effect -- animation driven by requestAnimationFrame */
  useEffect(() => {
    // If user prefers reduced motion, skip animation
    if (prefersReducedMotion) {
      setDisplayScore(score);
      setShowGrade(true);
      timerRef.current = setTimeout(onComplete, 800);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // Animate score counting
    const duration = 1200; // ms
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        // Score animation done — show grade
        setShowGrade(true);
        setTimeout(() => setPulse(true), 200);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    // Auto-dismiss after 2.5s
    timerRef.current = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      cancelAnimationFrame(frameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [score, onComplete, prefersReducedMotion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Focus container for keyboard accessibility
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onComplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      handleDismiss();
    }
  };

  return (
    <dialog
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer w-full h-full max-w-none max-h-none border-none p-0 m-0"
      onClick={handleDismiss}
      onKeyDown={handleKeyDown}
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
      }}
      aria-label={`Analysis complete. Score: ${score} out of 100. Grade: ${grade}. Press Enter or Escape to continue.`}
      open
    >
      <div className="flex flex-col items-center gap-6">
        {/* Score counter */}
        <div
          className="text-6xl sm:text-7xl font-black tabular-nums transition-colors duration-300"
          style={{ color: showGrade ? color : '#e8edf5' }}
          aria-hidden="true"
        >
          {displayScore}
          <span className="text-2xl sm:text-3xl text-text-muted font-medium">/100</span>
        </div>

        {/* Grade letter */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            opacity: showGrade ? 1 : 0,
            transform: showGrade ? 'scale(1)' : 'scale(0.3)',
          }}
          aria-hidden="true"
        >
          <div
            className="text-[120px] sm:text-[160px] font-black leading-none"
            style={{
              color,
              textShadow: pulse
                ? `0 0 40px ${color}80, 0 0 80px ${color}40, 0 0 120px ${color}20`
                : `0 0 20px ${color}40`,
              transition: 'text-shadow 0.6s ease-in-out',
              animation: pulse ? 'gradeRevealPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            {grade}
          </div>
        </div>

        {/* Click to dismiss hint */}
        <div
          className="text-sm text-text-muted transition-opacity duration-500"
          style={{ opacity: showGrade ? 1 : 0 }}
        >
          Click anywhere or press Enter to continue
        </div>
      </div>

      {/* Inline keyframes for the pulse animation */}
      <style>{`
        @keyframes gradeRevealPulse {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.3);
          }
        }
      `}</style>
    </dialog>
  );
}
