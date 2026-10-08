// Static scan for the "lost in a merge" bug class: a name that is called, read or assigned but never declared
// anywhere. All of js/*.js share one global scope (classic <script> tags), so a function or variable that one
// file defines is visible to every other file, and when a merge drops the definition, every use throws a
// ReferenceError at runtime (hmDismissHint, bodyBuilt, 2026-10-08) while the data gates still pass.
//
// Run: node tools/undef_scan.js        (exit 1 on any finding)
//
// How: acorn parses every js/*.js (checked) and data/*.js (read for declarations only). A scope-aware walk
// resolves each identifier through function / block / catch / class scopes; whatever is left over must be a
// top-level declaration in any app file, a `window.X = ...` / `Object.assign(window, {...})` global, or a browser
// global (tools/smoke/browser-globals.json, dumped from headless Chrome). Member calls (a.b()), property keys,
// labels and `typeof x` operands are never treated as references.
//   FAIL  = a use with no definition anywhere.
//   WARN  = no definition anywhere, but the name also appears in a `typeof name` guard: the guard stops the crash and
//           hides that the feature is gone (hmDismissHint was exactly this). Listed, does not fail the run.
//   NOTE  = resolves only to a generic window property (name, status, length, event, top...) that is almost
//           always a lost local variable. Counted as FAIL.
"use strict";
const fs = require("fs"), path = require("path");
let acorn;
try { acorn = require("./node_modules/acorn"); }
catch (e) { console.error("undef_scan: acorn is not installed. Run: npm install --prefix tools --no-save --no-package-lock acorn"); process.exit(2); }

const ROOT = path.join(__dirname, "..");
const BROWSER = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, "smoke", "browser-globals.json"), "utf8")));
// window properties that are real but are far more often a forgotten local than an intended global
const NODE_IDIOM = new Set(["module", "exports", "require"]);   // `typeof module !== "undefined"` guards around a node-only export
const GENERIC = new Set(["name", "status", "length", "event", "top", "parent", "opener", "closed", "external", "origin", "frames", "self"]);
const list = dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".js")).sort().map(f => dir + "/" + f);
const CHECKED = [...list("js"), ...(fs.existsSync(path.join(ROOT, "js/games")) ? list("js/games") : [])], DATA = list("data");
if (fs.existsSync(path.join(ROOT, "sw.js"))) DATA.push("sw.js");   // (own scope in a worker; only read for declarations)

const parse = (src, file) => {
  try { return acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", locations: true, allowHashBang: true, allowReturnOutsideFunction: true }); }
  catch (e) { console.error(`undef_scan: cannot parse ${file}: ${e.message}`); process.exit(2); }
};
const isNode = v => v && typeof v === "object" && typeof v.type === "string";
const children = n => { const out = []; for (const k of Object.keys(n)) { if (k === "loc" || k === "type") continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => isNode(x) && out.push(x)); else if (isNode(v)) out.push(v); } return out; };

// ---------- pass 1: what is declared globally, across every app file ----------
const GLOBAL = new Map();   // name -> first file
const addGlobal = (name, file) => { if (!GLOBAL.has(name)) GLOBAL.set(name, file); };
function patternNames(p, out) {
  if (!p) return out;
  switch (p.type) {
    case "Identifier": out.push(p.name); break;
    case "ObjectPattern": p.properties.forEach(x => patternNames(x.type === "RestElement" ? x.argument : x.value, out)); break;
    case "ArrayPattern": p.elements.forEach(x => patternNames(x, out)); break;
    case "AssignmentPattern": patternNames(p.left, out); break;
    case "RestElement": patternNames(p.argument, out); break;
  }
  return out;
}
const winObj = o => o && o.type === "Identifier" && ["window", "globalThis", "self"].includes(o.name);
function collectGlobals(ast, file) {
  const topLevel = (n, inFn) => {
    if (!inFn) {
      if (n.type === "VariableDeclaration") n.declarations.forEach(d => patternNames(d.id, []).forEach(x => addGlobal(x, file)));
      if ((n.type === "FunctionDeclaration" || n.type === "ClassDeclaration") && n.id) addGlobal(n.id.name, file);
    }
    // window.X = ..., window["X"] = ..., Object.assign(window, { X: ... }) anywhere
    if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && winObj(n.left.object)) {
      const p = n.left.property;
      if (!n.left.computed && p.type === "Identifier") addGlobal(p.name, file);
      else if (n.left.computed && p.type === "Literal" && typeof p.value === "string") addGlobal(p.value, file);
    }
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.name === "Object" && ["assign", "defineProperty"].includes(n.callee.property.name) && winObj(n.arguments[0])) {
      const a = n.arguments[1];
      if (a && a.type === "ObjectExpression") a.properties.forEach(pr => pr.key && !pr.computed && addGlobal(pr.key.name || pr.key.value, file));
      if (a && a.type === "Literal") addGlobal(a.value, file);
    }
    const fn = inFn || /Function/.test(n.type);
    // `var` and function declarations nested in top-level blocks / ifs also land in the global scope (sloppy-mode hoisting); be lenient
    children(n).forEach(c => topLevel(c, /Function/.test(n.type) ? true : inFn));
  };
  topLevel(ast, false);
}
const ASTS = new Map();
for (const f of CHECKED.concat(DATA)) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  const ast = parse(src, f);
  ASTS.set(f, ast);
  if (f !== "sw.js") collectGlobals(ast, f);
}

