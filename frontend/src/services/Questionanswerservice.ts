import api from './api';

export interface QuestionDto {
  id: number;
  datasetId?: number | null;
  questionText: string;
  segmentNo: 1 | 2 | 3;
  isActive: boolean;
}

export interface QuestionAnswerDto {
  segmentResponseId: number;
  questionId: number;
  answer: string;
}


export async function getQuestions(
  includeInactive = false,
  datasetId?: number | null,
  sessionId?: number | null,
): Promise<QuestionDto[]> {
  const params = new URLSearchParams({
    includeInactive: String(includeInactive),
  });

  if (datasetId !== undefined && datasetId !== null) {
    params.set('datasetId', String(datasetId));
  }

  if (sessionId !== undefined && sessionId !== null) {
    params.set('sessionId', String(sessionId));
  }

  const response = await api.get(
    `/questions?${params.toString()}`,
  );

  return response.data as QuestionDto[];
}

export async function createQuestion(
  questionText: string,
  segmentNo: number,
  datasetId: number,
): Promise<QuestionDto> {
  const response = await api.post('/questions', {
    datasetId,
    questionText,
    segmentNo,
  });

  return response.data as QuestionDto;
}

export async function setQuestionActive(
  id: number,
  isActive: boolean,
): Promise<QuestionDto> {
  const response = await api.patch(
    `/questions/${id}/active`,
    { isActive },
  );

  return response.data as QuestionDto;
}

export async function getAnswersForSegment(
  segmentResponseId: number,
): Promise<QuestionAnswerDto[]> {
  const response = await api.get(
    `/question-answers?segmentResponseId=${segmentResponseId}`,
  );

  return response.data as QuestionAnswerDto[];
}

export async function submitAnswer(
  payload: QuestionAnswerDto,
): Promise<QuestionAnswerDto> {
  const response = await api.post(
    '/question-answers',
    payload,
  );

  return response.data as QuestionAnswerDto;
}


export async function updateAnswer(
  segmentResponseId: number,
  questionId: number,
  answer: string,
): Promise<QuestionAnswerDto> {
  const response = await api.put(
    `/question-answers/${segmentResponseId}/${questionId}`,
    { answer },
  );

  return response.data as QuestionAnswerDto;
}