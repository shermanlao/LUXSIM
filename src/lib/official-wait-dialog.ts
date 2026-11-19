/** Bilingual titles for the official wait dialog. Callers pass these to OfficialWaitDialog. */
export type OfficialWaitCopy = {
  titleEn: string;
  titleZh: string;
};

export const PROJECT_LOADING_TITLE_EN = "Loading project…";
export const PROJECT_LOADING_TITLE_ZH = "正在載入專案…";

/** Official bilingual copy for slow operations that show the shared wait dialog. */
export const OFFICIAL_WAIT_COPY = {
  projectLoading: {
    titleEn: PROJECT_LOADING_TITLE_EN,
    titleZh: PROJECT_LOADING_TITLE_ZH,
  },
  creatingProject: {
    titleEn: "Creating project…",
    titleZh: "正在建立專案…",
  },
  openingProjectFile: {
    titleEn: "Opening project file…",
    titleZh: "正在開啟專案檔…",
  },
  calculating: {
    titleEn: "Calculating…",
    titleZh: "正在計算…",
  },
  exportingPdf: {
    titleEn: "Exporting PDF report…",
    titleZh: "正在匯出 PDF 報告…",
  },
  exportingVerification: {
    titleEn: "Exporting verification pack…",
    titleZh: "正在匯出核對包…",
  },
  importingPlan: {
    titleEn: "Importing plan…",
    titleZh: "正在匯入圖則…",
  },
  applyingPlanLayers: {
    titleEn: "Updating plan layers…",
    titleZh: "正在更新圖則圖層…",
  },
  rasterizingPdf: {
    titleEn: "Updating PDF page…",
    titleZh: "正在更新 PDF 頁面…",
  },
  importingPhotometry: {
    titleEn: "Importing photometry…",
    titleZh: "正在匯入光度檔…",
  },
  generatingLdt: {
    titleEn: "Generating LDT…",
    titleZh: "正在產生 LDT…",
  },
  saving: {
    titleEn: "Saving…",
    titleZh: "正在儲存…",
  },
  savingProjectFile: {
    titleEn: "Saving project file…",
    titleZh: "正在儲存專案檔…",
  },
  detectingCodes: {
    titleEn: "Detecting fixture codes…",
    titleZh: "正在偵測燈具編號…",
  },
  placingFixtures: {
    titleEn: "Placing fixtures…",
    titleZh: "正在放置燈具…",
  },
  committingRcp: {
    titleEn: "Placing detected fixtures…",
    titleZh: "正在放置已偵測燈具…",
  },
  importingSchedule: {
    titleEn: "Importing schedule…",
    titleZh: "正在匯入燈具表…",
  },
  creatingRoomsFromDxf: {
    titleEn: "Creating rooms from DXF…",
    titleZh: "正在從 DXF 建立房間…",
  },
  updatingScale: {
    titleEn: "Updating scale…",
    titleZh: "正在更新比例尺…",
  },
  loading3d: {
    titleEn: "Loading…",
    titleZh: "正在載入…",
  },
  loadingView: {
    titleEn: "Loading…",
    titleZh: "正在載入…",
  },
} as const satisfies Record<string, OfficialWaitCopy>;

/**
 * Wait until the next two animation frames so a wait dialog can hide after
 * the result has been painted, matching ProjectEditorLoadGate.
 */
export function officialWaitAfterPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Yield to the event loop so the page can paint and stay responsive. */
export function officialWaitYield(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * After the wait dialog is shown, let React commit and the browser paint
 * before starting heavy work, so the dialog is visible and the tab stays responsive.
 */
export function officialWaitBeforeWork(): Promise<void> {
  return officialWaitYield().then(() => officialWaitAfterPaint());
}
