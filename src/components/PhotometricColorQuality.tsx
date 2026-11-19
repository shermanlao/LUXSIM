"use client";

import type { PhotometricData } from "@luxsim/photometry";
import { photometricColorQualityFields } from "@/lib/photometric-preview-fields";

export function PhotometricColorQuality({
  photo,
  className,
}: {
  photo: PhotometricData;
  className: string;
}) {
  const fields = photometricColorQualityFields(photo);
  if (fields.length === 0) return null;
  return (
    <dl className={className}>
      {fields.map((field) => (
        <div key={field.label}>
          <dt className="label">{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
