import type { CalcOptions, CalcResults } from "@luxsim/solver";
import { randomId } from "@/lib/random-id";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/solver.worker.ts", import.meta.url));
  }
  return worker;
}

export function runSolverClient(options: CalcOptions): Promise<CalcResults> {
  return new Promise((resolve, reject) => {
    const requestId = randomId();
    const w = getWorker();

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.requestId !== requestId) return;
      w.removeEventListener("message", onMessage);
      if (data.type === "result") resolve(data.results);
      else reject(new Error(data.message || "Solver error"));
    };

    w.addEventListener("message", onMessage);
    w.postMessage({ type: "calculate", requestId, options });
  });
}