// ---------- pass 2: scope-aware walk of js/*.js ----------
const found = [];   // { name, kind, file, line, col }
const guarded = new Set();   // names that appear as `typeof name` anywhere
class Scope {
  constructor(parent) { this.parent = parent; this.names = new Set(); }
  has(n) { for (let s = this; s; s = s.parent) if (s.names.has(n)) return true; return false; }
}
function hoistVars(n, scope) {   // `var` declarations (and nothing inside nested functions) belong to the enclosing function
  if (/Function/.test(n.type) && n !== scope.owner) return;
  if (n.type === "VariableDeclaration" && n.kind === "var") n.declarations.forEach(d => patternNames(d.id, []).forEach(x => scope.names.add(x)));
  children(n).forEach(c => hoistVars(c, scope));
}
function declareLexical(stmts, scope) {
  stmts.forEach(s => {
    if (s.type === "VariableDeclaration" && s.kind !== "var") s.declarations.forEach(d => patternNames(d.id, []).forEach(x => scope.names.add(x)));
    if ((s.type === "ClassDeclaration" || s.type === "FunctionDeclaration") && s.id) scope.names.add(s.id.name);
  });
}
function scan(file, ast) {
  const ref = (id, kind, scope) => {
    const name = id.name;
    if (scope.has(name) || GLOBAL.has(name)) return;
    if (BROWSER.has(name) && !GENERIC.has(name)) return;
    found.push({ name, kind: BROWSER.has(name) ? "generic" : kind, file, line: id.loc.start.line, col: id.loc.start.column + 1 });
  };
  // a pattern that is being assigned to (not declared): its identifiers are references
  const target = (p, scope) => {
    if (!p) return;
    switch (p.type) {
      case "Identifier": return ref(p, "assign", scope);
      case "MemberExpression": return walk(p, scope);
      case "ObjectPattern": return p.properties.forEach(x => { if (x.type === "RestElement") return target(x.argument, scope); if (x.computed) walk(x.key, scope); target(x.value, scope); });
      case "ArrayPattern": return p.elements.forEach(x => target(x, scope));
      case "AssignmentPattern": walk(p.right, scope); return target(p.left, scope);
      case "RestElement": return target(p.argument, scope);
    }
  };
  // a pattern that is being declared: only its defaults and computed keys are expressions
  const declared = (p, scope) => {
    if (!p) return;
    switch (p.type) {
      case "ObjectPattern": return p.properties.forEach(x => { if (x.type === "RestElement") return declared(x.argument, scope); if (x.computed) walk(x.key, scope); declared(x.value, scope); });
      case "ArrayPattern": return p.elements.forEach(x => declared(x, scope));
      case "AssignmentPattern": walk(p.right, scope); return declared(p.left, scope);
      case "RestElement": return declared(p.argument, scope);
    }
  };
  const fnScope = (n, scope) => {
    const fs = new Scope(scope); fs.owner = n;
    if (n.type === "FunctionExpression" && n.id) fs.names.add(n.id.name);
    fs.names.add("arguments");
    n.params.forEach(p => patternNames(p, []).forEach(x => fs.names.add(x)));
    n.params.forEach(p => declared(p, fs));
    if (n.body.type === "BlockStatement") { hoistVars(n.body, fs); declareLexical(n.body.body, fs); n.body.body.forEach(s => walk(s, fs)); }
    else walk(n.body, fs);
  };
  function walk(n, scope) {
    if (!n) return;
    switch (n.type) {
      case "Program": { const gs = new Scope(null); gs.owner = n; n.body.forEach(s => walk(s, gs)); return; }
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": return fnScope(n, scope);
      case "BlockStatement": { const bs = new Scope(scope); declareLexical(n.body, bs); return n.body.forEach(s => walk(s, bs)); }
      case "ForStatement": { const ls = new Scope(scope); if (n.init && n.init.type === "VariableDeclaration" && n.init.kind !== "var") declareLexical([n.init], ls); walk(n.init, ls); walk(n.test, ls); walk(n.update, ls); return walk(n.body, ls); }
      case "ForInStatement": case "ForOfStatement": {
        const ls = new Scope(scope);
        if (n.left.type === "VariableDeclaration") { if (n.left.kind !== "var") declareLexical([n.left], ls); n.left.declarations.forEach(d => declared(d.id, ls)); }
        else target(n.left, ls);
        walk(n.right, ls); return walk(n.body, ls);
      }
      case "SwitchStatement": { walk(n.discriminant, scope); const ss = new Scope(scope); n.cases.forEach(c => declareLexical(c.consequent, ss)); return n.cases.forEach(c => { walk(c.test, ss); c.consequent.forEach(s => walk(s, ss)); }); }
      case "CatchClause": { const cs = new Scope(scope); if (n.param) { patternNames(n.param, []).forEach(x => cs.names.add(x)); declared(n.param, cs); } return walk(n.body, cs); }
      case "ClassDeclaration": case "ClassExpression": {
        const cs = new Scope(scope); if (n.id) cs.names.add(n.id.name);
        walk(n.superClass, scope);
        n.body.body.forEach(m => {
          if (m.type === "StaticBlock") { const bs = new Scope(cs); bs.owner = m; hoistVars(m, bs); declareLexical(m.body, bs); return m.body.forEach(s => walk(s, bs)); }
          if (m.computed) walk(m.key, cs);
          if (m.type === "PropertyDefinition") { if (m.value) { const ps = new Scope(cs); ps.owner = m; walk(m.value, ps); } }
          else walk(m.value, cs);
        });
        return;
      }
      case "VariableDeclaration": return n.declarations.forEach(d => { declared(d.id, scope); walk(d.init, scope); });
      case "Identifier": return ref(n, "read", scope);
      case "MemberExpression": walk(n.object, scope); if (n.computed) walk(n.property, scope); return;
      case "Property": if (n.computed) walk(n.key, scope); return walk(n.value, scope);   // (an object literal's; patterns go through target/declared)
      case "MethodDefinition": return;   // handled in the class case
      case "AssignmentExpression": walk(n.right, scope); return n.operator === "=" ? target(n.left, scope) : (n.left.type === "Identifier" ? ref(n.left, "assign", scope) : walk(n.left, scope));
      case "UpdateExpression": return n.argument.type === "Identifier" ? ref(n.argument, "assign", scope) : walk(n.argument, scope);
      case "UnaryExpression":
        if (n.operator === "typeof" && n.argument.type === "Identifier") { guarded.add(n.argument.name); return; }
        return walk(n.argument, scope);
      case "CallExpression": case "NewExpression":
        if (n.callee.type === "Identifier") ref(n.callee, n.type === "NewExpression" ? "new" : "call", scope); else walk(n.callee, scope);
        return n.arguments.forEach(a => walk(a, scope));
      case "LabeledStatement": return walk(n.body, scope);
      case "BreakStatement": case "ContinueStatement": case "MetaProperty": return;
      default: children(n).forEach(c => walk(c, scope));
    }
  }
  walk(ast, null);
}
for (const f of CHECKED) scan(f, ASTS.get(f));

