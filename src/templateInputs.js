// EXPERIMENTAL (proof of concept for #23, see docs/design/jinja-render-preview.md):
// "What does this file depend on?" -- an inventory of every external input a
// Salt template's Jinja reads: pillar keys, grains, config/opts values, other
// salt[...] calls whose results it uses, imported files, and Salt-provided
// context variables. Static analysis only; nothing is rendered or executed.
//
// Pure (no vscode dependency). The rendered preview (src/preview.js) uses it
// to show which line of the file reads each input; an earlier version of
// this PoC showed its output as a tree view, superseded by that preview.

// Jinja regions whose code can read inputs: statements and expressions.
// Comments (incl. toggled-off {#% %#} tags) and {% raw %} bodies are skipped,
// since Jinja never evaluates them.
const REGION_RE = /\{#[\s\S]*?#\}|\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}|\{%-?([\s\S]*?)-?%\}|\{\{-?([\s\S]*?)-?\}\}/g;
const STRING_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g;

// Salt functions that are really lookups of one of the categories below.
const LOOKUP_FUNCTIONS = {
  'pillar.get': 'pillar',
  'pillar.fetch': 'pillar',
  'grains.get': 'grains',
  'config.get': 'config',
  'config.option': 'config'
};

// Context variables Salt's renderer provides itself (derived from the file's
// location / the run), as opposed to data the minion or master supplies.
const SALT_CONTEXT_VARS = ['sls', 'slspath', 'sls_path', 'slsdotpath', 'slscolonpath', 'tpldir', 'tplpath', 'tplfile', 'tpldot', 'saltenv', 'env'];

const CATEGORIES = [
  { id: 'pillar', label: 'Pillar' },
  { id: 'grains', label: 'Grains' },
  { id: 'config', label: 'Config / opts' },
  { id: 'salt', label: 'Salt function calls' },
  { id: 'imports', label: 'Imported files' },
  { id: 'context', label: 'Salt context variables' }
];

// The string's contents if `text` is exactly one quoted string literal
// ('a', "b"), else null -- so 'users:' ~ user ~ ':home' is not a literal.
function unquote(text) {
  const m = /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*$/.exec(text);
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

// From the "(" at `open`, the call's arguments (top-level comma split,
// respecting strings and nesting) and the index just past its ")".
function readCallArgs(code, open) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === "'" || ch === '"') {
      STRING_RE.lastIndex = i;
      const s = STRING_RE.exec(code);
      if (s && s.index === i) {
        i += s[0].length - 1;
        continue;
      }
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        const last = code.slice(start, i).trim();
        if (last !== '' || args.length > 0) {
          args.push(last);
        }
        return { args, end: i + 1 };
      }
    } else if (ch === ',' && depth === 1) {
      args.push(code.slice(start, i).trim());
      start = i + 1;
    }
  }
  return { args, end: code.length }; // unterminated: take what's there
}

function isLiteral(arg) {
  return unquote(arg) !== null || /^-?\d+(\.\d+)?$/.test(arg.trim()) || /^(True|False|None|true|false|none)$/.test(arg.trim());
}

// Split args into positional and name=value keyword arguments.
function splitKwargs(args) {
  const positional = [];
  const kwargs = {};
  for (const a of args) {
    const m = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]*)$/.exec(a);
    if (m) {
      kwargs[m[1]] = m[2].trim();
    } else {
      positional.push(a);
    }
  }
  return { positional, kwargs };
}

// A lookup's key: the literal when it's a plain string, otherwise the
// expression itself, flagged dynamic (e.g. 'users:' ~ user).
function keyOf(arg) {
  if (arg === undefined) {
    return { key: '(no key)', dynamic: true };
  }
  const literal = unquote(arg);
  return literal !== null ? { key: literal, dynamic: false } : { key: arg, dynamic: true };
}

