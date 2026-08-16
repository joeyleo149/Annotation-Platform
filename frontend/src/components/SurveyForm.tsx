import React, { useState, useMemo, useRef, useEffect } from 'react';
import { submitSurvey, type SubmitSurveyPayload, type SurveyResponse } from '../services/SurveyService';
// If countries.ts is in frontend/src/data/countries.ts:
import { COUNTRIES } from '../data/countries';
// (Note: If countries.ts is located in frontend/data/countries.ts, use '../../data/countries')

interface SurveyFormProps {
  onSuccess: () => void;
  initialData?: SurveyResponse | null;
}

const DRIVING_FREQUENCIES = [
  { id: "Daily", title: "Daily / Near Daily", desc: "5–7 days per week" },
  { id: "Regular", title: "Regular Driver", desc: "2–4 days per week" },
  { id: "Occasional", title: "Occasional Driver", desc: "1–3 days per month" },
  { id: "Infrequent", title: "Infrequent Driver", desc: "A few times per year" },
  { id: "Inactive", title: "Inactive / Non-Driver", desc: "Licensed, but never driven" }
];

export const SurveyForm: React.FC<SurveyFormProps> = ({ onSuccess, initialData }) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form State
  const [hasDriverLicense, setHasDriverLicense] = useState<boolean | null>(null);
  const [yearsOfDrivingExperience, setYearsOfDrivingExperience] = useState<number>(0);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState<boolean>(false);
  const [drivingFrequency, setDrivingFrequency] = useState<string>('');
  
  // Scenarios
  const [scenarioNighttime, setScenarioNighttime] = useState<boolean>(false);
  const [scenarioSnowy, setScenarioSnowy] = useState<boolean>(false);
  const [scenarioRain, setScenarioRain] = useState<boolean>(false);
  const [scenarioConstruction, setScenarioConstruction] = useState<boolean>(false);
  const [scenarioNone, setScenarioNone] = useState<boolean>(false);

  // Background
  const [hasPriorExperience, setHasPriorExperience] = useState<boolean | null>(null);
  const [hasAccidents, setHasAccidents] = useState<boolean | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setHasDriverLicense(initialData.hasDriverLicense);
      setYearsOfDrivingExperience(initialData.yearsOfDrivingExperience);
      setSelectedCountry(initialData.primaryDrivingCountry);
      setCountrySearch(initialData.primaryDrivingCountry);
      setDrivingFrequency(initialData.drivingFrequency);
      setScenarioNighttime(initialData.drivingScenarioNighttime);
      setScenarioSnowy(initialData.drivingScenarioSnowyWeather);
      setScenarioRain(initialData.drivingScenarioHeavyRain);
      setScenarioConstruction(initialData.drivingScenarioConstructionZone);
      setScenarioNone(initialData.drivingScenarioNone);
      setHasPriorExperience(initialData.hasPriorDatasetAnnotationExperience);
      setHasAccidents(initialData.hasAccidentsInLastFiveYears);
    }
  }, [initialData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter against the full global country list
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const term = countrySearch.toLowerCase();
    return COUNTRIES.filter((c) => c.toLowerCase().includes(term));
  }, [countrySearch]);
  const handleScenarioChange = (type: 'night' | 'snow' | 'rain' | 'construction' | 'none') => {
    if (type === 'none') {
      const nextNone = !scenarioNone;
      setScenarioNone(nextNone);
      if (nextNone) {
        setScenarioNighttime(false);
        setScenarioSnowy(false);
        setScenarioRain(false);
        setScenarioConstruction(false);
      }
    } else {
      setScenarioNone(false);
      if (type === 'night') setScenarioNighttime(!scenarioNighttime);
      if (type === 'snow') setScenarioSnowy(!scenarioSnowy);
      if (type === 'rain') setScenarioRain(!scenarioRain);
      if (type === 'construction') setScenarioConstruction(!scenarioConstruction);
    }
  };

  const validateStep1 = () => {
    if (hasDriverLicense === null) {
      setErrorMessage('Please select whether you hold a valid driving license.');
      return false;
    }
    if (yearsOfDrivingExperience < 0 || yearsOfDrivingExperience > 100) {
      setErrorMessage('Years of driving experience must be between 0 and 100.');
      return false;
    }
    if (!hasDriverLicense && yearsOfDrivingExperience > 0) {
      setErrorMessage('Enter 0 years when you do not hold a driving license.');
      return false;
    }
    if (!selectedCountry) {
      setErrorMessage('Please choose your primary driving country.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep2 = () => {
    if (!drivingFrequency) {
      setErrorMessage('Please choose your driving frequency.');
      return false;
    }
    const hasSelected = scenarioNighttime || scenarioSnowy || scenarioRain || scenarioConstruction || scenarioNone;
    if (!hasSelected) {
      setErrorMessage('Please choose at least one scenario or "None of the above".');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep3 = () => {
    if (hasPriorExperience === null) {
      setErrorMessage('Please answer the dataset annotation experience question.');
      return false;
    }
    if (hasAccidents === null) {
      setErrorMessage('Please answer the road accident history question.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    setErrorMessage('');
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    if (hasDriverLicense === null || hasPriorExperience === null || hasAccidents === null) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const payload: SubmitSurveyPayload = {
      hasDriverLicense,
      yearsOfDrivingExperience,
      primaryDrivingCountry: selectedCountry,
      drivingFrequency,
      drivingScenarioNighttime: scenarioNighttime,
      drivingScenarioSnowyWeather: scenarioSnowy,
      drivingScenarioHeavyRain: scenarioRain,
      drivingScenarioConstructionZone: scenarioConstruction,
      drivingScenarioNone: scenarioNone,
      hasPriorDatasetAnnotationExperience: hasPriorExperience,
      hasAccidentsInLastFiveYears: hasAccidents
    };

    try {
      await submitSurvey(payload);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card w-full rounded-none p-8 sm:p-10 transition-all bg-white border border-slate-200 rounded-3xl shadow-sm">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Step {step} of 3
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {step === 1 && 'License & Location'}
            {step === 2 && 'Driving Background'}
            {step === 3 && 'Experience & Safety'}
          </span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium flex items-center gap-2.5">
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              1. Do you hold a valid driving license?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: true, label: 'Yes' },
                { val: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setHasDriverLicense(opt.val)}
                  className={`py-3.5 px-4 rounded-xl font-semibold text-sm border transition-all ${
                    hasDriverLicense === opt.val
                      ? 'border-blue-600 bg-blue-50/60 text-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="years-driving" className="block text-sm font-bold text-slate-900 mb-2">
              2. How many years of driving experience do you have?
            </label>
            <input id="years-driving" type="number" min="0" max="100" required
              value={yearsOfDrivingExperience}
              onChange={(e) => setYearsOfDrivingExperience(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm" />
          </div>

          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-bold text-slate-900 mb-2">
              3. What is the main country you drive in?
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type or select country..."
                value={countrySearch}
                onFocus={() => setIsCountryDropdownOpen(true)}
                onChange={(e) => {
                  setCountrySearch(e.target.value);
                  setSelectedCountry(e.target.value);
                  setIsCountryDropdownOpen(true);
                }}
                className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm"
              />
            </div>

            {isCountryDropdownOpen && (
              <ul className="absolute z-20 w-full mt-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl text-sm divide-y divide-slate-50 py-1">
                {filteredCountries.map((c) => (
                  <li
                    key={c}
                    onClick={() => {
                      setSelectedCountry(c);
                      setCountrySearch(c);
                      setIsCountryDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 hover:bg-blue-50 hover:text-blue-600 cursor-pointer text-slate-700 font-medium transition flex items-center justify-between"
                  >
                    <span>{c}</span>
                    {selectedCountry === c && <span className="text-blue-600 text-xs">✓</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              3. How often do you drive?
            </label>
            <div className="space-y-2.5">
              {DRIVING_FREQUENCIES.map((freq) => (
                <label
                  key={freq.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                    drivingFrequency === freq.title
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="drivingFrequency"
                      value={freq.title}
                      checked={drivingFrequency === freq.title}
                      onChange={() => setDrivingFrequency(freq.title)}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-800">{freq.title}</span>
                  </div>
                  <span className="text-xs text-slate-400">{freq.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              4. Have you ever driven in any of these scenarios?
            </label>
            <p className="text-xs text-slate-500 mb-3">Select all that apply.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: 'night', label: 'Nighttime', state: scenarioNighttime },
                { id: 'snow', label: 'Snowy weather', state: scenarioSnowy },
                { id: 'rain', label: 'Heavy rain', state: scenarioRain },
                { id: 'construction', label: 'Construction zone', state: scenarioConstruction },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                    opt.state
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={opt.state}
                    onChange={() => handleScenarioChange(opt.id as any)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
              <div className="sm:col-span-2">
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                    scenarioNone
                      ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scenarioNone}
                    onChange={() => handleScenarioChange('none')}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span>None of the above</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              5. Have you ever annotated datasets related to autonomous driving? (eg. KITScenes,NUScenes, etc.)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setHasPriorExperience(val)}
                  className={`py-3.5 px-4 rounded-xl font-semibold text-sm border transition-all ${
                    hasPriorExperience === val
                      ? 'border-blue-600 bg-blue-50/60 text-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">
              6. Have you been involved in any road accidents?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setHasAccidents(val)}
                  className={`py-3.5 px-4 rounded-xl font-semibold text-sm border transition-all ${
                    hasAccidents === val
                      ? 'border-blue-600 bg-blue-50/60 text-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {val ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="py-3 px-5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Back
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="py-3.5 px-7 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm ml-auto"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="py-3.5 px-7 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm ml-auto disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Submit Survey'}
          </button>
        )}
      </div>
    </div>
  );
};