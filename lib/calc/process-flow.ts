/**
 * Derives the distinct, ordered list of process steps across a part's
 * routes (one per child part, plus the main-assembly route) — the
 * canonical "what operations does this part go through" list consumed by
 * PFMEA (element 6) and Control Plan (element 7). Pure function: callers
 * fetch the Route/RouteStep/Operation rows and pass them in.
 */

export type OperationSymbol = "OPERATION" | "INSPECTION" | "STORAGE" | "TRANSPORT" | "DELAY";

export type RouteStepInput = {
  operationCode: string;
  operationName: string;
  symbol: OperationSymbol;
  sequence: number;
};

export type RouteInput = {
  /** Item number of the owning child part, or null for the main-assembly route. */
  childPartItemNo: number | null;
  steps: RouteStepInput[];
};

export type ProcessStep = {
  operationCode: string;
  operationName: string;
  symbol: OperationSymbol;
};

/**
 * Routes are walked in child-part item-no order (ascending), with the
 * main-assembly route last — matching the real production sequence:
 * individual components are fabricated first, then consolidated. Within
 * a route, steps are walked in `sequence` order. A step is included only
 * the first time its operation is encountered.
 */
export function deriveProcessStepList(routes: RouteInput[]): ProcessStep[] {
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.childPartItemNo == null && b.childPartItemNo == null) return 0;
    if (a.childPartItemNo == null) return 1;
    if (b.childPartItemNo == null) return -1;
    return a.childPartItemNo - b.childPartItemNo;
  });

  const seen = new Set<string>();
  const result: ProcessStep[] = [];

  for (const route of sortedRoutes) {
    const stepsInOrder = [...route.steps].sort((a, b) => a.sequence - b.sequence);
    for (const step of stepsInOrder) {
      if (seen.has(step.operationCode)) continue;
      seen.add(step.operationCode);
      result.push({
        operationCode: step.operationCode,
        operationName: step.operationName,
        symbol: step.symbol,
      });
    }
  }

  return result;
}
