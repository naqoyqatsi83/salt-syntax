const vscode = require('vscode');

// Common Salt execution/state modules and their most-used state functions.
const MODULE_FUNCTIONS = {
  pkg: ['installed', 'removed', 'purged', 'latest', 'uptodate', 'held', 'unheld'],
  pkgrepo: ['managed', 'absent'],
  service: ['running', 'dead', 'enabled', 'disabled', 'masked', 'unmasked', 'mod_watch'],
  file: [
    'managed', 'absent', 'directory', 'recurse', 'symlink', 'copy', 'append',
    'blockreplace', 'replace', 'rename', 'exists', 'touch', 'serialize',
    'accumulated', 'line'
  ],
  user: ['present', 'absent'],
  group: ['present', 'absent'],
  cmd: ['run', 'wait', 'script', 'script_wait', 'run_all'],
  mount: ['mounted', 'unmounted'],
  archive: ['extracted'],
  git: ['latest', 'present', 'detached', 'config_set'],
  cron: ['present', 'absent'],
  lvm: ['lv_present', 'lv_absent', 'pv_present', 'pv_absent', 'vg_present', 'vg_absent'],
  pip: ['installed', 'removed'],
  virtualenv: ['managed'],
  sysctl: ['present'],
  network: ['managed', 'routes'],
  firewalld: ['present'],
  iptables: ['append', 'insert', 'delete'],
  selinux: ['boolean', 'mode', 'port_policy_present'],
  timezone: ['system'],
  x509: ['certificate_managed', 'private_key_managed'],
  schedule: ['present', 'absent'],
  supervisord: ['running', 'dead'],
  module: ['run', 'wait']
};

// Extra `- key: value` argument lines offered for specific module.function
// combos, as [key, placeholder] pairs. Anything not listed here falls back
// to DEFAULT_FIELDS (just `name`).
const FUNCTION_FIELDS = {
  'pkg.installed': [['name', 'package_name']],
  'pkg.removed': [['name', 'package_name']],
  'pkg.purged': [['name', 'package_name']],
  'pkg.latest': [['name', 'package_name']],
  'service.running': [['name', 'service_name'], ['enable', 'True']],
  'service.dead': [['name', 'service_name'], ['enable', 'False']],
  'service.enabled': [['name', 'service_name']],
  'service.disabled': [['name', 'service_name']],
  'file.managed': [
    ['name', '/path/to/file'], ['source', 'salt://path/to/source'],
    ['user', 'root'], ['group', 'root'], ['mode', "'0644'"]
  ],
  'file.absent': [['name', '/path/to/file']],
  'file.directory': [
    ['name', '/path/to/dir'], ['user', 'root'], ['group', 'root'],
    ['mode', "'0755'"], ['makedirs', 'True']
  ],
  'file.symlink': [['name', '/path/to/link'], ['target', '/path/to/target']],
  'user.present': [['name', 'username']],
  'user.absent': [['name', 'username']],
  'group.present': [['name', 'groupname']],
  'group.absent': [['name', 'groupname']],
  'cmd.run': [['name', 'command']],
  'mount.mounted': [
    ['name', '/mount/point'], ['device', '/dev/sdX'], ['fstype', 'ext4']
  ],
  'mount.unmounted': [['name', '/mount/point']],
  'archive.extracted': [
    ['name', '/extract/to'], ['source', 'salt://path/to/archive.tar.gz']
  ],
  'git.latest': [
    ['name', 'https://example.com/repo.git'], ['target', '/path/to/checkout']
  ],
  'cron.present': [
    ['name', 'command'], ['user', 'root'], ['minute', '*'], ['hour', '*']
  ],
  'lvm.lv_present': [['name', 'lvname'], ['vgname', 'vgname'], ['size', '1G']],
  'lvm.lv_absent': [['name', 'lvname'], ['vgname', 'vgname']]
};
const DEFAULT_FIELDS = [['name', 'name']];

// Builds `<indent>- key: ${n:placeholder}` lines (plus a trailing free
// tabstop), returning the joined text and the next unused tabstop number.
function buildArgsBody(fields, indent, startTabstop) {
  let n = startTabstop;
  const lines = fields.map(([key, placeholder]) => {
    const line = `${indent}- ${key}: \${${n}:${placeholder}}`;
    n += 1;
    return line;
  });
  lines.push(`${indent}- $0`);
  return { text: lines.join('\n'), nextTabstop: n };
}

