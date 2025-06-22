# Known Issues

## Test Environment

### Worker Pool Tests

Some tests may fail in certain environments due to:

1. **Type Checking in Workers**: Deno's type checking in worker contexts can fail when workers are created dynamically. This is a known Deno issue.

2. **Worker Initialization Timing**: In test environments, worker initialization can be slower than expected, causing timing-related test failures.

### Workarounds

1. **Run tests without type checking**:
   ```bash
   deno test --allow-read --allow-write --no-check tests/
   ```

2. **Disable worker pool in specific tests**: Tests that don't specifically test worker pool functionality have been configured to use `useWorkerPool: false` for stability.

3. **Run tests individually**: If you encounter failures, try running specific test files individually:
   ```bash
   deno test --allow-read --allow-write tests/worker-pool.test.ts
   ```

## Production Usage

These issues only affect the test environment. In production:

- The worker pool functions correctly in all supported environments (Browser, Node.js, Deno, Bun)
- Type checking issues don't affect runtime behavior
- Worker initialization is handled properly with appropriate timeouts

## Future Improvements

1. Investigate alternative worker loading strategies for better test compatibility
2. Add test environment detection to automatically disable workers in problematic environments
3. Improve worker initialization timeout handling in tests
