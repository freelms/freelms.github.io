import { useCallback, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface AsyncButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  onPress: () => void | Promise<void>;
  children: ReactNode;
}

/**
 * Button that disables itself + shows a spinner while its async handler runs.
 * Prevents double-clicks / duplicate Firestore writes.
 */
export function AsyncButton({ onPress, children, disabled, className, ...rest }: AsyncButtonProps) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onPress();
    } finally {
      setBusy(false);
    }
  }, [busy, onPress]);

  return (
    <button {...rest} disabled={disabled || busy} onClick={run} className={`${className ?? ''} ${busy ? 'cursor-wait opacity-70' : ''}`}>
      {busy && (
        <span className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}
