import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getSurveyStatus } from '../services/SurveyService';

export default function SurveyReminderCard() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    getSurveyStatus()
      .then((res) => {
        if (isMounted) {
          setHasCompleted(res.hasCompletedSurvey);
          // Trigger the smooth slide-up transition after a slight delay
          if (!res.hasCompletedSurvey) {
            setTimeout(() => setIsVisible(true), 600);
          }
        }
      })
      .catch(() => {
        if (isMounted) setHasCompleted(false);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  // Do not show if:
  // 1. Survey status is still loading or completed
  // 2. User clicked the close/dismiss button
  // 3. User is currently on the /survey page itself
  if (hasCompleted !== false || isDismissed || location.pathname === '/survey') {
    return null;
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm w-full transition-all duration-500 ease-out transform ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-10 opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-xl shadow-blue-950/10 relative overflow-hidden">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-lg text-base leading-none transition"
          aria-label="Dismiss reminder"
        >
          ✕
        </button>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold shrink-0 mt-0.5">
            📋
          </div>

          <div className="pr-4">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              Complete Driving Survey
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Help calibrate task difficulty metrics by sharing your driving experience (takes ~1 min).
            </p>

            <div className="mt-3.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/survey')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Take Survey
              </button>
              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}