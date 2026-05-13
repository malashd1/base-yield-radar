import {
  buildDepositTx,
  buildApproveTx,
  MORPHO_USDC_VAULT,
  USDC_BASE,
} from "../lib/morpho";

function main() {
  const receiver = "0x0000000000000000000000000000000000000001" as const;
  const amount = 1_000_000n; // 1 USDC (6 decimals)

  // ---------- deposit ----------
  const dep = buildDepositTx(amount, receiver);
  if (dep.to.toLowerCase() !== MORPHO_USDC_VAULT.toLowerCase())
    throw new Error(`deposit.to wrong: ${dep.to}`);
  if (dep.value !== 0n) throw new Error(`deposit.value should be 0`);
  // selector for deposit(uint256,address) = 0x6e553f65
  if (!dep.data.startsWith("0x6e553f65"))
    throw new Error(`deposit selector wrong: ${dep.data.slice(0, 10)}`);
  if (dep.data.length !== 2 + 8 + 64 + 64)
    throw new Error(`deposit calldata length wrong: ${dep.data.length}`);
  console.log("OK deposit:", dep);

  // ---------- approve ----------
  const apv = buildApproveTx(amount);
  if (apv.to.toLowerCase() !== USDC_BASE.toLowerCase())
    throw new Error(`approve.to wrong: ${apv.to}`);
  if (apv.value !== 0n) throw new Error(`approve.value should be 0`);
  // selector for approve(address,uint256) = 0x095ea7b3
  if (!apv.data.startsWith("0x095ea7b3"))
    throw new Error(`approve selector wrong: ${apv.data.slice(0, 10)}`);
  console.log("OK approve:", apv);

  // ---------- guardrails ----------
  let threw = false;
  try {
    buildDepositTx(0n, receiver);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("expected zero-amount deposit to throw");
  threw = false;
  try {
    buildDepositTx(1n, "0xnotanaddress" as `0x${string}`);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("expected bad receiver to throw");
  console.log("OK guardrails: zero amount + bad receiver both rejected");
}

try {
  main();
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
}
