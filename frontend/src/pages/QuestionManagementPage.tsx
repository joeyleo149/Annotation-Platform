import { useEffect, useState, type FormEvent } from 'react';
import { createQuestion, getQuestions, setQuestionActive, type QuestionDto } from '../services/Questionanswerservice';

const segmentDescriptions = { 1: 'Ask after the first 4 seconds have played.', 2: 'Ask after 3 additional seconds have played (at 7 seconds).', 3: 'Ask after the video has finished playing.' } as const;

export function AddQuestionPage() {
  const [questionText, setQuestionText] = useState(''); const [segmentNo, setSegmentNo] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(''); setError(''); try { await createQuestion(questionText, segmentNo); setQuestionText(''); setMessage('Question added and activated successfully.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add question.'); } finally { setBusy(false); } }
  return <section className="question-admin-card"><h2>Add Question</h2><p>Create a question for every future segment response at the selected segment number.</p><form className="question-form" onSubmit={submit}>
    <label>Question text<textarea value={questionText} onChange={event => setQuestionText(event.target.value)} maxLength={1000} required placeholder="Enter the question annotators should answer" /></label>
    <label>Segment number<select value={segmentNo} onChange={event => setSegmentNo(Number(event.target.value) as 1 | 2 | 3)}><option value="1">1 — After 4 seconds</option><option value="2">2 — After 7 seconds</option><option value="3">3 — When video finishes</option></select><small>{segmentDescriptions[segmentNo]}</small></label>
    {error ? <p className="notice error" role="alert">{error}</p> : null}{message ? <p className="notice success" role="status">{message}</p> : null}<button className="primary-button" disabled={busy}>{busy ? 'Adding question…' : 'Add Question'}</button>
  </form></section>;
}

export function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionDto[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { getQuestions(true).then(setQuestions).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load questions.')).finally(() => setLoading(false)); }, []);
  async function toggle(question: QuestionDto) { try { const updated = await setQuestionActive(question.id, !question.isActive); setQuestions(items => items.map(item => item.id === updated.id ? updated : item)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update question.'); } }
  return <section className="question-admin-card"><div className="question-list-heading"><div><h2>Questions</h2><p>Inactive questions keep their historical answers but will not appear in future annotations.</p></div><span>{questions.length} total</span></div>{error ? <p className="notice error" role="alert">{error}</p> : null}
    {loading ? <p className="loading-state">Loading questions…</p> : <div className="question-list">{questions.map(question => <article key={question.id}><div><span className="question-segment">Segment {question.segmentNo}</span><strong>{question.questionText}</strong><small>{segmentDescriptions[question.segmentNo]}</small></div><button className={question.isActive ? 'deactivate-question' : 'activate-question'} onClick={() => void toggle(question)}>{question.isActive ? 'Make inactive' : 'Activate'}</button></article>)}{questions.length === 0 ? <p className="empty-state">No questions have been added.</p> : null}</div>}
  </section>;
}