// ---------- report ----------
const fails = found.filter(x => !guarded.has(x.name) || x.kind === "generic");
const warns = found.filter(x => guarded.has(x.name) && x.kind !== "generic" && !NODE_IDIOM.has(x.name));
const group = arr => { const m = new Map(); arr.forEach(x => { if (!m.has(x.name)) m.set(x.name, []); m.get(x.name).push(x); }); return [...m.entries()]; };
const where = xs => xs.slice(0, 4).map(x => `${x.file}:${x.line}`).join(", ") + (xs.length > 4 ? ` (+${xs.length - 4} more)` : "");
for (const [name, xs] of group(warns)) console.log(`WARN  ${name}  is never defined, only guarded by typeof (the feature is silently missing): ${where(xs)}`);
for (const [name, xs] of group(fails)) {
  const kinds = [...new Set(xs.map(x => x.kind))];
  console.log(`FAIL  ${name}  ${kinds.includes("generic") ? "resolves only to window." + name + " (a lost local?)" : "is " + kinds.map(k => ({ call: "called", read: "read", assign: "assigned", new: "constructed" })[k]).join("/") + " but declared nowhere"}: ${where(xs)}`);
}
const nfiles = CHECKED.length, nglob = GLOBAL.size;
console.log(`undef_scan: ${nfiles} files, ${nglob} top-level names, ${fails.length} unresolved use${fails.length === 1 ? "" : "s"} (${group(fails).length} name${group(fails).length === 1 ? "" : "s"})${warns.length ? `, ${group(warns).length} guarded-but-missing` : ""}`);
process.exit(fails.length ? 1 : 0);
