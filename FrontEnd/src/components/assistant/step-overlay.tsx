import type { StepInfo } from "@/lib/voice/protocol";

/** The guide being shown: method, title and a clickable progress bar. The step text is in the 3D guide itself. */
export default function StepOverlay({ step, onSelect }: { step: StepInfo; onSelect: (index: number) => void }) {
  return (
    <section className="fa-step" aria-label={`${step.title} – ${step.method}`}>
      <div className="fa-step-head">
        <p className="fa-step-method">{step.method}</p>
        <h1 className="fa-step-title">{step.title}</h1>
        <p className="fa-step-count">
          Bước {step.stepIndex + 1} / {step.totalSteps}
        </p>
      </div>
      <nav className="fa-step-bar" aria-label="Các bước">
        {Array.from({ length: step.totalSteps }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Bước ${index + 1}`}
            aria-current={index === step.stepIndex ? "step" : undefined}
            onClick={() => onSelect(index)}
          >
            <span data-state={index === step.stepIndex ? "current" : index < step.stepIndex ? "done" : "todo"} />
          </button>
        ))}
      </nav>
    </section>
  );
}
