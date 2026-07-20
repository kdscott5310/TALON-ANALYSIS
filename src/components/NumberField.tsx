import { useEffect, useState } from 'react';

interface NumberFieldProps {
  label: string;
  unitLabel: string;
  tooltip: string;
  /** Value in display units */
  value: number;
  onChange: (displayValue: number) => void;
  step?: number;
}

/**
 * Numeric input that keeps local text state so users can type freely.
 * Non-numeric entries never reach the store; the field simply shows the
 * last committed value on blur.
 */
export function NumberField({ label, unitLabel, tooltip, value, onChange, step }: NumberFieldProps) {
  const [text, setText] = useState(String(round(value)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(round(value)));
  }, [value, focused]);

  function commit(raw: string) {
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed)) {
      onChange(parsed);
    } else {
      setText(String(round(value)));
    }
  }

  return (
    <label className="field" title={tooltip}>
      <span className="field-label">
        {label} <span className="field-unit">({unitLabel})</span>
      </span>
      <input
        type="number"
        step={step ?? 'any'}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </label>
  );
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
