import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SurveyForm } from '../components/SurveyForm';
import { getSurveyStatus, getSurveyResponse, type SurveyResponse } from '../services/SurveyService';

export function AnnotatorSurveyPage() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [isTakingSurvey, setIsTakingSurvey] = useState<boolean>(false);
  const [existingResponse, setExistingResponse] = useState<SurveyResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  useEffect(() => {
    getSurveyStatus()
      .then((x) => setCompleted(x.hasCompletedSurvey))
      .catch(() => setCompleted(false));
  }, []);

  const handleStartEdit = async () => {
    setIsLoadingData(true);
    try {
      const response = await getSurveyResponse();
      setExistingResponse(response);
    } catch (err) {
      console.error('Failed to load previous survey response:', err);
    } finally {
      setIsLoadingData(false);
      setIsTakingSurvey(true);
    }
  };

  if (completed === null) {
    return <p className="p-8 text-slate-500 font-medium">Checking survey status...</p>;
  }

  // Active Survey / Edit View
  if (isTakingSurvey) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {existingResponse ? 'Edit Driving Background Survey' : 'Driving Background Survey'}
            </h1>
            <p className="text-sm text-slate-500">
              {existingResponse
                ? 'Update your previously submitted survey responses.'
                : 'Provide your driving background to help calibrate annotation metrics.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsTakingSurvey(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            Cancel
          </button>
        </header>

        <SurveyForm
          initialData={existingResponse}
          onSuccess={() => {
            setCompleted(true);
            setIsTakingSurvey(false);
            setExistingResponse(null);
          }}
        />
      </div>
    );
  }

  // Completed State View (Both buttons displayed)
  if (completed) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Survey Completed!</h1>
          <p className="text-slate-600 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            Thank you for completing the driving background survey. Your responses have been recorded and your annotator profile is up to date.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/annotator/videos')}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
            >
              Go to Tasks
            </button>
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={isLoadingData}
              className="px-6 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition disabled:opacity-50"
            >
              {isLoadingData ? 'Loading...' : 'Edit Survey'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-time Landing View
  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2 inline-block">
          Optional Survey
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Annotator Driving Background</h1>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Share your driving experience and familiar driving scenarios. This information helps us qualify video difficulty levels and tailor task distributions.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsTakingSurvey(true)}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            Take Survey
          </button>
          <button
            type="button"
            onClick={() => navigate('/annotator/videos')}
            className="px-6 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition"
          >
            Skip for Now
          </button>
        </div>
      </div>
    </div>
  );
}