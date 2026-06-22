'use client';

import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  return (
    <div className={`flex items-start gap-0 ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.label} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-accent-cyan text-white shadow-sm'
                    : isCurrent
                    ? 'bg-accent-cyan text-white ring-4 ring-accent-cyan/20'
                    : 'bg-dark-700 text-dark-400'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <div className="mt-2 text-center min-w-0">
                <p className={`text-xs font-medium leading-tight ${
                  isCurrent ? 'text-accent-cyan' : isCompleted ? 'text-dark-200' : 'text-dark-500'
                }`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-[11px] text-dark-500 mt-0.5 leading-tight">{step.description}</p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-3 pt-[14px]">
                <div className={`h-0.5 rounded-full transition-colors duration-200 ${
                  isCompleted ? 'bg-accent-cyan' : 'bg-dark-700'
                }`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}