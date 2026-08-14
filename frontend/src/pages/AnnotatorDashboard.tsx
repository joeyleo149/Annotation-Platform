import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSurveyStatus } from '../services/SurveyService';

interface Task {
  id: string;
  name: string;
  duration: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  reward: string;
}

const SAMPLE_TASKS: Task[] = [
  { id: 'TASK-101', name: 'Urban Intersection 3D Bounding Boxes', duration: '12 mins', difficulty: 'Medium', reward: '$14.00' },
  { id: 'TASK-102', name: 'Highway Nighttime Lane Tracking', duration: '8 mins', difficulty: 'Easy', reward: '$9.50' },
  { id: 'TASK-103', name: 'Construction Zone Obstacle Segments', duration: '20 mins', difficulty: 'Hard', reward: '$22.00' },
];

export const AnnotatorDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);
  const annotatorId = Number(localStorage.getItem('userId') || '3');

 // 1. Add this interface near the top of AnnotatorDashboard.tsx (or import it)
interface SurveyStatusResponse {
  hasCompletedSurvey: boolean;
}

// 2. Update your useEffect:
useEffect(() => {
  const fetchStatus = async () => {
    try {
      const res = (await getSurveyStatus(annotatorId)) as SurveyStatusResponse;
      setHasCompleted(res.hasCompletedSurvey);
    } catch (e) {
      console.error('Status fetch error:', e);
    } finally {
      setLoading(false);
    }
  };
  fetchStatus();
}, [annotatorId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Workspace Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Annotator Workspace</h1>
            {hasCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active & Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Survey Required
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">Review autonomous driving video streams and label ground truth objects.</p>
        </div>

        {!hasCompleted && (
          <Link
            to="/survey"
            className="py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all text-center flex items-center justify-center gap-2"
          >
            Take Survey Now
            <span>→</span>
          </Link>
        )}
      </div>

      {/* Yellow Gating Alert Banner */}
      {!hasCompleted && (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-200/80 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold">
              ⚠️
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Annotation Gated: Complete Survey</h3>
              <p className="text-xs text-amber-800 mt-0.5 max-w-xl leading-relaxed">
                Before accessing tasks, safety regulations require all annotators to provide their driving background and experience profile.
              </p>
            </div>
          </div>
          <Link
            to="/survey"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap"
          >
            Unlock Tasks
          </Link>
        </div>
      )}

      {/* Task Queue Table / Card List */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Available Tasks</h2>
          <span className="text-xs font-semibold text-slate-400">{SAMPLE_TASKS.length} tasks in queue</span>
        </div>

        <div className="divide-y divide-slate-100">
          {SAMPLE_TASKS.map((task) => (
            <div key={task.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {task.id}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">{task.name}</h3>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
                  <span>⏱️ {task.duration}</span>
                  <span>•</span>
                  <span>💰 {task.reward}</span>
                  <span>•</span>
                  <span className={`font-semibold ${
                    task.difficulty === 'Easy' ? 'text-emerald-600' : task.difficulty === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {task.difficulty}
                  </span>
                </div>
              </div>

              <div>
                {hasCompleted ? (
                  <button
                    onClick={() => alert(`Starting ${task.id}`)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition"
                  >
                    Start Annotation
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl cursor-not-allowed border border-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <span>🔒</span> Locked (Survey Required)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};