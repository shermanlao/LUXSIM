/** Reset a form if the element is still mounted. Safe after an await / re-render. */
export function resetForm(form: HTMLFormElement | null | undefined): void {
  form?.reset();
}