const REQUISITE_KEYS = [
  'require', 'require_in', 'watch', 'watch_in', 'onchanges', 'onchanges_in',
  'onfail', 'onfail_in', 'onfail_all', 'onfail_any', 'listen', 'listen_in',
  'prereq', 'prereq_in', 'use', 'use_in', 'order', 'unless', 'onlyif',
  'creates', 'retry', 'name', 'names', 'source', 'source_hash', 'mode',
  'user', 'group', 'makedirs', 'recurse', 'template', 'context', 'defaults',
  'contents', 'enable', 'persist', 'reload'
];

const JINJA_KEYWORDS = [
  'if', 'elif', 'else', 'endif', 'for', 'endfor', 'in', 'is', 'not', 'and', 'or',
  'set', 'endset', 'block', 'endblock', 'extends', 'include', 'import', 'from',
  'with context', 'without context', 'macro', 'endmacro', 'call', 'endcall',
  'filter', 'endfilter', 'with', 'endwith', 'raw', 'endraw', 'trans', 'endtrans'
];

const JINJA_FILTERS = [
  'default', 'json', 'yaml', 'tojson', 'upper', 'lower', 'replace', 'join',
  'indent', 'list', 'length', 'trim', 'title', 'capitalize', 'wordwrap',
  'truncate', 'unique', 'sort', 'min', 'max', 'sum', 'round', 'int', 'float',
  'string', 'regex_replace', 'regex_search', 'regex_match', 'yaml_dquote',
  'yaml_squote', 'yaml_encode', 'selectattr', 'rejectattr', 'map', 'first',
  'last', 'random'
];

const JINJA_GLOBALS = [
  'salt', 'grains', 'pillar', 'opts', 'sls', 'tpldir', 'tplfile', 'saltenv',
  'pillarenv'
];

// Offered when NOT already inside a {{ }} / {% %} tag: typing the bare keyword
// (e.g. "for") inserts the whole block, so Jinja completion "kicks in" immediately
// instead of requiring the tag delimiters to be typed by hand first. No `-`
// whitespace-control markers are inserted; the grammar still highlights them
// fine if you type them yourself, this extension just doesn't add them for you.
// `filter` is what has to match what was typed (so all "if" variants show up when
// you type "if"); `label` is only what's displayed in the dropdown to tell them apart.
const JINJA_BLOCK_SNIPPETS = [
  { label: 'if … endif', filter: 'if', detail: 'if block', body: '{% if ${1:condition} %}\n  $0\n{% endif %}' },
  { label: 'if … else … endif', filter: 'if', detail: 'if/else block', body: '{% if ${1:condition} %}\n  $0\n{% else %}\n  \n{% endif %}' },
  { label: 'if … elif … else … endif', filter: 'if', detail: 'if/elif/else block', body: '{% if ${1:condition} %}\n  $0\n{% elif ${2:other_condition} %}\n  \n{% else %}\n  \n{% endif %}' },
  { label: 'for … endfor', filter: 'for', detail: 'for loop', body: '{% for ${1:item} in ${2:items} %}\n  $0\n{% endfor %}' },
  { label: 'for … else … endfor', filter: 'for', detail: 'for loop with empty-case else', body: '{% for ${1:item} in ${2:items} %}\n  $0\n{% else %}\n  \n{% endfor %}' },
  { label: 'set (inline)', filter: 'set', detail: 'inline set statement', body: '{% set ${1:name} = ${2:value} %}' },
  { label: 'set … endset', filter: 'set', detail: 'block set statement', body: '{% set ${1:name} %}\n  $0\n{% endset %}' },
  { label: 'block … endblock', filter: 'block', detail: 'Jinja block', body: '{% block ${1:name} %}\n  $0\n{% endblock %}' },
  { label: 'macro … endmacro', filter: 'macro', detail: 'Jinja macro', body: '{% macro ${1:name}(${2:args}) %}\n  $0\n{% endmacro %}' },
  { label: 'with … endwith', filter: 'with', detail: 'Jinja with block', body: '{% with ${1:name} = ${2:value} %}\n  $0\n{% endwith %}' },
  { label: 'filter … endfilter', filter: 'filter', detail: 'Jinja filter block', body: '{% filter ${1:filtername} %}\n  $0\n{% endfilter %}' },
  { label: 'call … endcall', filter: 'call', detail: 'Jinja call block', body: '{% call ${1:macro_name}(${2:args}) %}\n  $0\n{% endcall %}' },
  { label: 'from … import', filter: 'from', detail: 'Jinja from-import', body: '{% from "${1:template}" import ${2:name} with context %}' },
  { label: 'import … as', filter: 'import', detail: 'Jinja import', body: '{% import "${1:template}" as ${2:name} with context %}' },
  { label: 'include', filter: 'include', detail: 'Jinja include', body: '{% include "${1:template}" %}' },
  { label: 'raw … endraw', filter: 'raw', detail: 'Jinja raw block', body: '{% raw %}\n  $0\n{% endraw %}' },
  { label: 'trans … endtrans', filter: 'trans', detail: 'Jinja trans block', body: '{% trans %}$0{% endtrans %}' }
];

