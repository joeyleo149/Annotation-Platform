import api from './api';

export type SubmitSurveyPayload = {
  hasDriverLicense: boolean;
  yearsOfDrivingExperience: number;
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

export type SurveyStatus = { hasCompletedSurvey: boolean };
export async function submitSurvey(surveyData: SubmitSurveyPayload) {
  return (await api.post('/survey/submit', surveyData)).data;
}
export async function getSurveyStatus() {
  return (await api.get('/survey/status')).data as SurveyStatus;
}
