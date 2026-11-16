export const PROJECT_LOADING_TITLE_EN = "Loading project…";
export const PROJECT_LOADING_TITLE_ZH = "正在載入專案…";

/** Official wait-state dialog shown while a project opens into the editor. */
export function ProjectLoadingDialog() {
  return (
    <div className="project-loading-backdrop" role="presentation">
      <div
        className="project-loading-dialog"
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby="project-loading-title"
        aria-describedby="project-loading-message"
      >
        <div className="project-loading-spinner" aria-hidden="true" />
        <h2 id="project-loading-title" className="display">
          {PROJECT_LOADING_TITLE_EN}
        </h2>
        <p id="project-loading-message">{PROJECT_LOADING_TITLE_ZH}</p>
      </div>
    </div>
  );
}
