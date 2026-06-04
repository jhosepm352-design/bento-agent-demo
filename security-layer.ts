// security-layer.ts
// The integration point that wraps all agent actions with Bento Guard protection.
// Every Solana-mutating action in the agent must call secureExecute() instead of
// touching the chain directly. BENTO scores the intent, returns ALLOW/BLOCKED/ESCALATED,
// and we act on the verdict.

import { protect, BentoClient, BentoError, AnalysisResult } from "@bentoguard/sdk";

export interface ProtectInput {
  instruction: string;
  metadata?: Record<string, unknown>;
}

export interface ProtectOutcome {
  verdict: "ALLOW" | "BLOCKED" | "ESCALATED";
  riskScore: number;
  reasoning: string;
  actionId?: string;
  approveUrl?: string;
  reviewUrl?: string;
  errorCode?: string;
}

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  if (!BentoClient.isInitialized()) {
    const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
    if (!pk) {
      throw new Error(
        "AGENT_WALLET_PRIVATE_KEY not set. Copy .env.example to .env and fill in your agent key.",
      );
    }
    BentoClient.initialize({
      agentWalletPrivateKey: pk,
      timeout: 20_000,
    });
  }
  initialized = true;
}

/**
 * secureExecute — single chokepoint for all agent actions.
 * @param input.instruction  natural language description of what the agent wants to do
 * @returns verdict (ALLOW / BLOCKED / ESCALATED) + reasoning + risk score
 *
 * Caller is responsible for:
 *   - Only executing the action when verdict === "ALLOW"
 *   - Logging ESCALATED verdicts and waiting for human review
 *   - Halting on BLOCKED
 *
 * Bento is fail-closed: any thrown BentoError is treated as BLOCKED.
 */
export async function secureExecute(
  input: ProtectInput,
): Promise<ProtectOutcome> {
  ensureInitialized();

  try {
    const result: AnalysisResult = await protect(input.instruction, {
      autoPollEscalation: true,
      pollIntervalMs: 5_000,
      pollTimeoutMs: 60_000,
      silent: false,
    });

    return {
      verdict: result.recommendation,
      riskScore: result.riskScore,
      reasoning: result.reasoning,
      actionId: result.actionId,
      approveUrl: result.approveUrl,
      reviewUrl: result.reviewUrl,
    };
  } catch (err) {
    if (err instanceof BentoError) {
      // Fail-closed: a verifier outage must not let actions through
      return {
        verdict: "BLOCKED",
        riskScore: 100,
        reasoning: `Bento Guard exception (${err.code ?? "UNKNOWN"}): ${err.message}`,
        errorCode: err.code,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      verdict: "BLOCKED",
      riskScore: 100,
      reasoning: `Unexpected error during protection: ${message}`,
    };
  }
}

/**
 * Helper for the demo runner. Returns a stable summary suitable for printing.
 */
export function summarize(outcome: ProtectOutcome): string {
  const lines = [
    `verdict      : ${outcome.verdict}`,
    `risk_score   : ${outcome.riskScore}`,
    `reasoning    : ${outcome.reasoning}`,
  ];
  if (outcome.actionId) lines.push(`action_id    : ${outcome.actionId}`);
  if (outcome.approveUrl) lines.push(`approve_url  : ${outcome.approveUrl}`);
  if (outcome.reviewUrl) lines.push(`review_url   : ${outcome.reviewUrl}`);
  if (outcome.errorCode) lines.push(`error_code   : ${outcome.errorCode}`);
  return lines.join("\n");
}
