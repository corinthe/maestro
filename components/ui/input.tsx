import { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const baseClass =
  "w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input ref={ref} className={`${baseClass} ${className}`} {...props} />
    );
  },
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className = "", ...props }, ref) {
    return (
      <textarea ref={ref} className={`${baseClass} ${className}`} {...props} />
    );
  },
);