// Returns [{ category, key, dynamic, default, line, text }] in document
// order. `line` is 0-based; `text` is a short snippet of the code involved.
function extractTemplateInputs(text) {
  const lineStarts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    lineStarts.push(i + 1);
  }
  const lineOf = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo;
  };

  const found = [];
  const add = (category, key, dynamic, dflt, offset, snippet) =>
    found.push({ category, key, dynamic, default: dflt, line: lineOf(offset), offset, text: snippet.replace(/\s+/g, ' ').trim() });

  REGION_RE.lastIndex = 0;
  let region;
  while ((region = REGION_RE.exec(text))) {
    const isStatement = region[1] !== undefined;
    const code = isStatement ? region[1] : region[2];
    if (code === undefined) {
      continue; // comment or raw block
    }
    const base = region.index + region[0].indexOf(code);

    // Offsets inside string literals, so a match that starts in a string
    // ("use grains here") isn't mistaken for code.
    const strings = [];
    STRING_RE.lastIndex = 0;
    for (let s; (s = STRING_RE.exec(code)); ) {
      strings.push([s.index, s.index + s[0].length]);
    }
    const inString = (i) => strings.some(([a, b]) => i > a && i < b);
    // Calls already reported as lookups, so salt['pillar.get'](...) isn't
    // also listed under plain pillar.get / subscript matches inside it.
    const claimed = [];
    const isClaimed = (i) => claimed.some(([a, b]) => i >= a && i < b);

    // salt['mod.fn'](...) and salt.mod.fn(...)
    const saltCall = /(?<![\w.])salt\s*(?:\[\s*(['"])([\w.]+)\1\s*\]|\.\s*(\w+)\s*\.\s*(\w+))\s*\(/g;
    for (let m; (m = saltCall.exec(code)); ) {
      if (inString(m.index)) continue;
      const fn = m[2] || `${m[3]}.${m[4]}`;
      const { args, end } = readCallArgs(code, m.index + m[0].length - 1);
      const snippet = code.slice(m.index, end);
      const { positional, kwargs } = splitKwargs(args);
      const lookup = LOOKUP_FUNCTIONS[fn];
      if (lookup) {
        const { key, dynamic } = keyOf(positional[0] !== undefined ? positional[0] : kwargs.key);
        add(lookup, key, dynamic, positional[1] !== undefined ? positional[1] : kwargs.default, base + m.index, snippet);
      } else if (fn === 'grains.filter_by') {
        // grains.filter_by(lookup_dict, grain='os_family', ...) branches on
        // one grain; os_family is Salt's default when grain= isn't given.
        const grain = kwargs.grain !== undefined ? keyOf(kwargs.grain) : { key: 'os_family', dynamic: false };
        add('grains', grain.key, grain.dynamic, kwargs.default, base + m.index, snippet);
      } else if (fn === 'pillar.items' || fn === 'grains.items') {
        add(fn.split('.')[0], '(all)', false, undefined, base + m.index, snippet);
      } else {
        // Dynamic when any argument is computed rather than a literal, i.e.
        // its result depends on more than what's written here.
        const values = positional.concat(Object.values(kwargs));
        add('salt', `${fn}(${args.join(', ')})`, values.some((a) => !isLiteral(a)), undefined, base + m.index, snippet);
      }
      claimed.push([m.index, m.index + m[0].length]);
    }

    // pillar.get(...), grains.get(...), opts.get(...) on the Jinja globals.
    const objGet = /(?<![\w.])(pillar|grains|opts)\s*\.\s*get\s*\(/g;
    for (let m; (m = objGet.exec(code)); ) {
      if (inString(m.index) || isClaimed(m.index)) continue;
      const { args, end } = readCallArgs(code, m.index + m[0].length - 1);
      const { positional, kwargs } = splitKwargs(args);
      const { key, dynamic } = keyOf(positional[0]);
      add(m[1] === 'opts' ? 'config' : m[1], key, dynamic, positional[1] !== undefined ? positional[1] : kwargs.default, base + m.index, code.slice(m.index, end));
    }

    // pillar['a']['b'], grains['os'], opts['x'] -> keys joined with ":"
    // (Salt's own nested-key notation); pillar.a.b attribute style too.
    const subscript = /(?<![\w.])(pillar|grains|opts)((?:\s*\[\s*(?:'[^']*'|"[^"]*"|[^\]]+)\s*\])+)/g;
    for (let m; (m = subscript.exec(code)); ) {
      if (inString(m.index) || isClaimed(m.index)) continue;
      const parts = [...m[2].matchAll(/\[\s*('[^']*'|"[^"]*"|[^\]]+?)\s*\]/g)].map((p) => p[1]);
      const literal = parts.map(unquote);
      const dynamic = literal.some((p) => p === null);
      const key = dynamic ? parts.join('][') : literal.join(':');
      add(m[1] === 'opts' ? 'config' : m[1], key, dynamic, undefined, base + m.index, m[0]);
    }
    const attr = /(?<![\w.])(pillar|grains)((?:\.(?!get\b|items\b|keys\b|values\b)[A-Za-z_]\w*)+)(?!\s*\()/g;
    for (let m; (m = attr.exec(code)); ) {
      if (inString(m.index) || isClaimed(m.index)) continue;
      add(m[1], m[2].slice(1).split('.').join(':'), false, undefined, base + m.index, m[0]);
    }

    if (isStatement) {
      // {% import_yaml "defaults.yaml" as d %}, {% from "map.jinja" import x %},
      // {% include ... %}, {% extends ... %}
      const imp = /^\s*(import_yaml|import_json|import_text|load_yaml|load_json|load_text|from|import|include|extends)\s+([\s\S]+?)(?:\s+(?:as|import|with|without|ignore)\b[\s\S]*)?$/.exec(code);
      if (imp && !/^(load_yaml|load_json|load_text)$/.test(imp[1])) {
        const target = imp[2].trim();
        const literal = unquote(target);
        add('imports', literal !== null ? literal : target, literal === null, undefined, base, `${imp[1]} ${target}`);
      }
    }

    // Salt-provided context variables used as values (not as attribute
    // names, dict keys in strings, or loop variables of the same name).
    const ctx = new RegExp(`(?<![\\w.'"])(${SALT_CONTEXT_VARS.join('|')})(?![\\w'"])`, 'g');
    for (let m; (m = ctx.exec(code)); ) {
      if (inString(m.index)) continue;
      add('context', m[1], false, undefined, base + m.index, m[1]);
    }
  }
  // Each pattern above scans separately; report in document order.
  return found.sort((a, b) => a.offset - b.offset);
}

// Group extractTemplateInputs() output for display: categories in a fixed
// order, each with its distinct keys (in first-seen order), each with every
// occurrence. The first default seen for a key is the one shown.
function groupTemplateInputs(inputs) {
  return CATEGORIES.map((cat) => {
    const keys = new Map();
    for (const i of inputs.filter((x) => x.category === cat.id)) {
      if (!keys.has(i.key)) {
        keys.set(i.key, { key: i.key, dynamic: i.dynamic, default: i.default, occurrences: [] });
      }
      const k = keys.get(i.key);
      if (k.default === undefined && i.default !== undefined) k.default = i.default;
      k.occurrences.push(i);
    }
    return { ...cat, keys: [...keys.values()] };
  }).filter((c) => c.keys.length > 0);
}

module.exports = { extractTemplateInputs, groupTemplateInputs, CATEGORIES };