function makeItem(label, kind, insertText, detail) {
  const item = new vscode.CompletionItem(label, kind);
  if (insertText) {
    item.insertText = insertText instanceof vscode.SnippetString ? insertText : insertText;
  }
  if (detail) {
    item.detail = detail;
  }
  return item;
}

function insideJinjaTag(linePrefix) {
  const lastOpen = Math.max(
    linePrefix.lastIndexOf('{{'),
    linePrefix.lastIndexOf('{%')
  );
  if (lastOpen === -1) {
    return false;
  }
  const closeAfter = linePrefix.slice(lastOpen).search(/(\}\}|%\})/);
  return closeAfter === -1;
}

function activate(context) {
  const selector = { language: 'sls' };

  // Deletes the "mod." the user typed and inserts the full
  // {{ sls }}.<state_id>: / mod.fn: / ...args block as a live, tabbable
  // snippet. Invoked as a completion item's `command` rather than via plain
  // insertText+range, since a completion range that widens backward past
  // the "." trigger character isn't reliably honored by the editor.
  const insertStateBlockCommand = vscode.commands.registerCommand(
    'saltstack-sls.insertStateBlock',
    async (mod, fn) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const position = editor.selection.active;
      const linePrefix = editor.document.lineAt(position).text.slice(0, position.character);
      const dotMatch = linePrefix.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\.$/);
      if (!dotMatch || dotMatch[2] !== mod) {
        return;
      }
      const modStart = position.character - mod.length - 1;
      const range = new vscode.Range(position.line, modStart, position.line, position.character);
      const fields = FUNCTION_FIELDS[`${mod}.${fn}`] || DEFAULT_FIELDS;
      const args = buildArgsBody(fields, '    ', 2);
      const snippet = new vscode.SnippetString(
        `{{ sls }}.\${1:state_id}:\n  ${mod}.${fn}:\n${args.text}`
      );
      await editor.edit((editBuilder) => editBuilder.delete(range));
      await editor.insertSnippet(snippet, new vscode.Position(position.line, modStart));
    }
  );

  // module.function state completions, e.g. "pkg." -> installed/removed/...
  const stateProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);

        const dotMatch = linePrefix.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\.$/);
        if (dotMatch && MODULE_FUNCTIONS[dotMatch[2]]) {
          const indent = dotMatch[1];
          const mod = dotMatch[2];
          const atTopLevel = indent.length === 0;

          return MODULE_FUNCTIONS[mod].map((fn) => {
            const fields = FUNCTION_FIELDS[`${mod}.${fn}`] || DEFAULT_FIELDS;
            const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
            item.detail = `${mod}.${fn}`;

            if (atTopLevel) {
              // Fresh state block: generate the {{ sls }} id line too, then
              // jump from the id straight into each argument that needs
              // filling. This needs to replace the "file." already typed,
              // not just insert after it — but CompletionItem.range doesn't
              // reliably widen backward past the "." trigger character in
              // practice, so instead this suppresses the normal insert and
              // runs a command that explicitly deletes "file." and inserts
              // the real snippet via editor.insertSnippet().
              item.insertText = '';
              item.command = {
                command: 'saltstack-sls.insertStateBlock',
                title: 'Insert full state block',
                arguments: [mod, fn]
              };
              const args = buildArgsBody(fields, '    ', 2);
              item.documentation = new vscode.MarkdownString(
                `Inserts a full state block:\n\n\`\`\`sls\n{{ sls }}.<state_id>:\n  ${mod}.${fn}:\n${args.text.replace(/\$\{\d+:?([^}]*)\}/g, '$1').replace(/\$0/g, '')}\n\`\`\``
              );
            } else {
              // Already indented under an existing state id: just the function stub.
              const args = buildArgsBody(fields, '  ', 1);
              item.insertText = new vscode.SnippetString(`${fn}:\n${args.text}`);
            }
            return item;
          });
        }

        // Offer module names at the start of a state-ID's function line
        // (2-6 space indent). Deliberately not offered at column 0 too: a
        // top-level line is a free-form state id, and suggesting module
        // names there would just be noise while typing it. Typing the
        // module name and "." at column 0 still works via dotMatch above.
        const moduleMatch = linePrefix.match(/^(\s{2,6})([A-Za-z_]*)$/);
        if (moduleMatch) {
          return Object.keys(MODULE_FUNCTIONS).map((mod) => {
            const item = new vscode.CompletionItem(mod, vscode.CompletionItemKind.Module);
            item.insertText = mod;
            item.commitCharacters = ['.'];
            item.detail = 'Salt execution module';
            return item;
          });
        }

        return undefined;
      }
    },
    '.'
  );

  // Requisite / common state-argument keys after "- ".
  const requisiteProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        if (!/^\s*-\s*[A-Za-z_]*$/.test(linePrefix)) {
          return undefined;
        }
        return REQUISITE_KEYS.map((key) => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
          item.insertText = new vscode.SnippetString(`${key}: \${0}`);
          return item;
        });
      }
    },
    '-'
  );

  // Jinja keywords / filters / globals inside {{ ... }} and {% ... %}.
  const jinjaProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);

        // Only react to an actual word being typed (or right after {{ / {% / |).
        // Without this, every space keystroke inside an open tag would re-dump
        // the full keyword/filter/global list with nothing to filter it by.
        const justTypedWord = /[A-Za-z_][A-Za-z0-9_]*$/.test(linePrefix);
        const justOpenedTag = /(\{\{|\{%|\|)\s*$/.test(linePrefix);
        if (!justTypedWord && !justOpenedTag) {
          return undefined;
        }

        if (insideJinjaTag(linePrefix)) {
          const items = [];
          JINJA_KEYWORDS.forEach((kw) =>
            items.push(makeItem(kw, vscode.CompletionItemKind.Keyword, kw, 'Jinja keyword'))
          );
          JINJA_FILTERS.forEach((f) =>
            items.push(makeItem(f, vscode.CompletionItemKind.Function, f, 'Jinja filter'))
          );
          JINJA_GLOBALS.forEach((g) =>
            items.push(makeItem(g, vscode.CompletionItemKind.Variable, g, 'Salt/Jinja global'))
          );
          return items;
        }

        // Not inside an open tag yet: let typing a bare keyword (e.g. "for") offer
        // the whole {% ... %} block(s) as snippets, so completion kicks in without
        // the tag delimiters being typed by hand first. Several variants (e.g. "if",
        // "if/else", "if/elif/else") share the same filter text so they all show up
        // together for the one keyword typed, instead of guessing which shape you want.
        if (!justTypedWord) {
          return undefined;
        }
        return JINJA_BLOCK_SNIPPETS.map((s, i) => {
          const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Snippet);
          item.insertText = new vscode.SnippetString(s.body);
          item.detail = s.detail;
          item.filterText = s.filter;
          item.sortText = `${String(i).padStart(3, '0')}_${s.filter}`;
          return item;
        });
      }
    },
    '{',
    '%',
    '|'
  );

  context.subscriptions.push(insertStateBlockCommand, stateProvider, requisiteProvider, jinjaProvider);
}

function deactivate() {}

module.exports = { activate, deactivate };
