import type { StepInfo } from "@/lib/voice/protocol";
import { cn } from "@/lib/utils";

/** The guide being shown: method, title and a clickable progress bar. The step text is in the 3D guide itself. */
export default function StepOverlay({ step, onSelect }: { step: StepInfo; onSelect: (index: number) => void }) {
  return (
    <section className="relative z-3 flex-none px-[max(16px,env(safe-area-inset-left))] pb-2" aria-label={`${step.title} – ${step.method}`}>
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <p className="text-xs font-bold tracking-[.08em] text-[#fb7185] uppercase">{step.method}</p>
        <h1 className="min-w-0 flex-1 text-base leading-[1.3] font-medium text-[#d4d4d8] max-[599px]:basis-full">{step.title}</h1>
        <p className="text-[13px] text-[#a1a1aa] tabular-nums">
          Bước {step.stepIndex + 1} / {step.totalSteps}
        </p>
      </div>
      <nav className="mt-1.5 flex gap-1" aria-label="Các bước">
        {Array.from({ length: step.totalSteps }, (_, index) => {
          const state = index === step.stepIndex ? "current" : index < step.stepIndex ? "done" : "todo";
          return (
            <button
              key={index}
              type="button"
              aria-label={`Bước ${index + 1}`}
              aria-current={index === step.stepIndex ? "step" : undefined}
              onClick={() => onSelect(index)}
              className="group flex h-6 flex-1 cursor-pointer items-center"
            >
              <span
                className={cn(
                  "block h-1 w-full rounded-sm transition-colors duration-200 group-hover:bg-white/40 motion-reduce:transition-none",
                  state === "current" ? "bg-[#e11d48]" : state === "done" ? "bg-[rgba(225,29,72,.4)]" : "bg-white/15",
                )}
              />
            </button>
          );
        })}
      </nav>
    </section>
  );
}
