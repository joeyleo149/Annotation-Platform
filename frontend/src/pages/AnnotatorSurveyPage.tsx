import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSurveyStatus } from '../services/SurveyService';
import { SurveyForm } from '../components/SurveyForm';


export const AnnotatorSurveyPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);
  const annotatorId = Number(localStorage.getItem('userId') || '3');


interface SurveyStatusResponse {
  hasCompletedSurvey: boolean;
}


useEffect(() => {
  const checkStatus = async () => {
    try {
      const res = (await getSurveyStatus(annotatorId)) as SurveyStatusResponse;
      setHasCompleted(res.hasCompletedSurvey);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoading(false);
    }
  };
  checkStatus();
}, [annotatorId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Checking eligibility status...</p>
      </div>
    );
  }

  // View when the survey is already submitted
  if (hasCompleted) {
    return (
      <div className="max-w-xl mx-auto mt-6">
        <div className="bg-white rounded-3xl p-10 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/50">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Survey Completed</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your driving profile has been validated. Your workspace is fully unlocked and ready for annotation tasks.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active Survey Form View
  return (
    <div className="max-w-xl mx-auto">
      {/* Top Header Card matching the Screenshot avatar pattern */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-blue-50/50">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11v6m3-3h-6" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Annotator Background Survey</h1>
        <p className="text-sm text-slate-500 mt-1">Complete this 1-minute survey to unlock your video annotation workspace.</p>
      </div>

      <SurveyForm annotatorId={annotatorId} onSuccess={() => navigate('/dashboard')} />
    </div>
  );
};