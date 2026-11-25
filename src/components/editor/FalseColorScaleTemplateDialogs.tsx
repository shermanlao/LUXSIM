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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = name.trim();
  const willOverwrite = Boolean(trimmed && findFalseColorScaleTemplateByName(templates, trimmed));

  function submit() {
    const parsed = normalizeFalseColorTemplateName(name);
    if (!parsed) {
      setError(FALSE_COLOR_TEMPLATE_COPY.emptyName);
      return;
    }
    onSave(parsed);
  }

  return (
    <div className="falsecolor-template-backdrop" role="presentation" onClick={onCancel}>
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
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="falsecolor-template-backdrop" role="presentation" onClick={onCancel}>
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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {FALSE_COLOR_TEMPLATE_COPY.cancel}
          </button>
          <button type="button" className="btn btn-accent" onClick={onConfirm}>
            {FALSE_COLOR_TEMPLATE_COPY.confirmDelete}
          </button>
        </div>
      </div>
    </div>
  );
}
