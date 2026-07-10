"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** dim mono text on the right edge of the row (round no., country, team…) */
  hint?: string;
  disabled?: boolean;
}

interface SelectProps {
  /** tracked-caps label above the control */
  label?: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={className} aria-hidden>
    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
  </svg>
);

/**
 * The BoxBox dropdown: labeled control, paper listbox, mono hints.
 * Radix underneath — keyboard nav, type-ahead, collision-aware positioning.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, value, onValueChange, options, placeholder = "Select…", disabled, className = "" },
  ref,
) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {label && <span className="text-[10px] font-medium tracking-[0.22em] text-ink-3">{label}</span>}
      <RadixSelect.Root value={value ?? ""} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          ref={ref}
          className="group flex h-10 min-w-0 items-center gap-2.5 border border-ink/25 bg-paper px-3.5 text-left text-[13px] text-ink outline-none transition-colors hover:border-ink/60 focus-visible:border-red disabled:cursor-not-allowed disabled:opacity-40 data-[placeholder]:text-ink-3"
        >
          <span className="truncate">
            <RadixSelect.Value placeholder={placeholder} />
          </span>
          <RadixSelect.Icon className="ml-auto shrink-0 text-ink-3 transition-transform group-data-[state=open]:rotate-180">
            <Chevron />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            className="z-[60] max-h-[min(340px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[220px] overflow-hidden border border-ink/25 bg-paper shadow-[0_16px_40px_-12px_rgba(28,23,16,0.35)]"
          >
            <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center text-ink-3">
              <Chevron className="rotate-180" />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="panel-scroll p-1">
              {options.map((o) => (
                <RadixSelect.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="flex cursor-pointer items-baseline gap-3 px-3 py-2.5 text-[13px] text-ink-2 outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30 data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink data-[state=checked]:text-ink"
                >
                  <span className="hidden h-1.5 w-1.5 shrink-0 self-center bg-red [[data-state=checked]>&]:block" />
                  <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  {o.hint && <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wider text-ink-3">{o.hint}</span>}
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center text-ink-3">
              <Chevron />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
});
