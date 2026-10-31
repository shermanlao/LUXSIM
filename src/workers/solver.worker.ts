import { calculate, type CalcOptions, type CalcResults } from "@luxsim/solver";

export type SolverRequest = {
  type: "calculate";
  requestId: string;
  options: CalcOptions;
};

export type SolverResponse =
  | { type: "result"; requestId: string; results: CalcResults }
  | { type: "error"; requestId: string; message: string };

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const msg = event.data;
  if (msg.type !== "calculate") return;
  try {
    const results = calculate(msg.options);
    const response: SolverResponse = {
      type: "result",
      requestId: msg.requestId,
      results,
    };
    self.postMessage(response);
  } catch (e) {
    const response: SolverResponse = {
      type: "error",
      requestId: msg.requestId,
      message: e instanceof Error ? e.message : "Calculation failed",
    };
    self.postMessage(response);
  }
};
