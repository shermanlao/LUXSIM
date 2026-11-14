/**
 * Side-by-side English / Traditional Chinese copy for official Generate LDT
 * and library-cone disclaimers. This is not a language pack or switcher:
 * both languages stay visible at once, in the same style as editor buttons
 * such as “Arrange · array / 排列”.
 */

export const GENERATE_LDT_FORM_DISCLAIMER =
  "Build a calculated library cone when you do not have a measured IES or LDT. This is not a laboratory file. / 若沒有實測 IES 或 LDT，可建立計算所得的資料庫配光錐。這不是實驗室檔。";

export const LIBRARY_INTRO_DISCLAIMER =
  "Import a measured IES / LDT, or generate a calculated library cone when you do not have a laboratory file. / 匯入實測 IES / LDT；若沒有實驗室檔，可產生計算所得的資料庫配光錐。";

export const SELECTED_LIBRARY_CONE_DISCLAIMER =
  "calculated photometry, not a measured laboratory file. / 計算配光，不是實測實驗室檔。";

export function selectedLibraryConeDisclaimer(label: string): string {
  return `${label} — ${SELECTED_LIBRARY_CONE_DISCLAIMER}`;
}
