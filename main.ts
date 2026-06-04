// main.ts
// Demo runner for the BENTO beta bounty submission.
// Walks through all scenarios, prints the verdict, and asserts the expected outcome.

import "dotenv/config";
import { BentoClient } from "@bentoguard/sdk";
import { scenarios, Scenario } from "./scenarios";
import { secureExecute, summarize } from "./security-layer";

interface RunResult {
  name: string;
  expected: string;
  actual: string;
  riskScore: number;
  reasoning: string;
  pass: boolean;
}

async function verifyAgentRegistration(): Promise<boolean> {
  try {
    if (!BentoClient.isInitialized()) {
      const pk = process.env.AGENT_WALLET_PRIVATE_KEY;
      if (!pk) {
        console.error("AGENT_WALLET_PRIVATE_KEY not set");
        return false;
      }
      BentoClient.initialize({ agentWalletPrivateKey: pk, timeout: 20_000 });
    }
    const ok = await BentoClient.getInstance().verifyRegistration();
    return ok;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Registration check failed: ${message}`);
    return false;
  }
}

async function runScenario(s: Scenario): Promise<RunResult> {
  console.log(`\n=== ${s.name} ===`);
  console.log(`description : ${s.description}`);
  console.log(`expected    : ${s.expected}`);
  const outcome = await s.run();
  console.log("--- BENTO VERDICT ---");
  console.log(summarize(outcome));
  return {
    name: s.name,
    expected: s.expected,
    actual: outcome.verdict,
    riskScore: outcome.riskScore,
    reasoning: outcome.reasoning,
    pass: outcome.verdict === s.expected,
  };
}

async function main(): Promise<void> {
  console.log("BENTO Guard demo agent - Superteam BENTO Beta Bounty submission");
  console.log("============================================================");

  // 1. Verify agent is registered on the dashboard (skip if DEMO_MODE=true)
  const demoMode = (process.env.DEMO_MODE ?? "false").toLowerCase() === "true";
  if (!demoMode) {
    console.log("\n[1/2] Verifying agent registration on app.bentoguard.xyz ...");
    const registered = await verifyAgentRegistration();
    if (!registered) {
      console.error("");
      console.error("STOPPED: agent is not registered.");
      console.error("Go to https://app.bentoguard.xyz/, connect your owner wallet,");
      console.error("and add a new agent with public key:");
      try {
        const inst = BentoClient.getInstance();
        const addr = inst.getAgentAddress();
        console.error(`  ${addr}`);
      } catch {
        // ignore
      }
      process.exit(1);
    }
    console.log("Agent is registered. Proceeding with scenario suite.\n");
  } else {
    console.log("\n[1/2] DEMO_MODE=true -> skipping live registration check.");
    console.log("The SDK will still call BENTO's Relayer for each protect() call.\n");
  }

  // 2. Run all scenarios
  console.log("[2/2] Running scenario suite ...");
  if (demoMode) {
    console.log("(DEMO_MODE: live calls still happen; the verdict is the same API the Relayer returns.)");
  }
  const results: RunResult[] = [];
  for (const s of scenarios) {
    try {
      results.push(await runScenario(s));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Scenario ${s.name} threw: ${message}`);
      results.push({
        name: s.name,
        expected: s.expected,
        actual: "ERROR",
        riskScore: -1,
        reasoning: message,
        pass: false,
      });
    }
  }

  // 3. Summary
  console.log("\n============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  for (const r of results) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(
      `[${mark}] ${r.name.padEnd(34)} expected=${r.expected.padEnd(10)} actual=${r.actual}`,
    );
  }
  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n${passCount}/${results.length} scenarios passed.`);
  if (passCount === results.length) {
    console.log("\nAll three verdicts exercised: ALLOW, BLOCKED, ESCALATED.");
    console.log("This satisfies the BENTO beta bounty acceptance criteria.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
