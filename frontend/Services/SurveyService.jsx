import api from './api';

/**
 * Checks whether the logged-in annotator has completed the background survey.
 * 
 * @param {number} annotatorId - The ID of the logged-in annotator.
 * @returns {Promise<{ annotatorId: number, hasCompletedSurvey: boolean }>}
 */
export const getSurveyStatus = async (annotatorId) => {
  const response = await api.get('/survey/status', {
    params: { annotatorId }
  });
  return response.data;
};

/**
 * Submits the survey responses to unlock the annotation workspace.
 * 
 * @param {number} annotatorId - The ID of the logged-in annotator.
 * @param {Object} surveyData - The survey response object matching AnnotatorSurvey fields.
 * @returns {Promise<{ message: string }>}
 */
export const submitSurvey = async (annotatorId, surveyData) => {
  const response = await api.post('/survey/submit', surveyData, {
    params: { annotatorId }
  });
  return response.data;
};