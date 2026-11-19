/** Official wait while the editor switches Top / Front / Side / 3D. */

export const VIEW_SWITCH_READY_TIMEOUT_MS = 12_000;

export function shouldWaitForOfficialViewSwitch(current: string, next: string): boolean {
  return current !== next;
}

/** Resolve when the new view signals it is ready, or when the timeout elapses. */
export function officialViewSwitchReady(
  signal: Promise<void>,
  timeoutMs = VIEW_SWITCH_READY_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    signal.then(finish, finish).finally(() => clearTimeout(timer));
  });
}
