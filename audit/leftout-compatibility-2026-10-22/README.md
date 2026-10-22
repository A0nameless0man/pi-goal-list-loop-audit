# leftOut compatibility note verification

The Unreleased compatibility section in `CHANGELOG.md` explains that optional `pendingCompletion.leftOut` is a string matching runtime output, the old published array schema was incorrect, downstream validators/types should be refreshed, and existing string-valued runtime records require no migration. The corrected string schema and runtime type are unchanged.

The first review confirmed those artifacts but could not substantiate the test result: its runner selected unsupported host Bun. The executor did run the tests with a repo-local Bun 1.3.14. To remove ambiguity, `schema-tests.log` now preserves a fresh run including the resolved executable, version, five passing tests, zero failures and runner exit 0.

Reproduce from the repository root (do not use the older default Bun):

```sh
PATH="/home/dracon/Dev/pi-plugins/pi-goal-list-loop-audit/.pi/test-tools/node_modules/@oven/bun-linux-x64/bin:$PATH" timeout 180 node scripts/run-tests.mjs tests/goal.schema.test.ts tests/goal-schema-parity.test.ts
```

The binary is in an ignored repo-local test-tool installation; it is not committed or a host-tool modification. On another checkout, provide Bun 1.3.14 or newer supporting the runner's required flags through PATH first. No full-suite pass is claimed. Existing Ajv date-time format warnings are retained in the raw log; string acceptance/array rejection and parity tests pass.
