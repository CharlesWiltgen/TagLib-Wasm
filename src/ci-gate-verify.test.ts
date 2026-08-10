// TEMP-VERIFY: deliberately failing colocated test for CI gate verification
// (taglib-olas). The CI test job must fail on this file when running
// `tests/ src/`. DELETE before merge.
Deno.test("CI gate verification: deliberate failure", () => {
  throw new Error("CI gate verification: colocated test ran");
});
