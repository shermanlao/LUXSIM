import type { PhotometricData } from "@luxsim/photometry";

export type PhotometricMetaField = {
  label: string;
  value: string;
};

function isPresentNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatQualityNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

/** CCT / CRI rows for the polar preview. Omits a field when it is absent. */
export function photometricColorQualityFields(
  photo: Pick<PhotometricData, "cctK" | "cri">,
): PhotometricMetaField[] {
  const fields: PhotometricMetaField[] = [];
  if (isPresentNumber(photo.cctK)) {
    fields.push({ label: "CCT", value: `${formatQualityNumber(photo.cctK)} K` });
  }
  if (isPresentNumber(photo.cri)) {
    fields.push({ label: "CRI", value: formatQualityNumber(photo.cri) });
  }
  return fields;
}
