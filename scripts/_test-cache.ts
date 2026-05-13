import { withCache, getCache, setCache, clearCache } from "../lib/cache";

async function main() {
  await clearCache();

  // Miss → producer called.
  let calls = 0;
  const producer = async () => {
    calls++;
    return { now: Date.now(), payload: "hello" };
  };

  const a = await withCache("smoke:a", 60, producer);
  const b = await withCache("smoke:a", 60, producer);
  if (calls !== 1) throw new Error(`expected 1 producer call, got ${calls}`);
  if (a.payload !== b.payload) throw new Error("payload mismatch");
  console.log("OK: cache hit returns same value, producer called once");

  // Short TTL → expires.
  await setCache("smoke:b", 1, { v: 1 });
  await new Promise((r) => setTimeout(r, 1100));
  const expired = await getCache("smoke:b");
  if (expired !== null) throw new Error("expected expired entry to return null");
  console.log("OK: expired entry returns null");

  await clearCache();
  console.log("OK: cleared");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
