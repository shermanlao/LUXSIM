"use client";

import { useEffect, useRef, useState } from "react";
import {
  FALSE_COLOR_TEMPLATE_COPY,
  deleteTemplateBodyEn,
  deleteTemplateBodyZh,
  findFalseColorScaleTemplateByName,
  normalizeFalseColorTemplateName,
  type FalseColorScaleTemplate,
} from "@/lib/false-color-scale-templates";

function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useRef((...args: Parameters<T>) => ref.current(...args)).current as T;
}

export function FalseColorScaleSaveTemplateDialog({
  open,
  templates,
  onCancel,
  onSave,
}: {
  open: boolean;
  templates: readonly FalseColorScaleTemplate[];
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const onSaveStable = useStableCallback(onSave);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) return;
    if (justOpened) {
      setName("");
      setError(null);
      setComposing(false);
    }
    const focusTimer = justOpened
      ? window.setTimeout(() => inputRef.current?.focus(), 0)
      : undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      if (focusTimer != null) window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const willOverwrite = Boolean(trimmed && findFalseColorScaleTemplateByName(templates, trimmed));

  function submit() {
    if (composing) return;
    const parsed = normalizeFalseColorTemplateName(name);
    if (!parsed) {
      setError(FALSE_COLOR_TEMPLATE_COPY.emptyName);
      return;
    }
    onSaveStable(parsed);
  }

  return (
    <div className="falsecolor-template-backdrop" role="presentation" onClick={() => onCancelRef.current()}>
      <div
        className="falsecolor-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="falsecolor-template-save-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="falsecolor-template-save-title" className="display">
          {FALSE_COLOR_TEMPLATE_COPY.saveTitleEn}
        </h2>
        <p className="falsecolor-template-zh">{FALSE_COLOR_TEMPLATE_COPY.saveTitleZh}</p>
        <label className="label" htmlFor="falsecolor-template-name">
          {FALSE_COLOR_TEMPLATE_COPY.nameLabel}
        </label>
        <input
          ref={inputRef}
          id="falsecolor-template-name"
          className="input"
          value={name}
          placeholder={FALSE_COLOR_TEMPLATE_COPY.namePlaceholder}
          maxLength={80}
          autoComplete="off"
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false);
            setName(e.currentTarget.value);
            setError(null);
          }}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <p className="falsecolor-template-hint">
          {willOverwrite
            ? FALSE_COLOR_TEMPLATE_COPY.overwriteNowEn
            : FALSE_COLOR_TEMPLATE_COPY.overwriteHintEn}
        </p>
        <p className="falsecolor-template-hint falsecolor-template-zh">
          {willOverwrite
            ? FALSE_COLOR_TEMPLATE_COPY.overwriteNowZh
            : FALSE_COLOR_TEMPLATE_COPY.overwriteHintZh}
        </p>
        {error ? <p className="falsecolor-template-error">{error}</p> : null}
        <div className="falsecolor-template-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onCancelRef.current()}>
            {FALSE_COLOR_TEMPLATE_COPY.cancel}
          </button>
          <button type="button" className="btn" onClick={submit}>
            {FALSE_COLOR_TEMPLATE_COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FalseColorScaleDeleteTemplateDialog({
  open,
  templateName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  templateName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="falsecolor-template-backdrop" role="presentation" onClick={() => onCancelRef.current()}>
      <div
        className="falsecolor-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="falsecolor-template-delete-title"
        aria-describedby="falsecolor-template-delete-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="falsecolor-template-delete-title" className="display">
          {FALSE_COLOR_TEMPLATE_COPY.deleteTitleEn}
        </h2>
        <p className="falsecolor-template-zh">{FALSE_COLOR_TEMPLATE_COPY.deleteTitleZh}</p>
        <div id="falsecolor-template-delete-message">
          <p>{deleteTemplateBodyEn(templateName)}</p>
          <p className="falsecolor-template-zh">{deleteTemplateBodyZh(templateName)}</p>
        </div>
        <div className="falsecolor-template-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onCancelRef.current()}>
            {FALSE_COLOR_TEMPLATE_COPY.cancel}
          </button>
          <button type="button" className="btn btn-accent" onClick={() => onConfirmRef.current()}>
            {FALSE_COLOR_TEMPLATE_COPY.confirmDelete}
          </button>
        </div>
      </div>
    </div>
  );
}
