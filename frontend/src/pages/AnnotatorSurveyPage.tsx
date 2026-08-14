import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SurveyForm } from '../components/SurveyForm';
import { getSurveyStatus } from '../services/SurveyService';

export function AnnotatorSurveyPage() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<boolean | null>(null);
  useEffect(() => { getSurveyStatus().then(x => setCompleted(x.hasCompletedSurvey)).catch(() => setCompleted(false)); }, []);
  if (completed === null) return <p className="p-8">Checking eligibility status...</p>;
  if (completed) return <section className="dashboard-view"><h1>Survey completed</h1><p>Your annotation workspace is unlocked.</p><button onClick={() => navigate('/workspace')}>Go to workspace</button></section>;
  return <div className="max-w-3xl mx-auto"><header className="text-center mb-8"><h1 className="text-3xl font-bold">Driving history survey</h1><p>Complete the required survey to unlock your workspace.</p></header><SurveyForm onSuccess={() => navigate('/workspace', { replace: true })} /></div>;
}
