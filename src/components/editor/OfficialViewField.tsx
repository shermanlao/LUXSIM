"use client";

import type { CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type OfficialViewValueProps = {
  value: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Non-editable value shown in place of an input when the project is view-only. */
export function OfficialViewValue({ value, className = "", style }: OfficialViewValueProps) {
  const text = value == null || value === "" ? "—" : value;
  return (
    <span className={`official-view-value ${className}`.trim()} style={style}>
      {text}
    </span>
  );
}

type OfficialMaybeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "readOnly"> & {
  readOnly?: boolean;
  displayValue?: ReactNode;
};

/** Editor input, or a text value when the visitor cannot edit. */
export function OfficialMaybeInput({
  readOnly = false,
  displayValue,
  className,
  style,
  value,
  ...rest
}: OfficialMaybeInputProps) {
  if (readOnly) {
    const shown =
      displayValue ??
      (value == null || value === "" ? "—" : String(value));
    return <OfficialViewValue value={shown} className={className} style={style} />;
  }
  return <input className={className} style={style} value={value} {...rest} />;
}

type OfficialMaybeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  readOnly?: boolean;
  displayValue?: ReactNode;
};

export function OfficialMaybeSelect({
  readOnly = false,
  displayValue,
  className,
  style,
  value,
  children,
  ...rest
}: OfficialMaybeSelectProps) {
  if (readOnly) {
    const shown =
      displayValue ??
      (value == null || value === "" ? "—" : String(value));
    return <OfficialViewValue value={shown} className={className} style={style} />;
  }
  return (
    <select className={className} style={style} value={value} {...rest}>
      {children}
    </select>
  );
}

type OfficialMaybeCheckboxProps = {
  readOnly?: boolean;
  checked: boolean;
  onChange?: (event: { target: { checked: boolean } }) => void;
  label?: ReactNode;
  className?: string;
};

/** View toggle stays a checkbox; a locked checkbox is shown as yes/no text. */
export function OfficialMaybeCheckbox({
  readOnly = false,
  checked,
  onChange,
  label,
  className = "",
}: OfficialMaybeCheckboxProps) {
  if (readOnly) {
    return (
      <span className={`official-view-check ${className}`.trim()}>
        {label ? <span>{label}: </span> : null}
        <OfficialViewValue value={checked ? "On" : "Off"} />
      </span>
    );
  }
  return (
    <label className={className}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
