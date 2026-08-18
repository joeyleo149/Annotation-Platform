import { useEffect, useState, type FormEvent } from 'react';
import { createQuestion, getQuestions, setQuestionActive, type QuestionDto } from '../services/Questionanswerservice';

const segmentDescriptions = { 1: 'Ask after the first 4 seconds have played.', 2: 'Ask after 3 additional seconds have played (at 7 seconds).', 3: 'Ask after the video has finished playing.' } as const;

type QuestionPageProps = {
  selectedDatasetId: number | null;
  selectedDatasetName?: string | null;
  onBack?: () => void;
  onAddQuestion?: () => void;
};

export function AddQuestionPage({ selectedDatasetId, selectedDatasetName, onBack }: QuestionPageProps) {
  const [questionText, setQuestionText] = useState(''); const [segmentNo, setSegmentNo] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedDatasetId) {
      setError('Select a dataset before adding a question.');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');

    try {
      await createQuestion(questionText, segmentNo, selectedDatasetId);
      setQuestionText('');
      setMessage(`Question added to ${selectedDatasetName ?? 'the selected dataset'} and activated successfully.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add question.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="question-admin-card"><div className="question-list-heading"><div><h2>Add Question</h2><p>{selectedDatasetId ? `Create a question for ${selectedDatasetName ?? 'the selected dataset'} at the selected segment number.` : 'Select a dataset to attach the question to.'}</p></div>{onBack ? <button type="button" className="secondary-button" onClick={onBack}>← Back to Questions</button> : null}</div>
    {!selectedDatasetId ? <p className="notice error" role="alert">Pick a dataset from the dashboard selector before creating a question.</p> : null}
    <form className="question-form" onSubmit={submit}>
      <label>Question text<textarea value={questionText} onChange={event => setQuestionText(event.target.value)} maxLength={1000} required placeholder="Enter the question annotators should answer" /></label>
      <label>Segment number<select value={segmentNo} onChange={event => setSegmentNo(Number(event.target.value) as 1 | 2 | 3)}><option value="1">1 — After 4 seconds</option><option value="2">2 — After 7 seconds</option><option value="3">3 — When video finishes</option></select><small>{segmentDescriptions[segmentNo]}</small></label>
      {selectedDatasetId ? <small className="dataset-tag">Applies to: {selectedDatasetName ?? `dataset ${selectedDatasetId}`}</small> : null}
      {error ? <p className="notice error" role="alert">{error}</p> : null}{message ? <p className="notice success" role="status">{message}</p> : null}<button className="primary-button" disabled={busy || !selectedDatasetId}>{busy ? 'Adding question…' : 'Add Question'}</button>
    </form></section>;
}

export function QuestionsPage({ selectedDatasetId, selectedDatasetName, onAddQuestion }: QuestionPageProps) {
  const [questions, setQuestions] = useState<QuestionDto[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    if (!selectedDatasetId) {
      setQuestions([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    getQuestions(true, selectedDatasetId)
      .then(setQuestions)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to load questions.'))
      .finally(() => setLoading(false));
  }, [selectedDatasetId]);

  async function toggle(question: QuestionDto) {
    try {
      const updated = await setQuestionActive(question.id, !question.isActive);
      setQuestions(items => items.map(item => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update question.');
    }
  }

  return <section className="question-admin-card"><div className="question-list-heading"><div><h2>Questions</h2><p>{selectedDatasetId ? `Inactive questions for ${selectedDatasetName ?? 'the selected dataset'} keep their historical answers but will not appear in future annotations.` : 'Select a dataset to view its questions.'}</p></div><div className="question-list-heading-actions"><span>{selectedDatasetId ? `${questions.length} total` : '0 total'}</span>{onAddQuestion ? <button type="button" className="primary-button" onClick={onAddQuestion}>+ Add Question</button> : null}</div></div>{error ? <p className="notice error" role="alert">{error}</p> : null}
    {!selectedDatasetId ? <p className="empty-state">Choose a dataset to review its question set.</p> : loading ? <p className="loading-state">Loading questions…</p> : <div className="question-list">{questions.map(question => <article key={question.id}><div><span className="question-segment">Segment {question.segmentNo}</span><strong>{question.questionText}</strong><small>{segmentDescriptions[question.segmentNo]}</small></div><button className={question.isActive ? 'deactivate-question' : 'activate-question'} onClick={() => void toggle(question)}>{question.isActive ? 'Make inactive' : 'Activate'}</button></article>)}{questions.length === 0 ? <p className="empty-state">No questions have been added for this dataset.</p> : null}</div>}
  </section>;
}
