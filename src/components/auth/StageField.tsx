import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { focusRing } from '../stage/tokens';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
};

// Label above, error below, never placeholder-as-label. Password fields get a reveal toggle.
export const StageField = forwardRef<HTMLInputElement, Props>(function StageField(
  { id, label, error, type = 'text', className = '', ...rest },
  ref
) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-stage-ivory">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-12 w-full rounded-2xl bg-stage-velvet px-4 text-base text-stage-ivory ring-1 ring-inset transition-shadow duration-150 placeholder:text-stage-muted/70 focus:outline-none focus:ring-2 focus:ring-stage-gold ${
            error ? 'ring-stage-alert/70' : 'ring-stage-line'
          } ${isPassword ? 'pr-12' : ''} ${className}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className={`absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full text-stage-muted transition-colors hover:text-stage-ivory ${focusRing}`}
          >
            {reveal ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-stage-alert">
          {error}
        </p>
      )}
    </div>
  );
});
