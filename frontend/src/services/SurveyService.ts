// frontend/src/services/SurveyService.ts
import api from './api';

export type SubmitSurveyPayload = {
  hasDriverLicense: boolean;
  primaryDrivingCountry: string;
  drivingFrequency: string;
  drivingScenarioNighttime: boolean;
  drivingScenarioSnowyWeather: boolean;
  drivingScenarioHeavyRain: boolean;
  drivingScenarioConstructionZone: boolean;
  drivingScenarioNone: boolean;
  hasPriorDatasetAnnotationExperience: boolean;
  hasAccidentsInLastFiveYears: boolean;
};

// 1. Calls POST /api/survey/submit?annotatorId={id}
export const submitSurvey = async (annotatorId: number, surveyData: SubmitSurveyPayload) => {
  const res = await api.post(`/survey/submit?annotatorId=${annotatorId}`, surveyData);
  return res.data;
};

// 2. Calls GET /api/survey/status?annotatorId={id}
export const getSurveyStatus = async (annotatorId: number) => {
  const res = await api.get(`/survey/status?annotatorId=${annotatorId}`);
  return res.data;
};