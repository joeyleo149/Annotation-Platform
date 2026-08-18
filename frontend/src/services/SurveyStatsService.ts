import { adminApi } from './adminApi';

export interface StatCountGroup {
  label: string;
  count: number;
  percentage: number;
}

export interface SurveyStatsData {
  totalResponses: number;
  licenseHolderPercentage: number;
  topCountries: StatCountGroup[];
  drivingFrequencyDistribution: StatCountGroup[];
  scenarioPrevalence: Record<string, number>;
  priorAnnotationExperiencePercentage: number;
  accidentHistoryPercentage: number;
  averageAge: number;
  averageYearsExperience: number;
}

export const fetchSurveyStatistics = async (): Promise<SurveyStatsData> => {
  return await adminApi.getSurveyStats<SurveyStatsData>();
};