const vscode = require('vscode');

// All 128 of Salt's official state modules that exist in v3008.2 (the latest
// stable release as of writing) -- docs.saltproject.io/en/latest/ref/states/all
// lists 131, but 3 (dnfmodule, postgres_default_privileges, python) only exist
// on the unreleased master branch, and pkg on master also has 2 extra functions
// (trusted/untrusted) not yet in any release; this list deliberately excludes
// all of those so it doesn't suggest states that don't exist in the Salt most
// people actually have installed. Extracted directly from salt/states/*.py on
// the saltstack/salt GitHub repo at tag v3008.2, not hand-guessed: a function
// only counts as a real state function here if it's a top-level `def` whose
// first parameter is literally `name` (Salt's actual convention for state
// functions), which also excludes internal hook functions (mod_init,
// mod_aggregate, mod_watch, mod_beacon, ...) that Salt calls automatically and
// that are never written as `module.function:` by hand in an SLS file. A
// handful of real state functions that don't follow the name-first convention
// (module.run, postgres_cluster/schema.absent) were confirmed by hand and
// added back in. Each module's key is its actual public SLS name (from
// `__virtualname__` where Salt overrides the filename, e.g. pip_state.py ->
// pip, virtualenv_mod.py -> virtualenv) -- not always the same as the source
// filename. Re-extraction steps (e.g. to bump to a newer release) are in
// AGENTS.md.
const MODULE_FUNCTIONS = {
  acl: ['absent', 'list_absent', 'list_present', 'present'],
  alias: ['absent', 'present'],
  ansible: ['playbooks'],
  apache: ['configfile'],
  apache_conf: ['disabled', 'enabled'],
  apache_module: ['disabled', 'enabled'],
  apache_site: ['disabled', 'enabled'],
  appx: ['absent'],
  archive: ['extracted'],
  assistive: ['installed'],
  at: ['absent', 'present', 'watch'],
  beacon: ['absent', 'disabled', 'enabled', 'present'],
  blockdev: ['formatted', 'tuned'],
  certutil: ['add_store', 'del_store'],
  chocolatey: ['bootstrapped', 'installed', 'source_present', 'unbootstrapped', 'uninstalled', 'upgraded'],
  cloud: ['absent', 'present', 'profile', 'volume_absent', 'volume_attached', 'volume_detached', 'volume_present'],
  cmd: ['call', 'run', 'script', 'wait', 'wait_call', 'wait_script'],
  cron: ['absent', 'env_absent', 'env_present', 'file', 'present'],
  debconf: ['set', 'set_file'],
  disk: ['status'],
  dism: ['capability_installed', 'capability_removed', 'feature_installed', 'feature_removed', 'kb_removed', 'package_installed', 'package_removed', 'provisioned_package_installed'],
  dsc_resource: ['managed'],
  environ: ['setenv'],
  etcd: ['directory', 'rm', 'set', 'wait_rm', 'wait_set'],
  event: ['send', 'wait'],
  file: ['absent', 'accumulated', 'append', 'blockreplace', 'cached', 'comment', 'copy', 'decode', 'directory', 'exists', 'hardlink', 'keyvalue', 'line', 'managed', 'missing', 'mknod', 'not_cached', 'patch', 'prepend', 'pruned', 'recurse', 'rename', 'replace', 'retention_schedule', 'serialize', 'shortcut', 'symlink', 'tidied', 'touch', 'uncomment'],
  firewall: ['check'],
  firewalld: ['present', 'service'],
  git: ['cloned', 'config_set', 'config_unset', 'detached', 'latest', 'present'],
  gpg: ['absent', 'present'],
  grains: ['absent', 'append', 'exists', 'list_absent', 'list_present', 'present'],
  group: ['absent', 'present'],
  highstate_doc: ['note'],
  host: ['absent', 'only', 'present'],
  http: ['query', 'wait_for_successful_query'],
  idem: ['state'],
  ini: ['options_absent', 'options_present', 'sections_absent', 'sections_present'],
  ipset: ['absent', 'flush', 'present', 'set_absent', 'set_present'],
  iptables: ['append', 'chain_absent', 'chain_present', 'delete', 'flush', 'insert', 'set_policy'],
  keyboard: ['system', 'xorg'],
  keychain: ['default_keychain', 'installed', 'uninstalled'],
  kmod: ['absent', 'present'],
  lgpo: ['set'],
  lgpo_reg: ['refresh_policy', 'value_absent', 'value_disabled', 'value_present'],
  license: ['activate'],
  locale: ['present', 'system'],
  logrotate: ['set'],
  loop: ['until', 'until_no_eval'],
  lvm: ['lv_absent', 'lv_present', 'pv_absent', 'pv_present', 'vg_absent', 'vg_present'],
  macdefaults: ['absent', 'write'],
  macpackage: ['installed'],
  makeconf: ['absent', 'present'],
  module: ['run', 'wait'],
  mount: ['fstab_absent', 'fstab_present', 'mounted', 'swap', 'unmounted'],
  netacl: ['filter', 'managed', 'term'],
  netconfig: ['commit_cancelled', 'commit_confirmed', 'managed', 'replace_pattern', 'saved'],
  netntp: ['managed'],
  netsnmp: ['managed'],
  netusers: ['managed'],
  network: ['managed', 'routes', 'system'],
  nftables: ['append', 'chain_absent', 'chain_present', 'delete', 'flush', 'insert', 'set_policy', 'table_absent', 'table_present'],
  ntp: ['managed'],
  pip: ['installed', 'removed', 'uptodate'],
  pkg: ['downloaded', 'group_installed', 'held', 'installed', 'latest', 'patch_downloaded', 'patch_installed', 'purged', 'removed', 'unheld', 'uptodate'],
  pkgbuild: ['built', 'repo'],
  pkgng: ['update_packaging_site'],
  pkgrepo: ['absent', 'managed'],
  postgres_cluster: ['absent', 'present'],
  postgres_database: ['absent', 'present'],
  postgres_extension: ['absent', 'present'],
  postgres_group: ['absent', 'present'],
  postgres_initdb: ['present'],
  postgres_language: ['absent', 'present'],
  postgres_privileges: ['absent', 'present'],
  postgres_schema: ['absent', 'present'],
  postgres_tablespace: ['absent', 'present'],
  postgres_user: ['absent', 'present'],
  powercfg: ['set_timeout'],
  process: ['absent'],
  proxy: ['managed'],
  pyenv: ['absent', 'install_pyenv', 'installed'],
  quota: ['mode'],
  rabbitmq_cluster: ['joined'],
  rabbitmq_plugin: ['disabled', 'enabled'],
  rabbitmq_policy: ['absent', 'present'],
  rabbitmq_upstream: ['absent', 'present'],
  rabbitmq_user: ['absent', 'present'],
  rabbitmq_vhost: ['absent', 'present'],
  raid: ['absent', 'present'],
  reg: ['absent', 'key_absent', 'present'],
  salt: ['function', 'parallel_runners', 'runner', 'state', 'wait_for_event', 'wheel'],
  salt_proxy: ['configure_proxy'],
  saltutil: ['sync_all', 'sync_beacons', 'sync_clouds', 'sync_engines', 'sync_executors', 'sync_grains', 'sync_log_handlers', 'sync_matchers', 'sync_modules', 'sync_output', 'sync_outputters', 'sync_pillar', 'sync_proxymodules', 'sync_renderers', 'sync_resources', 'sync_returners', 'sync_sdb', 'sync_serializers', 'sync_states', 'sync_thorium', 'sync_tops', 'sync_utils', 'sync_wrapper'],
  schedule: ['absent', 'disabled', 'enabled', 'present'],
  selinux: ['boolean', 'fcontext_policy_absent', 'fcontext_policy_applied', 'fcontext_policy_present', 'mode', 'module', 'module_install', 'module_remove', 'port_policy_absent', 'port_policy_present'],
  service: ['dead', 'disabled', 'enabled', 'masked', 'running', 'unmasked'],
  shortcut: ['present'],
  ssh_auth: ['absent', 'manage', 'present'],
  ssh_known_hosts: ['absent', 'present'],
  ssh_pki: ['certificate_managed', 'certificate_managed_ssh', 'private_key_managed', 'private_key_managed_ssh', 'public_key_managed'],
  stateconf: ['context', 'set'],
  status: ['loadavg', 'process'],
  sysctl: ['present'],
  sysfs: ['present'],
  syslog_ng: ['config', 'reloaded', 'started', 'stopped'],
  system: ['computer_desc', 'computer_name', 'hostname', 'join_domain', 'reboot', 'shutdown', 'workgroup'],
  task: ['absent', 'present'],
  test: ['check_pillar', 'configurable_test_state', 'fail_with_changes', 'fail_without_changes', 'nop', 'show_notification', 'succeed_with_changes', 'succeed_without_changes'],
  timezone: ['system'],
  tls: ['valid_certificate'],
  uptime: ['monitored'],
  user: ['absent', 'present'],
  virtualenv: ['managed'],
  win_dacl: ['absent', 'disinherit', 'inherit', 'present'],
  win_dns_client: ['dns_dhcp', 'dns_exists', 'primary_suffix'],
  win_firewall: ['add_rule', 'disabled', 'enabled'],
  win_iis: ['container_setting', 'create_app', 'create_apppool', 'create_binding', 'create_cert_binding', 'create_vdir', 'deployed', 'remove_app', 'remove_apppool', 'remove_binding', 'remove_cert_binding', 'remove_site', 'remove_vdir', 'set_app', 'webconfiguration_settings'],
  win_path: ['absent', 'exists'],
  win_pki: ['import_cert', 'remove_cert'],
  win_servermanager: ['installed', 'removed'],
  win_smtp_server: ['active_log_format', 'connection_ip_list', 'relay_ip_list', 'server_setting'],
  win_snmp: ['agent_settings', 'auth_traps_enabled', 'community_names'],
  winrepo: ['genrepo'],
  wua: ['installed', 'removed', 'uptodate'],
  wusa: ['installed', 'uninstalled'],
  x509: ['certificate_managed', 'crl_managed', 'csr_managed', 'pem_managed', 'private_key_managed'],
  x509_v2: ['certificate_managed', 'certificate_managed_ssh', 'crl_managed', 'csr_managed', 'pem_managed', 'private_key_managed', 'private_key_managed_ssh'],
  xattr: ['delete', 'exists']
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

// Every module.function with at least one parameter that has no default at
// all in its real Salt v3008.2 signature (Python would raise TypeError
// without it) -- generated the same way as MODULE_FUNCTIONS/
// FULL_FUNCTION_FIELDS, not hand-written. Used to guarantee "basic" always
// includes these, even for functions with no curated FUNCTION_FIELDS entry:
// showing just `name` for something like acl.absent (which also needs
// acl_type) would produce a state Salt rejects outright.

const MANDATORY_FIELDS = {
  'acl.absent': ['acl_type'],
  'acl.list_absent': ['acl_type'],
  'acl.list_present': ['acl_type'],
  'acl.present': ['acl_type'],
  'alias.present': ['target'],
  'apache.configfile': ['config'],
  'appx.absent': ['query'],
  'archive.extracted': ['source'],
  'at.present': ['timespec'],
  'at.watch': ['timespec'],
  'certutil.add_store': ['store'],
  'certutil.del_store': ['store'],
  'chocolatey.source_present': ['source_location'],
  'cloud.present': ['cloud_provider'],
  'cloud.profile': ['profile'],
  'cloud.volume_attached': ['server_name'],
  'cmd.call': ['func'],
  'cmd.wait_call': ['func'],
  'debconf.set': ['data'],
  'debconf.set_file': ['source'],
  'dsc_resource.managed': ['module_name', 'properties'],
  'environ.setenv': ['value'],
  'etcd.set': ['value'],
  'etcd.wait_set': ['value'],
  'file.accumulated': ['filename', 'text'],
  'file.comment': ['regex'],
  'file.copy': ['source'],
  'file.hardlink': ['target'],
  'file.mknod': ['ntype'],
  'file.recurse': ['source'],
  'file.rename': ['source'],
  'file.replace': ['pattern', 'repl'],
  'file.retention_schedule': ['retain'],
  'file.shortcut': ['target'],
  'file.symlink': ['target'],
  'file.uncomment': ['regex'],
  'git.cloned': ['target'],
  'git.detached': ['rev', 'target'],
  'git.latest': ['target'],
  'grains.append': ['value'],
  'grains.list_absent': ['value'],
  'grains.list_present': ['value'],
  'grains.present': ['value'],
  'host.absent': ['ip'],
  'host.only': ['hostnames'],
  'host.present': ['ip'],
  'idem.state': ['sls'],
  'ipset.set_present': ['set_type'],
  'keychain.installed': ['password'],
  'keychain.uninstalled': ['password'],
  'lgpo_reg.value_absent': ['key'],
  'lgpo_reg.value_disabled': ['key'],
  'lgpo_reg.value_present': ['key', 'v_data'],
  'logrotate.set': ['key', 'value'],
  'loop.until_no_eval': ['expected'],
  'macdefaults.absent': ['domain'],
  'macdefaults.write': ['domain', 'value'],
  'mount.fstab_absent': ['fs_file'],
  'mount.fstab_present': ['fs_file', 'fs_vfstype'],
  'mount.mounted': ['device', 'fstype'],
  'netacl.term': ['filter_name', 'term_name'],
  'netconfig.replace_pattern': ['pattern', 'repl'],
  'pkgbuild.built': ['runas', 'dest_dir', 'spec', 'sources', 'tgt'],
  'postgres_cluster.absent': ['version'],
  'postgres_cluster.present': ['version'],
  'postgres_language.absent': ['maintenance_db'],
  'postgres_language.present': ['maintenance_db'],
  'postgres_privileges.absent': ['object_name', 'object_type'],
  'postgres_privileges.present': ['object_name', 'object_type'],
  'postgres_schema.absent': ['dbname'],
  'postgres_schema.present': ['dbname'],
  'postgres_tablespace.present': ['directory'],
  'powercfg.set_timeout': ['value'],
  'proxy.managed': ['port'],
  'quota.mode': ['mode', 'quotatype'],
  'rabbitmq_cluster.joined': ['host'],
  'rabbitmq_policy.present': ['pattern', 'definition'],
  'rabbitmq_upstream.present': ['uri'],
  'raid.present': ['level', 'devices'],
  'salt.function': ['tgt'],
  'salt.parallel_runners': ['runners'],
  'salt.state': ['tgt'],
  'salt.wait_for_event': ['id_list'],
  'selinux.fcontext_policy_present': ['sel_type'],
  'selinux.port_policy_present': ['sel_type'],
  'ssh_auth.absent': ['user'],
  'ssh_auth.manage': ['ssh_keys', 'user'],
  'ssh_auth.present': ['user'],
  'ssh_pki.certificate_managed_ssh': ['result', 'comment', 'changes'],
  'ssh_pki.private_key_managed_ssh': ['result', 'comment', 'changes'],
  'ssh_pki.public_key_managed': ['public_key_source'],
  'sysctl.present': ['value'],
  'sysfs.present': ['value'],
  'syslog_ng.config': ['config'],
  'win_dacl.absent': ['objectType', 'user', 'permission', 'acetype', 'propagation'],
  'win_dacl.disinherit': ['objectType'],
  'win_dacl.inherit': ['objectType'],
  'win_dacl.present': ['objectType', 'user', 'permission', 'acetype', 'propagation'],
  'win_firewall.add_rule': ['localport'],
  'win_iis.container_setting': ['container'],
  'win_iis.create_app': ['site', 'sourcepath'],
  'win_iis.create_binding': ['site'],
  'win_iis.create_cert_binding': ['site'],
  'win_iis.create_vdir': ['site', 'sourcepath'],
  'win_iis.deployed': ['sourcepath'],
  'win_iis.remove_app': ['site'],
  'win_iis.remove_binding': ['site'],
  'win_iis.remove_cert_binding': ['site'],
  'win_iis.remove_vdir': ['site'],
  'win_iis.set_app': ['site'],
  'win_pki.remove_cert': ['thumbprint'],
  'win_smtp_server.active_log_format': ['log_format'],
  'win_snmp.agent_settings': ['contact', 'location'],
  'wusa.installed': ['source'],
  'x509.crl_managed': ['signing_private_key'],
  'x509.pem_managed': ['text'],
  'x509_v2.certificate_managed_ssh': ['result', 'comment', 'changes'],
  'x509_v2.crl_managed': ['signing_private_key', 'revoked'],
  'x509_v2.csr_managed': ['private_key'],
  'x509_v2.pem_managed': ['text'],
  'x509_v2.private_key_managed_ssh': ['result', 'comment', 'changes'],
  'xattr.delete': ['attributes'],
  'xattr.exists': ['attributes']
};

// Picks which argument set a completion item should use.
function getFields(mod, fn, variant) {
  const key = `${mod}.${fn}`;
  if (variant === 'full' && FULL_FUNCTION_FIELDS[key] && FULL_FUNCTION_FIELDS[key].length > 0) {
    return FULL_FUNCTION_FIELDS[key];
  }
  return getBasicFields(mod, fn);
}

// "basic" = the curated common set (or just `name` if nothing's curated for
// this function), with any genuinely mandatory parameter merged in that
// isn't already present -- pulling its real default-or-placeholder from
// FULL_FUNCTION_FIELDS when available, falling back to the bare param name
// otherwise. This is what keeps "basic" from ever omitting something Salt
// would actually require.
function getBasicFields(mod, fn) {
  const key = `${mod}.${fn}`;
  const curated = FUNCTION_FIELDS[key];
  const required = MANDATORY_FIELDS[key] || [];
  const fields = curated ? curated.slice() : [['name', 'name']];
  if (required.length === 0) {
    return fields;
  }
  const present = new Set(fields.map(([k]) => k));
  const fullFields = FULL_FUNCTION_FIELDS[key] || [];
  required.forEach((paramName) => {
    if (present.has(paramName)) {
      return;
    }
    const fromFull = fullFields.find(([k]) => k === paramName);
    fields.push(fromFull ? fromFull : [paramName, paramName]);
    present.add(paramName);
  });
  return fields;
}

function availableVariants(mod, fn) {
  const key = `${mod}.${fn}`;
  const variants = ['basic'];
  if (FULL_FUNCTION_FIELDS[key] && FULL_FUNCTION_FIELDS[key].length > 0) {
    variants.push('full');
  }
  return variants;
}

// Full (all-arguments) variant of the same data, keyed the same way, generated
// the same way as MODULE_FUNCTIONS (real function signatures from Salt
// v3008.2 source, not hand-written) -- see the comment above MODULE_FUNCTIONS
// and AGENTS.md's "Updating the Salt module/function list" section. Only
// includes module.function pairs that actually have parameters beyond
// `name`; nothing to show "full" for is just omitted rather than duplicating
// the basic/name-only entry.
const FULL_FUNCTION_FIELDS = {
  'acl.absent': [['acl_type', 'acl_type'], ['acl_name', '\'\''], ['perms', '\'\''], ['recurse', 'False']],
  'acl.list_absent': [['acl_type', 'acl_type'], ['acl_names', 'None'], ['recurse', 'False']],
  'acl.list_present': [['acl_type', 'acl_type'], ['acl_names', 'None'], ['perms', '\'\''], ['recurse', 'False'], ['force', 'False']],
  'acl.present': [['acl_type', 'acl_type'], ['acl_name', '\'\''], ['perms', '\'\''], ['recurse', 'False'], ['force', 'False']],
  'alias.present': [['target', 'target']],
  'ansible.playbooks': [['rundir', 'None'], ['git_repo', 'None'], ['git_kwargs', 'None'], ['ansible_kwargs', 'None']],
  'apache.configfile': [['config', 'config']],
  'appx.absent': [['query', 'query'], ['include_store', 'False'], ['frameworks', 'False'], ['deprovision_only', 'False']],
  'archive.extracted': [['source', 'source'], ['source_hash', 'None'], ['source_hash_name', 'None'], ['source_hash_update', 'False'], ['skip_files_list_verify', 'False'], ['skip_verify', 'False'], ['password', 'None'], ['options', 'None'], ['list_options', 'None'], ['force', 'False'], ['overwrite', 'False'], ['clean', 'False'], ['clean_parent', 'False'], ['user', 'None'], ['group', 'None'], ['if_missing', 'None'], ['trim_output', 'False'], ['use_cmd_unzip', 'None'], ['extract_perms', 'True'], ['enforce_toplevel', 'True'], ['enforce_ownership_on', 'None'], ['archive_format', 'None'], ['use_etag', 'False'], ['signature', 'None'], ['source_hash_sig', 'None'], ['signed_by_any', 'None'], ['signed_by_all', 'None'], ['keyring', 'None'], ['gnupghome', 'None'], ['sig_backend', 'gpg']],
  'assistive.installed': [['enabled', 'True']],
  'at.absent': [['jobid', 'None']],
  'at.present': [['timespec', 'timespec'], ['tag', 'None'], ['user', 'None'], ['job', 'None'], ['unique_tag', 'False']],
  'at.watch': [['timespec', 'timespec'], ['tag', 'None'], ['user', 'None'], ['job', 'None'], ['unique_tag', 'False']],
  'beacon.absent': [['save', 'False']],
  'beacon.present': [['save', 'False']],
  'blockdev.formatted': [['fs_type', 'ext4'], ['force', 'False']],
  'certutil.add_store': [['store', 'store'], ['saltenv', 'base']],
  'certutil.del_store': [['store', 'store'], ['saltenv', 'base']],
  'chocolatey.bootstrapped': [['force', 'False'], ['source', 'None'], ['version', 'None']],
  'chocolatey.installed': [['version', 'None'], ['source', 'None'], ['force', 'False'], ['pre_versions', 'False'], ['install_args', 'None'], ['override_args', 'False'], ['force_x86', 'False'], ['package_args', 'None'], ['allow_multiple', 'False'], ['execution_timeout', 'None'], ['virus_check', 'None']],
  'chocolatey.source_present': [['source_location', 'source_location'], ['username', 'None'], ['password', 'None'], ['force', 'False'], ['priority', 'None']],
  'chocolatey.uninstalled': [['version', 'None'], ['uninstall_args', 'None'], ['override_args', 'False']],
  'chocolatey.upgraded': [['version', 'None'], ['source', 'None'], ['force', 'False'], ['pre_versions', 'False'], ['install_args', 'None'], ['override_args', 'False'], ['force_x86', 'False'], ['package_args', 'None']],
  'cloud.absent': [['onlyif', 'None'], ['unless', 'None']],
  'cloud.present': [['cloud_provider', 'cloud_provider'], ['onlyif', 'None'], ['unless', 'None'], ['opts', 'None']],
  'cloud.profile': [['profile', 'profile'], ['onlyif', 'None'], ['unless', 'None'], ['opts', 'None']],
  'cloud.volume_absent': [['provider', 'None']],
  'cloud.volume_attached': [['server_name', 'server_name'], ['provider', 'None']],
  'cloud.volume_detached': [['server_name', 'None'], ['provider', 'None']],
  'cloud.volume_present': [['provider', 'None']],
  'cmd.call': [['func', 'func'], ['args', '()'], ['kws', 'None'], ['output_loglevel', 'debug'], ['hide_output', 'False'], ['use_vt', 'False']],
  'cmd.run': [['cwd', 'None'], ['root', 'None'], ['runas', 'None'], ['password', 'None'], ['shell', 'None'], ['env', 'None'], ['prepend_path', 'None'], ['stateful', 'False'], ['output_loglevel', 'debug'], ['hide_output', 'False'], ['timeout', 'None'], ['ignore_timeout', 'False'], ['use_vt', 'False'], ['success_retcodes', 'None'], ['success_stdout', 'None'], ['success_stderr', 'None']],
  'cmd.script': [['source', 'None'], ['template', 'None'], ['cwd', 'None'], ['runas', 'None'], ['password', 'None'], ['shell', 'None'], ['env', 'None'], ['stateful', 'False'], ['timeout', 'None'], ['use_vt', 'False'], ['output_loglevel', 'debug'], ['hide_output', 'False'], ['defaults', 'None'], ['context', 'None'], ['success_retcodes', 'None'], ['success_stdout', 'None'], ['success_stderr', 'None']],
  'cmd.wait': [['cwd', 'None'], ['root', 'None'], ['runas', 'None'], ['shell', 'None'], ['env', '()'], ['stateful', 'False'], ['output_loglevel', 'debug'], ['hide_output', 'False'], ['use_vt', 'False'], ['success_retcodes', 'None'], ['success_stdout', 'None'], ['success_stderr', 'None']],
  'cmd.wait_call': [['func', 'func'], ['args', '()'], ['kws', 'None'], ['stateful', 'False'], ['use_vt', 'False'], ['output_loglevel', 'debug'], ['hide_output', 'False']],
  'cmd.wait_script': [['source', 'None'], ['template', 'None'], ['cwd', 'None'], ['runas', 'None'], ['shell', 'None'], ['env', 'None'], ['stateful', 'False'], ['use_vt', 'False'], ['output_loglevel', 'debug'], ['hide_output', 'False'], ['success_retcodes', 'None'], ['success_stdout', 'None'], ['success_stderr', 'None']],
  'cron.absent': [['user', 'root'], ['identifier', 'False'], ['special', 'None']],
  'cron.env_absent': [['user', 'root']],
  'cron.env_present': [['value', 'None'], ['user', 'root']],
  'cron.file': [['source_hash', '\'\''], ['source_hash_name', 'None'], ['user', 'root'], ['template', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['backup', '\'\'']],
  'cron.present': [['user', 'root'], ['minute', '*'], ['hour', '*'], ['daymonth', '*'], ['month', '*'], ['dayweek', '*'], ['comment', 'None'], ['commented', 'False'], ['identifier', 'False'], ['special', 'None']],
  'debconf.set': [['data', 'data']],
  'debconf.set_file': [['source', 'source'], ['template', 'None'], ['context', 'None'], ['defaults', 'None']],
  'disk.status': [['maximum', 'None'], ['minimum', 'None'], ['absolute', 'False'], ['free', 'False']],
  'dism.capability_installed': [['source', 'None'], ['limit_access', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.capability_removed': [['image', 'None'], ['restart', 'False']],
  'dism.feature_installed': [['package', 'None'], ['source', 'None'], ['limit_access', 'False'], ['enable_parent', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.feature_removed': [['remove_payload', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.kb_removed': [['image', 'None'], ['restart', 'False']],
  'dism.package_installed': [['ignore_check', 'False'], ['prevent_pending', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.package_removed': [['image', 'None'], ['restart', 'False']],
  'dism.provisioned_package_installed': [['image', 'None'], ['restart', 'False']],
  'dsc_resource.managed': [['module_name', 'module_name'], ['properties', 'properties']],
  'environ.setenv': [['value', 'value'], ['false_unsets', 'False'], ['clear_all', 'False'], ['update_minion', 'False'], ['permanent', 'False']],
  'etcd.directory': [['profile', 'None']],
  'etcd.rm': [['recurse', 'False'], ['profile', 'None']],
  'etcd.set': [['value', 'value'], ['profile', 'None']],
  'etcd.wait_rm': [['recurse', 'False'], ['profile', 'None']],
  'etcd.wait_set': [['value', 'value'], ['profile', 'None']],
  'event.send': [['data', 'None'], ['preload', 'None'], ['with_env', 'False'], ['with_grains', 'False'], ['with_pillar', 'False'], ['show_changed', 'True']],
  'event.wait': [['sfun', 'None'], ['data', 'None']],
  'file.accumulated': [['filename', 'filename'], ['text', 'text']],
  'file.append': [['text', 'None'], ['makedirs', 'False'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['ignore_whitespace', 'True'], ['show_changes', 'True']],
  'file.blockreplace': [['marker_start', '#-- start managed zone --'], ['marker_end', '#-- end managed zone --'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['content', '\'\''], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['backup', '.bak'], ['show_changes', 'True'], ['append_newline', 'None'], ['insert_before_match', 'None'], ['insert_after_match', 'None']],
  'file.cached': [['source_hash', '\'\''], ['source_hash_name', 'None'], ['skip_verify', 'False'], ['saltenv', 'base'], ['use_etag', 'False'], ['source_hash_sig', 'None'], ['signed_by_any', 'None'], ['signed_by_all', 'None'], ['keyring', 'None'], ['gnupghome', 'None'], ['sig_backend', 'gpg']],
  'file.comment': [['regex', 'regex'], ['char', '#'], ['backup', '.bak'], ['ignore_missing', 'False']],
  'file.copy': [['source', 'source'], ['force', 'False'], ['makedirs', 'False'], ['preserve', 'False'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['dir_mode', 'None'], ['subdir', 'False']],
  'file.decode': [['encoded_data', 'None'], ['contents_pillar', 'None'], ['encoding_type', 'base64'], ['checksum', 'md5']],
  'file.directory': [['user', 'None'], ['group', 'None'], ['recurse', 'None'], ['max_depth', 'None'], ['dir_mode', 'None'], ['file_mode', 'None'], ['makedirs', 'False'], ['clean', 'False'], ['require', 'None'], ['exclude_pat', 'None'], ['follow_symlinks', 'False'], ['force', 'False'], ['backupname', 'None'], ['allow_symlink', 'True'], ['children_only', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'file.hardlink': [['target', 'target'], ['force', 'False'], ['makedirs', 'False'], ['user', 'None'], ['group', 'None'], ['dir_mode', 'None']],
  'file.keyvalue': [['key', 'None'], ['value', 'None'], ['key_values', 'None'], ['separator', '='], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['search_only', 'False'], ['show_changes', 'True'], ['ignore_if_missing', 'False'], ['count', '1'], ['uncomment', 'None'], ['key_ignore_case', 'False'], ['value_ignore_case', 'False'], ['create_if_missing', 'False'], ['prune', 'False']],
  'file.line': [['content', 'None'], ['match', 'None'], ['mode', 'None'], ['location', 'None'], ['before', 'None'], ['after', 'None'], ['show_changes', 'True'], ['backup', 'False'], ['quiet', 'False'], ['indent', 'True'], ['create', 'False'], ['user', 'None'], ['group', 'None'], ['file_mode', 'None']],
  'file.managed': [['source', 'None'], ['source_hash', '\'\''], ['source_hash_name', 'None'], ['keep_source', 'True'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['attrs', 'None'], ['template', 'None'], ['makedirs', 'False'], ['dir_mode', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['backup', '\'\''], ['show_changes', 'True'], ['create', 'True'], ['contents', 'None'], ['tmp_dir', 'None'], ['tmp_ext', '\'\''], ['contents_pillar', 'None'], ['contents_grains', 'None'], ['contents_newline', 'True'], ['contents_delimiter', ':'], ['encoding', 'None'], ['encoding_errors', 'strict'], ['allow_empty', 'True'], ['follow_symlinks', 'True'], ['check_cmd', 'None'], ['skip_verify', 'False'], ['selinux', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False'], ['verify_ssl', 'True'], ['use_etag', 'False'], ['signature', 'None'], ['source_hash_sig', 'None'], ['signed_by_any', 'None'], ['signed_by_all', 'None'], ['keyring', 'None'], ['gnupghome', 'None'], ['ignore_ordering', 'False'], ['ignore_whitespace', 'False'], ['ignore_comment_characters', 'None'], ['new_file_diff', 'False'], ['sig_backend', 'gpg']],
  'file.mknod': [['ntype', 'ntype'], ['major', '0'], ['minor', '0'], ['user', 'None'], ['group', 'None'], ['mode', '0600']],
  'file.not_cached': [['saltenv', 'base']],
  'file.patch': [['source', 'None'], ['source_hash', 'None'], ['source_hash_name', 'None'], ['skip_verify', 'False'], ['template', 'None'], ['context', 'None'], ['defaults', 'None'], ['options', '\'\''], ['reject_file', 'None'], ['strip', 'None'], ['saltenv', 'None']],
  'file.prepend': [['text', 'None'], ['makedirs', 'False'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['header', 'None'], ['show_changes', 'True']],
  'file.pruned': [['recurse', 'False'], ['ignore_errors', 'False'], ['older_than', 'None']],
  'file.recurse': [['source', 'source'], ['keep_source', 'True'], ['clean', 'False'], ['require', 'None'], ['user', 'None'], ['group', 'None'], ['dir_mode', 'None'], ['file_mode', 'None'], ['sym_mode', 'None'], ['template', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['include_empty', 'False'], ['backup', '\'\''], ['include_pat', 'None'], ['exclude_pat', 'None'], ['maxdepth', 'None'], ['keep_symlinks', 'False'], ['force_symlinks', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['merge', 'False']],
  'file.rename': [['source', 'source'], ['force', 'False'], ['makedirs', 'False']],
  'file.replace': [['pattern', 'pattern'], ['repl', 'repl'], ['count', '0'], ['flags', '8'], ['bufsize', '1'], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['not_found_content', 'None'], ['backup', '.bak'], ['show_changes', 'True'], ['ignore_if_missing', 'False'], ['backslash_literal', 'False'], ['encoding', 'None']],
  'file.retention_schedule': [['retain', 'retain'], ['strptime_format', 'None'], ['timezone', 'None']],
  'file.serialize': [['dataset', 'None'], ['dataset_pillar', 'None'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['backup', '\'\''], ['makedirs', 'False'], ['show_changes', 'True'], ['create', 'True'], ['merge_if_exists', 'False'], ['encoding', 'None'], ['encoding_errors', 'strict'], ['serializer', 'None'], ['serializer_opts', 'None'], ['deserializer_opts', 'None'], ['check_cmd', 'None'], ['tmp_dir', 'None'], ['tmp_ext', '\'\'']],
  'file.shortcut': [['target', 'target'], ['arguments', 'None'], ['working_dir', 'None'], ['description', 'None'], ['icon_location', 'None'], ['force', 'False'], ['backupname', 'None'], ['makedirs', 'False'], ['user', 'None']],
  'file.symlink': [['target', 'target'], ['force', 'False'], ['backupname', 'None'], ['makedirs', 'False'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'None'], ['atomic', 'False'], ['disallow_copy_and_unlink', 'False'], ['inherit_user_and_group', 'False'], ['follow_symlinks', 'True']],
  'file.tidied': [['age', '0'], ['matches', 'None'], ['rmdirs', 'False'], ['size', '0'], ['exclude', 'None'], ['full_path_match', 'False'], ['followlinks', 'False'], ['time_comparison', 'atime'], ['age_size_logical_operator', 'OR'], ['age_size_only', 'None'], ['rmlinks', 'True']],
  'file.touch': [['atime', 'None'], ['mtime', 'None'], ['makedirs', 'False']],
  'file.uncomment': [['regex', 'regex'], ['char', '#'], ['backup', '.bak']],
  'firewall.check': [['port', 'None']],
  'firewalld.present': [['block_icmp', 'None'], ['prune_block_icmp', 'False'], ['default', 'None'], ['masquerade', 'None'], ['ports', 'None'], ['prune_ports', 'False'], ['port_fwd', 'None'], ['prune_port_fwd', 'False'], ['services', 'None'], ['prune_services', 'False'], ['interfaces', 'None'], ['prune_interfaces', 'False'], ['sources', 'None'], ['prune_sources', 'False'], ['rich_rules', 'None'], ['prune_rich_rules', 'False']],
  'firewalld.service': [['ports', 'None'], ['protocols', 'None']],
  'git.cloned': [['target', 'target'], ['branch', 'None'], ['user', 'None'], ['password', 'None'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['output_encoding', 'None']],
  'git.config_set': [['value', 'None'], ['multivar', 'None'], ['repo', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'git.config_unset': [['value_regex', 'None'], ['repo', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'git.detached': [['rev', 'rev'], ['target', 'target'], ['remote', 'origin'], ['user', 'None'], ['password', 'None'], ['force_clone', 'False'], ['force_checkout', 'False'], ['fetch_remote', 'True'], ['hard_reset', 'False'], ['submodules', 'False'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['output_encoding', 'None']],
  'git.latest': [['target', 'target'], ['rev', 'HEAD'], ['branch', 'None'], ['user', 'None'], ['password', 'None'], ['update_head', 'True'], ['force_checkout', 'False'], ['force_clone', 'False'], ['force_fetch', 'False'], ['force_reset', 'False'], ['submodules', 'False'], ['bare', 'False'], ['mirror', 'False'], ['remote', 'origin'], ['fetch_tags', 'True'], ['sync_tags', 'True'], ['depth', 'None'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['refspec_branch', '*'], ['refspec_tag', '*'], ['output_encoding', 'None']],
  'git.present': [['force', 'False'], ['bare', 'True'], ['template', 'None'], ['separate_git_dir', 'None'], ['shared', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'gpg.absent': [['keys', 'None'], ['user', 'None'], ['gnupghome', 'None'], ['keyring', 'None'], ['keyring_absent_if_empty', 'False']],
  'gpg.present': [['keys', 'None'], ['user', 'None'], ['keyserver', 'None'], ['gnupghome', 'None'], ['trust', 'None'], ['keyring', 'None'], ['source', 'None'], ['skip_keyserver', 'False'], ['text', 'None'], ['subkey_maxage', '100']],
  'grains.absent': [['destructive', 'False'], ['delimiter', 'DEFAULT_TARGET_DELIM'], ['force', 'False']],
  'grains.append': [['value', 'value'], ['convert', 'False'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.exists': [['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.list_absent': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.list_present': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.present': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM'], ['force', 'False']],
  'group.absent': [['local', 'False']],
  'group.present': [['gid', 'None'], ['system', 'False'], ['addusers', 'None'], ['delusers', 'None'], ['members', 'None'], ['non_unique', 'False'], ['local', 'False']],
  'highstate_doc.note': [['source', 'None'], ['contents', 'None']],
  'host.absent': [['ip', 'ip']],
  'host.only': [['hostnames', 'hostnames']],
  'host.present': [['ip', 'ip'], ['comment', '\'\''], ['clean', 'False']],
  'http.query': [['match', 'None'], ['match_type', 'string'], ['status', 'None'], ['status_type', 'string'], ['wait_for', 'None']],
  'http.wait_for_successful_query': [['wait_for', '300']],
  'idem.state': [['sls', 'sls'], ['acct_file', 'None'], ['acct_key', 'None'], ['acct_profile', 'None'], ['cache_dir', 'None'], ['render', 'None'], ['runtime', 'None'], ['source_dir', 'None'], ['test', 'False']],
  'ini.options_absent': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ini.options_present': [['sections', 'None'], ['separator', '='], ['strict', 'False'], ['encoding', 'None'], ['no_spaces', 'False']],
  'ini.sections_absent': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ini.sections_present': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ipset.absent': [['entry', 'None'], ['entries', 'None'], ['family', 'ipv4']],
  'ipset.flush': [['family', 'ipv4']],
  'ipset.present': [['entry', 'None'], ['family', 'ipv4']],
  'ipset.set_absent': [['family', 'ipv4']],
  'ipset.set_present': [['set_type', 'set_type'], ['family', 'ipv4']],
  'iptables.append': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.chain_absent': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.chain_present': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.delete': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.flush': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.insert': [['table', 'filter'], ['family', 'ipv4']],
  'iptables.set_policy': [['table', 'filter'], ['family', 'ipv4']],
  'keychain.default_keychain': [['domain', 'user'], ['user', 'None']],
  'keychain.installed': [['password', 'password'], ['keychain', '/Library/Keychains/System.keychain']],
  'keychain.uninstalled': [['password', 'password'], ['keychain', '/Library/Keychains/System.keychain'], ['keychain_password', 'None']],
  'kmod.absent': [['persist', 'False'], ['comment', 'True'], ['mods', 'None']],
  'kmod.present': [['persist', 'False'], ['mods', 'None']],
  'lgpo.set': [['setting', 'None'], ['policy_class', 'None'], ['computer_policy', 'None'], ['user_policy', 'None'], ['cumulative_rights_assignments', 'True'], ['adml_language', 'en-US'], ['refresh_cache', 'False']],
  'lgpo_reg.value_absent': [['key', 'key'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'lgpo_reg.value_disabled': [['key', 'key'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'lgpo_reg.value_present': [['key', 'key'], ['v_data', 'v_data'], ['v_type', 'REG_DWORD'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'logrotate.set': [['key', 'key'], ['value', 'value'], ['setting', 'None'], ['conf_file', '_DEFAULT_CONF']],
  'loop.until': [['m_args', 'None'], ['m_kwargs', 'None'], ['condition', 'None'], ['period', '1'], ['timeout', '60']],
  'loop.until_no_eval': [['expected', 'expected'], ['compare_operator', 'eq'], ['timeout', '60'], ['period', '1'], ['init_wait', '0'], ['args', 'None'], ['kwargs', 'None']],
  'lvm.lv_absent': [['vgname', 'None']],
  'lvm.lv_present': [['vgname', 'None'], ['size', 'None'], ['extents', 'None'], ['snapshot', 'None'], ['pv', '\'\''], ['thinvolume', 'False'], ['thinpool', 'False'], ['force', 'False'], ['resizefs', 'False']],
  'lvm.vg_present': [['devices', 'None']],
  'macdefaults.absent': [['domain', 'domain'], ['user', 'None'], ['name_separator', 'None']],
  'macdefaults.write': [['domain', 'domain'], ['value', 'value'], ['vtype', 'None'], ['name_separator', 'None'], ['user', 'None']],
  'macpackage.installed': [['target', 'LocalSystem'], ['dmg', 'False'], ['store', 'False'], ['app', 'False'], ['mpkg', 'False'], ['force', 'False'], ['allow_untrusted', 'False'], ['version_check', 'None']],
  'makeconf.present': [['value', 'None'], ['contains', 'None'], ['excludes', 'None']],
  'mount.fstab_absent': [['fs_file', 'fs_file'], ['mount_by', 'None'], ['config', '/etc/fstab']],
  'mount.fstab_present': [['fs_file', 'fs_file'], ['fs_vfstype', 'fs_vfstype'], ['fs_mntops', 'defaults'], ['fs_freq', '0'], ['fs_passno', '0'], ['mount_by', 'None'], ['config', '/etc/fstab'], ['mount', 'True'], ['match_on', 'auto'], ['not_change', 'False'], ['fs_mount', 'True']],
  'mount.mounted': [['device', 'device'], ['fstype', 'fstype'], ['mkmnt', 'False'], ['opts', 'defaults'], ['dump', '0'], ['pass_num', '0'], ['config', '/etc/fstab'], ['persist', 'True'], ['mount', 'True'], ['user', 'None'], ['match_on', 'auto'], ['device_name_regex', 'None'], ['extra_mount_invisible_options', 'None'], ['extra_mount_invisible_keys', 'None'], ['extra_mount_ignore_fs_keys', 'None'], ['extra_mount_translate_options', 'None'], ['hidden_opts', 'None'], ['bind_mount_copy_active_opts', 'True']],
  'mount.swap': [['persist', 'True'], ['config', '/etc/fstab']],
  'mount.unmounted': [['device', 'None'], ['config', '/etc/fstab'], ['persist', 'False'], ['user', 'None']],
  'netacl.filter': [['filter_options', 'None'], ['terms', 'None'], ['prepend', 'True'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['only_lower_merge', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False']],
  'netacl.managed': [['filters', 'None'], ['prepend', 'True'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['only_lower_merge', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False']],
  'netacl.term': [['filter_name', 'filter_name'], ['term_name', 'term_name'], ['filter_options', 'None'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False'], ['source_service', 'None'], ['destination_service', 'None']],
  'netconfig.managed': [['template_name', 'None'], ['template_source', 'None'], ['template_hash', 'None'], ['template_hash_name', 'None'], ['saltenv', 'base'], ['template_engine', 'jinja'], ['skip_verify', 'False'], ['context', 'None'], ['defaults', 'None'], ['test', 'False'], ['commit', 'True'], ['debug', 'False'], ['replace', 'False'], ['commit_in', 'None'], ['commit_at', 'None'], ['revert_in', 'None'], ['revert_at', 'None']],
  'netconfig.replace_pattern': [['pattern', 'pattern'], ['repl', 'repl'], ['count', '0'], ['flags', '8'], ['bufsize', '1'], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['not_found_content', 'None'], ['search_only', 'False'], ['show_changes', 'True'], ['backslash_literal', 'False'], ['source', 'running'], ['path', 'None'], ['test', 'False'], ['replace', 'True'], ['debug', 'False'], ['commit', 'True']],
  'netconfig.saved': [['source', 'running'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['attrs', 'None'], ['makedirs', 'False'], ['dir_mode', 'None'], ['replace', 'True'], ['backup', '\'\''], ['show_changes', 'True'], ['create', 'True'], ['tmp_dir', '\'\''], ['tmp_ext', '\'\''], ['encoding', 'None'], ['encoding_errors', 'strict'], ['allow_empty', 'False'], ['follow_symlinks', 'True'], ['check_cmd', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'netntp.managed': [['peers', 'None'], ['servers', 'None']],
  'netsnmp.managed': [['config', 'None'], ['defaults', 'None']],
  'netusers.managed': [['users', 'None'], ['defaults', 'None']],
  'network.managed': [['enabled', 'True']],
  'nftables.append': [['family', 'ipv4']],
  'nftables.chain_absent': [['table', 'filter'], ['family', 'ipv4']],
  'nftables.chain_present': [['table', 'filter'], ['table_type', 'None'], ['hook', 'None'], ['priority', 'None'], ['family', 'ipv4']],
  'nftables.delete': [['family', 'ipv4']],
  'nftables.flush': [['family', 'ipv4'], ['ignore_absence', 'False']],
  'nftables.insert': [['family', 'ipv4']],
  'nftables.set_policy': [['table', 'filter'], ['family', 'ipv4']],
  'nftables.table_absent': [['family', 'ipv4']],
  'nftables.table_present': [['family', 'ipv4']],
  'ntp.managed': [['servers', 'None']],
  'pip.installed': [['pkgs', 'None'], ['pip_bin', 'None'], ['requirements', 'None'], ['bin_env', 'None'], ['use_wheel', 'False'], ['no_use_wheel', 'False'], ['log', 'None'], ['proxy', 'None'], ['timeout', 'None'], ['repo', 'None'], ['editable', 'None'], ['find_links', 'None'], ['index_url', 'None'], ['extra_index_url', 'None'], ['no_index', 'False'], ['mirrors', 'None'], ['build', 'None'], ['target', 'None'], ['download', 'None'], ['download_cache', 'None'], ['source', 'None'], ['upgrade', 'False'], ['force_reinstall', 'False'], ['ignore_installed', 'False'], ['exists_action', 'None'], ['no_deps', 'False'], ['no_install', 'False'], ['no_download', 'False'], ['install_options', 'None'], ['global_options', 'None'], ['user', 'None'], ['cwd', 'None'], ['pre_releases', 'False'], ['cert', 'None'], ['allow_all_external', 'False'], ['allow_external', 'None'], ['allow_unverified', 'None'], ['process_dependency_links', 'False'], ['env_vars', 'None'], ['use_vt', 'False'], ['trusted_host', 'None'], ['no_cache_dir', 'False'], ['cache_dir', 'None'], ['no_binary', 'None'], ['extra_args', 'None']],
  'pip.removed': [['requirements', 'None'], ['bin_env', 'None'], ['log', 'None'], ['proxy', 'None'], ['timeout', 'None'], ['user', 'None'], ['cwd', 'None'], ['use_vt', 'False']],
  'pip.uptodate': [['bin_env', 'None'], ['user', 'None'], ['cwd', 'None'], ['use_vt', 'False']],
  'pkg.downloaded': [['version', 'None'], ['pkgs', 'None'], ['fromrepo', 'None'], ['ignore_epoch', 'None']],
  'pkg.group_installed': [['skip', 'None'], ['include', 'None']],
  'pkg.held': [['version', 'None'], ['pkgs', 'None'], ['replace', 'False']],
  'pkg.installed': [['version', 'None'], ['refresh', 'None'], ['fromrepo', 'None'], ['skip_verify', 'False'], ['skip_suggestions', 'False'], ['pkgs', 'None'], ['sources', 'None'], ['allow_updates', 'False'], ['pkg_verify', 'False'], ['normalize', 'True'], ['ignore_epoch', 'None'], ['reinstall', 'False'], ['update_holds', 'False']],
  'pkg.latest': [['refresh', 'None'], ['fromrepo', 'None'], ['skip_verify', 'False'], ['pkgs', 'None'], ['watch_flags', 'True']],
  'pkg.patch_downloaded': [['advisory_ids', 'None']],
  'pkg.patch_installed': [['advisory_ids', 'None'], ['downloadonly', 'None']],
  'pkg.purged': [['version', 'None'], ['pkgs', 'None'], ['normalize', 'True'], ['ignore_epoch', 'None']],
  'pkg.removed': [['version', 'None'], ['pkgs', 'None'], ['normalize', 'True'], ['ignore_epoch', 'None']],
  'pkg.unheld': [['version', 'None'], ['pkgs', 'None'], ['all', 'False']],
  'pkg.uptodate': [['refresh', 'False'], ['pkgs', 'None']],
  'pkgbuild.built': [['runas', 'runas'], ['dest_dir', 'dest_dir'], ['spec', 'spec'], ['sources', 'sources'], ['tgt', 'tgt'], ['template', 'None'], ['deps', 'None'], ['env', 'None'], ['results', 'None'], ['force', 'False'], ['saltenv', 'base'], ['log_dir', '/var/log/salt/pkgbuild']],
  'pkgbuild.repo': [['keyid', 'None'], ['env', 'None'], ['use_passphrase', 'False'], ['gnupghome', '/etc/salt/gpgkeys'], ['runas', 'builder'], ['timeout', '15.0']],
  'pkgrepo.managed': [['ppa', 'None'], ['copr', 'None'], ['aptkey', 'True']],
  'postgres_cluster.absent': [['version', 'version']],
  'postgres_cluster.present': [['version', 'version'], ['port', 'None'], ['encoding', 'None'], ['locale', 'None'], ['datadir', 'None'], ['allow_group_access', 'None'], ['data_checksums', 'None'], ['wal_segsize', 'None']],
  'postgres_database.absent': [['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_database.present': [['tablespace', 'None'], ['encoding', 'None'], ['lc_collate', 'None'], ['lc_ctype', 'None'], ['owner', 'None'], ['owner_recurse', 'False'], ['template', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_extension.absent': [['if_exists', 'None'], ['restrict', 'None'], ['cascade', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None']],
  'postgres_extension.present': [['if_not_exists', 'None'], ['schema', 'None'], ['ext_version', 'None'], ['from_version', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None']],
  'postgres_group.absent': [['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_group.present': [['createdb', 'None'], ['createroles', 'None'], ['encrypted', 'None'], ['superuser', 'None'], ['inherit', 'None'], ['login', 'None'], ['replication', 'None'], ['password', 'None'], ['refresh_password', 'None'], ['groups', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_initdb.present': [['user', 'None'], ['password', 'None'], ['auth', 'password'], ['encoding', 'UTF8'], ['locale', 'None'], ['runas', 'None'], ['waldir', 'None'], ['checksums', 'False']],
  'postgres_language.absent': [['maintenance_db', 'maintenance_db'], ['user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_language.present': [['maintenance_db', 'maintenance_db'], ['user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_privileges.absent': [['object_name', 'object_name'], ['object_type', 'object_type'], ['privileges', 'None'], ['prepend', 'public'], ['maintenance_db', 'None'], ['user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_privileges.present': [['object_name', 'object_name'], ['object_type', 'object_type'], ['privileges', 'None'], ['grant_option', 'None'], ['prepend', 'public'], ['maintenance_db', 'None'], ['user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_schema.absent': [['dbname', 'dbname'], ['user', 'None'], ['db_user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None']],
  'postgres_schema.present': [['dbname', 'dbname'], ['owner', 'None'], ['user', 'None'], ['db_user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None']],
  'postgres_tablespace.absent': [['user', 'None'], ['maintenance_db', 'None'], ['db_user', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None']],
  'postgres_tablespace.present': [['directory', 'directory'], ['options', 'None'], ['owner', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_user.absent': [['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'postgres_user.present': [['createdb', 'None'], ['createroles', 'None'], ['encrypted', 'None'], ['superuser', 'None'], ['replication', 'None'], ['inherit', 'None'], ['login', 'None'], ['password', 'None'], ['default_password', 'None'], ['refresh_password', 'None'], ['valid_until', 'None'], ['groups', 'None'], ['user', 'None'], ['maintenance_db', 'None'], ['db_password', 'None'], ['db_host', 'None'], ['db_port', 'None'], ['db_user', 'None']],
  'powercfg.set_timeout': [['value', 'value'], ['power', 'ac'], ['scheme', 'None']],
  'process.absent': [['user', 'None'], ['signal', 'None']],
  'proxy.managed': [['port', 'port'], ['services', 'None'], ['user', 'None'], ['password', 'None'], ['bypass_domains', 'None'], ['network_service', 'Ethernet']],
  'pyenv.absent': [['user', 'None']],
  'pyenv.install_pyenv': [['user', 'None']],
  'pyenv.installed': [['default', 'False'], ['user', 'None']],
  'quota.mode': [['mode', 'mode'], ['quotatype', 'quotatype']],
  'rabbitmq_cluster.joined': [['host', 'host'], ['user', 'rabbit'], ['ram_node', 'None'], ['runas', 'root']],
  'rabbitmq_plugin.disabled': [['runas', 'None']],
  'rabbitmq_plugin.enabled': [['runas', 'None']],
  'rabbitmq_policy.absent': [['vhost', '/'], ['runas', 'None']],
  'rabbitmq_policy.present': [['pattern', 'pattern'], ['definition', 'definition'], ['priority', '0'], ['vhost', '/'], ['runas', 'None'], ['apply_to', 'None']],
  'rabbitmq_upstream.absent': [['runas', 'None']],
  'rabbitmq_upstream.present': [['uri', 'uri'], ['prefetch_count', 'None'], ['reconnect_delay', 'None'], ['ack_mode', 'None'], ['trust_user_id', 'None'], ['exchange', 'None'], ['max_hops', 'None'], ['expires', 'None'], ['message_ttl', 'None'], ['ha_policy', 'None'], ['queue', 'None'], ['runas', 'None']],
  'rabbitmq_user.absent': [['runas', 'None']],
  'rabbitmq_user.present': [['password', 'None'], ['force', 'False'], ['tags', 'None'], ['perms', '()'], ['runas', 'None']],
  'raid.present': [['level', 'level'], ['devices', 'devices']],
  'reg.absent': [['vname', 'None'], ['use_32bit_registry', 'False']],
  'reg.key_absent': [['use_32bit_registry', 'False']],
  'reg.present': [['vname', 'None'], ['vdata', 'None'], ['vtype', 'REG_SZ'], ['use_32bit_registry', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'salt.function': [['tgt', 'tgt'], ['ssh', 'False'], ['tgt_type', 'glob'], ['ret', '\'\''], ['ret_config', 'None'], ['ret_kwargs', 'None'], ['expect_minions', 'False'], ['fail_minions', 'None'], ['fail_function', 'None'], ['arg', 'None'], ['kwarg', 'None'], ['timeout', 'None'], ['batch', 'None'], ['subset', 'None'], ['failhard', 'None']],
  'salt.parallel_runners': [['runners', 'runners']],
  'salt.state': [['tgt', 'tgt'], ['ssh', 'False'], ['tgt_type', 'glob'], ['ret', '\'\''], ['ret_config', 'None'], ['ret_kwargs', 'None'], ['highstate', 'None'], ['sls', 'None'], ['top', 'None'], ['saltenv', 'None'], ['test', 'None'], ['pillar', 'None'], ['pillarenv', 'None'], ['expect_minions', 'True'], ['exclude', 'None'], ['fail_minions', 'None'], ['allow_fail', '0'], ['concurrent', 'False'], ['timeout', 'None'], ['batch', 'None'], ['queue', 'False'], ['subset', 'None'], ['orchestration_jid', 'None'], ['failhard', 'None']],
  'salt.wait_for_event': [['id_list', 'id_list'], ['event_id', 'id'], ['timeout', '300'], ['node', 'master']],
  'salt_proxy.configure_proxy': [['proxyname', 'p8000'], ['start', 'True']],
  'selinux.boolean': [['value', 'None'], ['booleans', 'None'], ['persist', 'False']],
  'selinux.fcontext_policy_absent': [['filetype', 'a'], ['sel_type', 'None'], ['sel_user', 'None'], ['sel_level', 'None']],
  'selinux.fcontext_policy_applied': [['recursive', 'False']],
  'selinux.fcontext_policy_present': [['sel_type', 'sel_type'], ['filetype', 'a'], ['sel_user', 'None'], ['sel_level', 'None']],
  'selinux.module': [['module_state', 'Enabled'], ['version', 'any']],
  'selinux.port_policy_absent': [['sel_type', 'None'], ['protocol', 'None'], ['port', 'None']],
  'selinux.port_policy_present': [['sel_type', 'sel_type'], ['protocol', 'None'], ['port', 'None'], ['sel_range', 'None']],
  'service.dead': [['enable', 'None'], ['sig', 'None'], ['init_delay', 'None']],
  'service.masked': [['runtime', 'False']],
  'service.running': [['enable', 'None'], ['sig', 'None'], ['init_delay', 'None']],
  'service.unmasked': [['runtime', 'False']],
  'shortcut.present': [['arguments', '\'\''], ['description', '\'\''], ['hot_key', '\'\''], ['icon_location', '\'\''], ['icon_index', '0'], ['target', '\'\''], ['window_style', 'Normal'], ['working_dir', '\'\''], ['backup', 'False'], ['force', 'False'], ['make_dirs', 'False'], ['user', 'None']],
  'ssh_auth.absent': [['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_auth.manage': [['ssh_keys', 'ssh_keys'], ['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_auth.present': [['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_known_hosts.absent': [['user', 'None'], ['config', 'None']],
  'ssh_known_hosts.present': [['user', 'None'], ['fingerprint', 'None'], ['key', 'None'], ['port', 'None'], ['enc', 'None'], ['config', 'None'], ['hash_known_hosts', 'True'], ['timeout', '5'], ['fingerprint_hash_type', 'None']],
  'ssh_pki.certificate_managed': [['ttl_remaining', 'None'], ['ca_server', 'None'], ['backend', 'None'], ['backend_args', 'None'], ['signing_policy', 'None'], ['copypath', 'None'], ['cert_type', 'None'], ['signing_private_key', 'None'], ['signing_private_key_passphrase', 'None'], ['public_key', 'None'], ['private_key', 'None'], ['private_key_passphrase', 'None'], ['serial_number', 'None'], ['not_before', 'None'], ['not_after', 'None'], ['ttl', 'None'], ['critical_options', 'None'], ['extensions', 'None'], ['valid_principals', 'None'], ['all_principals', 'False'], ['key_id', 'None']],
  'ssh_pki.certificate_managed_ssh': [['result', 'result'], ['comment', 'comment'], ['changes', 'changes'], ['contents', 'None']],
  'ssh_pki.private_key_managed': [['algo', 'rsa'], ['keysize', 'None'], ['passphrase', 'None'], ['new', 'False'], ['overwrite', 'False']],
  'ssh_pki.private_key_managed_ssh': [['result', 'result'], ['comment', 'comment'], ['changes', 'changes'], ['tempfile', 'None']],
  'ssh_pki.public_key_managed': [['public_key_source', 'public_key_source'], ['passphrase', 'None']],
  'status.loadavg': [['maximum', 'None'], ['minimum', 'None']],
  'sysctl.present': [['value', 'value'], ['config', 'None']],
  'sysfs.present': [['value', 'value'], ['config', 'None']],
  'syslog_ng.config': [['config', 'config'], ['write', 'True']],
  'syslog_ng.started': [['user', 'None'], ['group', 'None'], ['chroot', 'None'], ['caps', 'None'], ['no_caps', 'False'], ['pidfile', 'None'], ['enable_core', 'False'], ['fd_limit', 'None'], ['verbose', 'False'], ['debug', 'False'], ['trace', 'False'], ['yydebug', 'False'], ['persist_file', 'None'], ['control', 'None'], ['worker_threads', 'None']],
  'system.join_domain': [['username', 'None'], ['password', 'None'], ['account_ou', 'None'], ['account_exists', 'False'], ['restart', 'False']],
  'system.reboot': [['message', 'None'], ['timeout', '5'], ['force_close', 'True'], ['in_seconds', 'False'], ['only_on_pending_reboot', 'True']],
  'system.shutdown': [['message', 'None'], ['timeout', '5'], ['force_close', 'True'], ['reboot', 'False'], ['in_seconds', 'False'], ['only_on_pending_reboot', 'False']],
  'task.absent': [['location', '\\\\']],
  'task.present': [['location', '\\\\'], ['user_name', 'System'], ['password', 'None'], ['force', 'False']],
  'test.check_pillar': [['present', 'None'], ['boolean', 'None'], ['integer', 'None'], ['string', 'None'], ['listing', 'None'], ['dictionary', 'None'], ['verbose', 'False']],
  'test.configurable_test_state': [['changes', 'True'], ['result', 'True'], ['comment', '\'\''], ['warnings', 'None'], ['allow_test_mode_failure', 'False']],
  'test.show_notification': [['text', 'None']],
  'timezone.system': [['utc', 'True']],
  'tls.valid_certificate': [['weeks', '0'], ['days', '0'], ['hours', '0'], ['minutes', '0'], ['seconds', '0']],
  'user.absent': [['purge', 'False'], ['force', 'False'], ['local', 'False']],
  'user.present': [['uid', 'None'], ['gid', 'None'], ['usergroup', 'None'], ['groups', 'None'], ['optional_groups', 'None'], ['remove_groups', 'True'], ['home', 'None'], ['createhome', 'True'], ['persist_home', 'False'], ['password', 'None'], ['hash_password', 'False'], ['enforce_password', 'True'], ['empty_password', 'False'], ['shell', 'None'], ['unique', 'True'], ['system', 'False'], ['fullname', 'None'], ['roomnumber', 'None'], ['workphone', 'None'], ['homephone', 'None'], ['other', 'None'], ['loginclass', 'None'], ['date', 'None'], ['mindays', 'None'], ['maxdays', 'None'], ['inactdays', 'None'], ['warndays', 'None'], ['expire', 'None'], ['win_homedrive', 'None'], ['win_profile', 'None'], ['win_logonscript', 'None'], ['win_description', 'None'], ['nologinit', 'False'], ['allow_uid_change', 'False'], ['allow_gid_change', 'False'], ['password_lock', 'None'], ['local', 'False']],
  'virtualenv.managed': [['venv_bin', 'None'], ['requirements', 'None'], ['system_site_packages', 'False'], ['distribute', 'False'], ['use_wheel', 'False'], ['clear', 'False'], ['python', 'None'], ['extra_search_dir', 'None'], ['never_download', 'None'], ['prompt', 'None'], ['user', 'None'], ['cwd', 'None'], ['index_url', 'None'], ['extra_index_url', 'None'], ['pre_releases', 'False'], ['no_deps', 'False'], ['pip_download', 'None'], ['pip_download_cache', 'None'], ['pip_exists_action', 'None'], ['pip_ignore_installed', 'False'], ['proxy', 'None'], ['use_vt', 'False'], ['env_vars', 'None'], ['no_use_wheel', 'False'], ['pip_upgrade', 'False'], ['pip_pkgs', 'None'], ['pip_no_cache_dir', 'False'], ['pip_cache_dir', 'None'], ['process_dependency_links', 'False'], ['no_binary', 'None']],
  'win_dacl.absent': [['objectType', 'objectType'], ['user', 'user'], ['permission', 'permission'], ['acetype', 'acetype'], ['propagation', 'propagation']],
  'win_dacl.disinherit': [['objectType', 'objectType'], ['copy_inherited_acl', 'True']],
  'win_dacl.inherit': [['objectType', 'objectType'], ['clear_existing_acl', 'False']],
  'win_dacl.present': [['objectType', 'objectType'], ['user', 'user'], ['permission', 'permission'], ['acetype', 'acetype'], ['propagation', 'propagation']],
  'win_dns_client.dns_dhcp': [['interface', 'Local Area Connection']],
  'win_dns_client.dns_exists': [['servers', 'None'], ['interface', 'Local Area Connection'], ['replace', 'False']],
  'win_dns_client.primary_suffix': [['suffix', 'None'], ['updates', 'False']],
  'win_firewall.add_rule': [['localport', 'localport'], ['protocol', 'tcp'], ['action', 'allow'], ['dir', 'in'], ['remoteip', 'any']],
  'win_iis.container_setting': [['container', 'container'], ['settings', 'None']],
  'win_iis.create_app': [['site', 'site'], ['sourcepath', 'sourcepath'], ['apppool', 'None']],
  'win_iis.create_binding': [['site', 'site'], ['hostheader', '\'\''], ['ipaddress', '*'], ['port', '80'], ['protocol', 'http'], ['sslflags', '0']],
  'win_iis.create_cert_binding': [['site', 'site'], ['hostheader', '\'\''], ['ipaddress', '*'], ['port', '443'], ['sslflags', '0']],
  'win_iis.create_vdir': [['site', 'site'], ['sourcepath', 'sourcepath'], ['app', '/']],
  'win_iis.deployed': [['sourcepath', 'sourcepath'], ['apppool', '\'\''], ['hostheader', '\'\''], ['ipaddress', '*'], ['port', '80'], ['protocol', 'http']],
  'win_iis.remove_app': [['site', 'site']],
  'win_iis.remove_binding': [['site', 'site'], ['hostheader', '\'\''], ['ipaddress', '*'], ['port', '80']],
  'win_iis.remove_cert_binding': [['site', 'site'], ['hostheader', '\'\''], ['ipaddress', '*'], ['port', '443']],
  'win_iis.remove_vdir': [['site', 'site'], ['app', '/']],
  'win_iis.set_app': [['site', 'site'], ['settings', 'None']],
  'win_iis.webconfiguration_settings': [['settings', 'None']],
  'win_path.exists': [['index', 'None']],
  'win_pki.import_cert': [['cert_format', '_DEFAULT_FORMAT'], ['context', '_DEFAULT_CONTEXT'], ['store', '_DEFAULT_STORE'], ['exportable', 'True'], ['password', '\'\''], ['saltenv', 'base']],
  'win_pki.remove_cert': [['thumbprint', 'thumbprint'], ['context', '_DEFAULT_CONTEXT'], ['store', '_DEFAULT_STORE']],
  'win_servermanager.installed': [['features', 'None'], ['recurse', 'False'], ['restart', 'False'], ['source', 'None'], ['exclude', 'None']],
  'win_servermanager.removed': [['features', 'None'], ['remove_payload', 'False'], ['restart', 'False']],
  'win_smtp_server.active_log_format': [['log_format', 'log_format'], ['server', '_DEFAULT_SERVER']],
  'win_smtp_server.connection_ip_list': [['addresses', 'None'], ['grant_by_default', 'False'], ['server', '_DEFAULT_SERVER']],
  'win_smtp_server.relay_ip_list': [['addresses', 'None'], ['server', '_DEFAULT_SERVER']],
  'win_smtp_server.server_setting': [['settings', 'None'], ['server', '_DEFAULT_SERVER']],
  'win_snmp.agent_settings': [['contact', 'contact'], ['location', 'location'], ['services', 'None']],
  'win_snmp.auth_traps_enabled': [['status', 'True']],
  'win_snmp.community_names': [['communities', 'None']],
  'winrepo.genrepo': [['force', 'False'], ['allow_empty', 'False']],
  'wua.installed': [['updates', 'None']],
  'wua.removed': [['updates', 'None']],
  'wua.uptodate': [['software', 'True'], ['drivers', 'False'], ['skip_hidden', 'False'], ['skip_mandatory', 'False'], ['skip_reboot', 'True'], ['categories', 'None'], ['severities', 'None']],
  'wusa.installed': [['source', 'source']],
  'x509.certificate_managed': [['days_remaining', '90'], ['append_certs', 'None']],
  'x509.crl_managed': [['signing_private_key', 'signing_private_key'], ['signing_private_key_passphrase', 'None'], ['signing_cert', 'None'], ['revoked', 'None'], ['days_valid', '100'], ['digest', '\'\''], ['days_remaining', '30'], ['include_expired', 'False']],
  'x509.pem_managed': [['text', 'text'], ['backup', 'False']],
  'x509.private_key_managed': [['bits', '2048'], ['passphrase', 'None'], ['cipher', 'aes_128_cbc'], ['new', 'False'], ['overwrite', 'False'], ['verbose', 'True']],
  'x509_v2.certificate_managed': [['days_remaining', 'None'], ['ca_server', 'None'], ['signing_policy', 'None'], ['encoding', 'pem'], ['append_certs', 'None'], ['digest', 'sha256'], ['signing_private_key', 'None'], ['signing_private_key_passphrase', 'None'], ['signing_cert', 'None'], ['public_key', 'None'], ['private_key', 'None'], ['private_key_passphrase', 'None'], ['csr', 'None'], ['subject', 'None'], ['serial_number', 'None'], ['not_before', 'None'], ['not_after', 'None'], ['days_valid', 'None'], ['pkcs12_passphrase', 'None'], ['pkcs12_encryption_compat', 'False'], ['pkcs12_friendlyname', 'None']],
  'x509_v2.certificate_managed_ssh': [['result', 'result'], ['comment', 'comment'], ['changes', 'changes'], ['encoding', 'None'], ['contents', 'None']],
  'x509_v2.crl_managed': [['signing_private_key', 'signing_private_key'], ['revoked', 'revoked'], ['days_remaining', 'None'], ['signing_cert', 'None'], ['signing_private_key_passphrase', 'None'], ['include_expired', 'False'], ['days_valid', 'None'], ['digest', 'sha256'], ['encoding', 'pem'], ['extensions', 'None']],
  'x509_v2.csr_managed': [['private_key', 'private_key'], ['private_key_passphrase', 'None'], ['digest', 'sha256'], ['encoding', 'pem'], ['subject', 'None']],
  'x509_v2.pem_managed': [['text', 'text']],
  'x509_v2.private_key_managed': [['algo', 'rsa'], ['keysize', 'None'], ['passphrase', 'None'], ['encoding', 'pem'], ['new', 'False'], ['overwrite', 'False'], ['pkcs12_encryption_compat', 'False']],
  'x509_v2.private_key_managed_ssh': [['result', 'result'], ['comment', 'comment'], ['changes', 'changes'], ['tempfile', 'None']],
  'xattr.delete': [['attributes', 'attributes']],
  'xattr.exists': [['attributes', 'attributes']]
};


// Builds `<indent>- key: ${n:placeholder}` lines, returning the joined text
// and the next unused tabstop number. Ends with a bare `$0` (final cursor
// position) right after the last value rather than an extra blank `- ` line
// -- basic now always includes every mandatory argument (see
// MANDATORY_FIELDS above), so that invite-more-args line wasn't earning its
// keep; add another `- key: value` line by hand same as any other YAML edit.
function buildArgsBody(fields, indent, startTabstop) {
  let n = startTabstop;
  const lines = fields.map(([key, placeholder]) => {
    const line = `${indent}- ${key}: \${${n}:${placeholder}}`;
    n += 1;
    return line;
  });
  return { text: lines.join('\n') + '$0', nextTabstop: n };
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

// Reads live (not cached) so a mid-session settings change takes effect on
// the very next completion, no reload needed.
function stateIdPrefix() {
  const prepend = vscode.workspace.getConfiguration('saltSyntax').get('prependSlsToStateId', true);
  return prepend ? '{{ sls }}.' : '';
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
    async (mod, fn, variant) => {
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
      const fields = getFields(mod, fn, variant);
      const args = buildArgsBody(fields, '    ', 2);
      const snippet = new vscode.SnippetString(
        `${stateIdPrefix()}\${1:state_id}:\n  ${mod}.${fn}:\n${args.text}`
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

          return MODULE_FUNCTIONS[mod].flatMap((fn) =>
            availableVariants(mod, fn).map((variant) => {
              const isFull = variant === 'full';
              const fields = getFields(mod, fn, variant);
              const label = isFull ? `${fn} (full)` : fn;
              const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Function);
              // Both variants of the same function should show up for the same
              // typed text, and "basic" should sort right above "full".
              item.filterText = fn;
              item.sortText = `${isFull ? '1' : '0'}_${fn}`;
              item.detail = isFull ? `${mod}.${fn} — all arguments` : `${mod}.${fn}`;

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
                  arguments: [mod, fn, variant]
                };
                const args = buildArgsBody(fields, '    ', 2);
                item.documentation = new vscode.MarkdownString(
                  `Inserts a full state block:\n\n\`\`\`sls\n${stateIdPrefix()}<state_id>:\n  ${mod}.${fn}:\n${args.text.replace(/\$\{\d+:?([^}]*)\}/g, '$1').replace(/\$0/g, '')}\n\`\`\``
                );
              } else {
                // Already indented under an existing state id: just the function stub.
                const args = buildArgsBody(fields, '  ', 1);
                item.insertText = new vscode.SnippetString(`${fn}:\n${args.text}`);
              }
              return item;
            })
          );
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
