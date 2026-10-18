import assert from "node:assert/strict";
import ts from "typescript";

/** Inspect control-flow structure without comment spelling or source distance.
 * This is a narrow static check, not proof that the branch executes at runtime.
 */
export function conditionalBody(source: string, condition: string): string {
  const file = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  let body: ts.Statement | undefined;
  function visit(node: ts.Node): void {
    if (ts.isIfStatement(node) && node.expression.getText(file) === condition) body = node.thenStatement;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(body, `condition exists: ${condition}`);
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, body, file);
}
