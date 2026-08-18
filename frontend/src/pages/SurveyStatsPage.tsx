import { useEffect, useState } from 'react';
import { fetchSurveyStatistics, type SurveyStatsData } from '../services/SurveyStatsService';

export default function SurveyStatsPage() {
  const [stats, setStats] = useState<SurveyStatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSurveyStatistics()
      .then((data) => setStats(data))
      .catch((err) => console.error('Failed to load metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-8 text-slate-500 font-medium">Computing aggregate metrics...</p>;
  }

  if (!stats || stats.totalResponses === 0) {
    return (
      <section className="dashboard-view p-6">
        <h1 className="text-2xl font-bold text-slate-900">Survey Statistics</h1>
        <p className="text-slate-400 mt-2">
          No survey metrics are currently available. Check back once annotators begin participating.
        </p>
      </section>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <header className="dashboard-view">
        <p className="dashboard-kicker">Platform Analytics</p>
        <h1 className="text-2xl font-bold text-slate-900">Survey Metrics Overview</h1>
        <p className="text-slate-500 text-sm">
          Review demographic attributes and driving backgrounds across the annotator pool.
        </p>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Respondents</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalResponses}</p>
        </div>
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Pool Age</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {stats.averageAge} <span className="text-xs text-slate-400 font-normal">yrs</span>
          </p>
        </div>
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Driving Experience</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {stats.averageYearsExperience} <span className="text-xs text-slate-400 font-normal">yrs</span>
          </p>
        </div>
        <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">License Holders</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.licenseHolderPercentage}%</p>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Driving Frequency Distribution */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h2 className="font-bold text-base text-slate-900 mb-4">Driving Frequency Distribution</h2>
          <div className="space-y-4">
            {stats.drivingFrequencyDistribution.map((freq) => (
              <div key={freq.label} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{freq.label}</span>
                  <span className="text-slate-500">{freq.count} ({freq.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${freq.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Scenario Exposure */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h2 className="font-bold text-base text-slate-900 mb-4">Scenario Exposure Count</h2>
          <div className="space-y-4">
            {Object.entries(stats.scenarioPrevalence).map(([scenario, count]) => {
              const percentage = Math.round((count / stats.totalResponses) * 100);
              return (
                <div key={scenario} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{scenario}</span>
                    <span className="text-slate-500">{count} annotators</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Operational Countries */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <h2 className="font-bold text-base text-slate-900 mb-4">Top Primary Driving Regions</h2>
          <div className="divide-y divide-slate-100">
            {stats.topCountries.map((country, index) => (
              <div key={country.label} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-400 flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-slate-800">{country.label}</span>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {country.count} ({country.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Qualification & Safety Indicators */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <h2 className="font-bold text-base text-slate-900 mb-4">Qualification Summary</h2>
          <div className="grid grid-cols-2 gap-4 my-auto">
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl text-center">
              <p className="text-2xl font-black text-slate-800">{stats.priorAnnotationExperiencePercentage}%</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Prior AV Annotation Experience</p>
            </div>
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl text-center">
              <p className="text-2xl font-black text-rose-600">{stats.accidentHistoryPercentage}%</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Accidents</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-4 italic">
            Calculated in real-time from active annotator survey records.
          </p>
        </section>
      </div>
    </div>
  );
}