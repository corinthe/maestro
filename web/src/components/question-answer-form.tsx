import { useState } from "react";
import { answerQuestions } from "../services/api-client";

interface QuestionAnswerFormProps {
  taskId: string;
  questions: string[];
  onSubmit: () => void;
}

export function QuestionAnswerForm({ taskId, questions, onSubmit }: QuestionAnswerFormProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((_, i) => (answers[i] ?? "").trim().length > 0);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const formattedAnswers = questions.map((question, i) => ({
        question,
        answer: answers[i] ?? "",
      }));
      await answerQuestions(taskId, formattedAnswers);
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="question-form">
      {questions.map((question, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{question}</div>
          <textarea
            className="input"
            value={answers[i] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
            placeholder="Votre reponse..."
            rows={2}
            style={{ width: "100%", fontSize: 13, resize: "vertical" }}
          />
        </div>
      ))}

      {error && <div className="error-message" style={{ marginBottom: 8 }}>{error}</div>}

      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting || !allAnswered}
      >
        {submitting ? "Envoi en cours..." : "Envoyer les reponses"}
      </button>
    </div>
  );
}
