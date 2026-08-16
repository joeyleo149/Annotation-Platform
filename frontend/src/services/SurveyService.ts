import api from './api';

export interface SurveyResponse {
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
}

export interface SurveyStatusResponse {
  hasCompletedSurvey: boolean;
}

export interface SubmitSurveyPayload extends SurveyResponse {}

export const getSurveyStatus = async (annotatorId?: number): Promise<SurveyStatusResponse> => {
  const url = annotatorId ? `/survey/status?annotatorId=${annotatorId}` : '/survey/status';
  const response: any = await api.get(url);
  return (response.data ?? response) as SurveyStatusResponse;
};

export const getSurveyResponse = async (annotatorId?: number): Promise<SurveyResponse> => {
  const url = annotatorId ? `/survey/response?annotatorId=${annotatorId}` : '/survey/response';
  const response: any = await api.get(url);
  return (response.data ?? response) as SurveyResponse;
};

export const submitSurvey = async (surveyData: SubmitSurveyPayload, annotatorId?: number) => {
  const url = annotatorId ? `/survey/submit?annotatorId=${annotatorId}` : '/survey/submit';
  const response: any = await api.post(url, surveyData);
  return response.data ?? response;
};