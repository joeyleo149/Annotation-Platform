import api from './api';
export interface QuestionDto { id: number; questionText: string; segmentNo: 1 | 2 | 3; isActive: boolean; }
export interface QuestionAnswerDto { segmentResponseId: number; questionId: number; answer: string; }
export async function getQuestions(includeInactive = false) { return (await api.get(`/questions?includeInactive=${includeInactive}`)).data as QuestionDto[]; }
export async function createQuestion(questionText: string, segmentNo: number) { return (await api.post('/questions', { questionText, segmentNo })).data as QuestionDto; }
export async function setQuestionActive(id: number, isActive: boolean) { return (await api.patch(`/questions/${id}/active`, { isActive })).data as QuestionDto; }
export async function getAnswersForSegment(segmentResponseId: number) { return (await api.get(`/question-answers?segmentResponseId=${segmentResponseId}`)).data as QuestionAnswerDto[]; }
export async function submitAnswer(payload: QuestionAnswerDto) { return (await api.post('/question-answers', payload)).data as QuestionAnswerDto; }
