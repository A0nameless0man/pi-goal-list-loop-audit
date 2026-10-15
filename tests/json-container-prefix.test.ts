import { test } from "node:test";
import assert from "node:assert/strict";
import { isJsonContainerPrefix } from "../extensions/json-container-prefix.ts";

test("every truncation of valid JSON containers is recognized", () => {
  const fixtures = [
    "{}", "[]", '{"account":"synthetic","status":429}',
    JSON.stringify({ nested: [null, true, false, -3.25, {}, [], { value: 'quote " slash \\ tab\t newline\n' }] }),
    String.raw`{"value":"HTTP 429 \u0123 \b\f\n\r\t \/ \\ \""}`,
    '{"numbers":[0,-0,-12,1.25,1e9,1.25e-9,0E+3]}',
    ' \n{ "key" : [ "value", false, null ] } \t',
  ];
  for (const fixture of fixtures) {
    JSON.parse(fixture); // confirm the fixture itself is valid
    for (let end = fixture.search(/[\[{]/) + 1; end <= fixture.length; end++) {
      const prefix = fixture.slice(0, end);
      assert.equal(isJsonContainerPrefix(prefix), true, JSON.stringify(prefix));
    }
  }
});

test("prose, invalid tokens and trailing content are not JSON container prefixes", () => {
  for (const invalid of [
    "", " ", "123", '"text"', "null", "{ incomplete excerpt", "[ provider prose",
    "{} trailing", "{}[]", "{]", "[}", '{"a" 1', '{"a":undefined',
    '{"a":true false', '{"a":tru ', '{"a":nullx', '{"a":01',
    '{"a":+1', '{"a":1.e', '{"a":1e++', '{"a":-.',
    '{"a":1,}', "[1,]", '[1,,', '{"a":"bad\n',
    String.raw`{"a":"bad\q`, String.raw`{"a":"bad\u0x`,
  ]) assert.equal(isJsonContainerPrefix(invalid), false, JSON.stringify(invalid));
});

test("incomplete strings, escapes, keys, literals and numbers remain valid prefixes", () => {
  for (const suffix of [
    '"HTTP 429', '"HTTP 429' + String.fromCharCode(92), String.raw`"HTTP 429\u`,
    String.raw`"HTTP 429\u0`, String.raw`"HTTP 429\u00`, String.raw`"HTTP 429\u000`,
    "t", "tr", "tru", "f", "fals", "n", "nul", "-", "0.", "1e", "-1.25e-",
    "{", '[null,', '{"incomplete', '{"key":', '{"key":"value",',
  ]) assert.equal(isJsonContainerPrefix('{"payload":' + suffix), true, JSON.stringify(suffix));
});
