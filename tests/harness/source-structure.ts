import assert from "node:assert/strict";
import ts from "typescript";

/** Inspect control-flow structure without comment spelling or source distance.
 * This is a narrow static check, not proof that the branch executes at runtime.
 */
export function conditionalBodies(source: string, condition: string): string[] {
  const file = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
  const bodies: ts.Statement[] = [];
  function visit(node: ts.Node): void {
    if (ts.isIfStatement(node) && node.expression.getText(file) === condition) bodies.push(node.thenStatement);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(bodies.length, `condition exists: ${condition}`);
  const printer = ts.createPrinter({ removeComments: true });
  return bodies.map(body => printer.printNode(ts.EmitHint.Unspecified, body, file));
}

export function conditionalBody(source: string, condition: string): string {
  return conditionalBodies(source, condition).at(-1)!;
}
