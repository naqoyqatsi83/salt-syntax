const vscode = require('vscode');

// This extension supports two Salt release lines, selected at runtime by
// saltSyntax.saltVersion (see activeDataset() below): 3008.x (the default)
// and 3006.x (Salt's long-term-support line, which still carries hundreds of
// state modules -- mostly third-party cloud/provider integrations like
// boto_*, libcloud_*, zabbix_*, pagerduty_* -- that 3007.0 onward split out
// into separate salt-extensions packages and dropped from core Salt). Each
// dataset below (MODULE_FUNCTIONS_*, FULL_FUNCTION_FIELDS_*,
// MANDATORY_FIELDS_*) is extracted the same way from the real salt/states/*.py
// source at a real tagged release -- see AGENTS.md's "Updating the Salt
// module/function list" section for the full methodology and how to
// regenerate either one against a newer tag.

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
const MODULE_FUNCTIONS_3008 = {
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

// Salt 3006.x's state module/function set -- extracted the same way, from
// salt/states/*.py at tag v3006.27 (the latest 3006.x release as of
// writing). Same name-first-parameter rule as MODULE_FUNCTIONS_3008, with
// two additions specific to this extraction (both hand-verified, see
// AGENTS.md):
//   1. A function whose first parameter isn't literally `name` still
//      counts if `name` appears anywhere else in its signature (Salt still
//      binds the state ID to it) -- e.g. bigip.create_node's real
//      signature is (hostname, username, password, name, address, ...).
//   2. A short, explicit list of real public states that accept `name`
//      only via a trailing `**kwargs` catch-all rather than declaring it
//      (module.run, the boto_elasticache/boto_route53/pagerduty_*/
//      zabbix_*/splunk/glassfish/libcloud_loadbalancer state functions,
//      and stateconf.set/context, which are themselves a module-level
//      `set = context = _no_op` alias rather than `def` statements) --
//      confirmed by hand against the real v3006.27 source, the same way
//      module.run and postgres_cluster/schema.absent were confirmed for
//      3008. A handful of other non-standard-first-param functions found
//      during extraction (dellchassis.firmware_update, drac.network,
//      esxvm.vm_registered, libcloud_dns.zone_present/absent,
//      boto_iam.keys_absent, plus assorted private helpers) take neither
//      `name` nor `**kwargs` and were deliberately left out as unlikely to
//      be callable as real SLS states at all.
// win_network's functions are merged into `network` and nxos_upgrade's
// into `nxos` (genuine same-name platform/proxy-extension alternates --
// real SLS is written as `network.managed:` / `nxos.image_running:`
// either way); `x509_v2` is kept distinct from `x509` despite its own
// __virtualname__ override claiming "x509", matching how the 3008
// dataset already treats them as separately-addressed completion targets.
// testinfra.py is excluded entirely: its public functions are generated
// at import time by mirroring the testinfra execution module, not by
// static `def`s this kind of extraction can see (also excluded from
// 3008 for the same reason).
const MODULE_FUNCTIONS_3006 = {
  acl: ['absent', 'list_absent', 'list_present', 'present'],
  acme: ['cert'],
  alias: ['absent', 'present'],
  alternatives: ['auto', 'install', 'remove', 'set'],
  ansible: ['playbooks'],
  apache: ['configfile'],
  apache_conf: ['disabled', 'enabled'],
  apache_module: ['disabled', 'enabled'],
  apache_site: ['disabled', 'enabled'],
  apt: ['held'],
  archive: ['extracted'],
  artifactory: ['downloaded'],
  assistive: ['installed'],
  at: ['absent', 'present', 'watch'],
  augeas: ['change'],
  aws_sqs: ['absent', 'exists'],
  azurearm_compute: ['availability_set_absent', 'availability_set_present'],
  azurearm_dns: ['record_set_absent', 'record_set_present', 'zone_absent', 'zone_present'],
  azurearm_network: ['load_balancer_absent', 'load_balancer_present', 'network_interface_absent', 'network_interface_present', 'network_security_group_absent', 'network_security_group_present', 'public_ip_address_absent', 'public_ip_address_present', 'route_absent', 'route_present', 'route_table_absent', 'route_table_present', 'security_rule_absent', 'security_rule_present', 'subnet_absent', 'subnet_present', 'virtual_network_absent', 'virtual_network_present'],
  azurearm_resource: ['policy_assignment_absent', 'policy_assignment_present', 'policy_definition_absent', 'policy_definition_present', 'resource_group_absent', 'resource_group_present'],
  beacon: ['absent', 'disabled', 'enabled', 'present'],
  bigip: ['add_pool_member', 'create_monitor', 'create_node', 'create_pool', 'create_profile', 'create_virtual', 'delete_monitor', 'delete_node', 'delete_pool', 'delete_pool_member', 'delete_profile', 'delete_virtual', 'list_monitor', 'list_node', 'list_pool', 'list_profile', 'list_virtual', 'manage_monitor', 'manage_node', 'manage_pool', 'manage_pool_members', 'manage_profile', 'manage_virtual', 'modify_monitor', 'modify_node', 'modify_pool', 'modify_pool_member', 'modify_profile', 'modify_virtual'],
  blockdev: ['formatted', 'tuned'],
  boto3_elasticache: ['cache_cluster_absent', 'cache_cluster_present', 'cache_subnet_group_absent', 'cache_subnet_group_present', 'replication_group_absent', 'replication_group_present'],
  boto3_elasticsearch: ['absent', 'latest', 'present', 'tagged', 'upgraded'],
  boto3_route53: ['hosted_zone_absent', 'hosted_zone_present', 'rr_absent', 'rr_present'],
  boto3_sns: ['topic_absent', 'topic_present'],
  boto_apigateway: ['absent', 'present', 'usage_plan_absent', 'usage_plan_association_absent', 'usage_plan_association_present', 'usage_plan_present'],
  boto_asg: ['absent', 'present'],
  boto_cfn: ['absent', 'present'],
  boto_cloudfront: ['present'],
  boto_cloudtrail: ['absent', 'present'],
  boto_cloudwatch_alarm: ['absent', 'present'],
  boto_cloudwatch_event: ['absent', 'present'],
  boto_cognitoidentity: ['pool_absent', 'pool_present'],
  boto_datapipeline: ['absent', 'present'],
  boto_dynamodb: ['absent', 'present'],
  boto_ec2: ['eni_absent', 'eni_present', 'instance_absent', 'instance_present', 'key_absent', 'key_present', 'private_ips_absent', 'private_ips_present', 'snapshot_created', 'volume_absent', 'volume_present', 'volumes_tagged'],
  boto_elasticache: ['absent', 'cache_cluster_absent', 'cache_cluster_present', 'creategroup', 'present', 'replication_group_absent', 'replication_group_present', 'subnet_group_absent', 'subnet_group_present'],
  boto_elasticsearch_domain: ['absent', 'present'],
  boto_elb: ['absent', 'present', 'register_instances'],
  boto_elbv2: ['create_target_group', 'delete_target_group', 'targets_deregistered', 'targets_registered'],
  boto_iam: ['account_policy', 'group_absent', 'group_present', 'keys_present', 'policy_absent', 'policy_present', 'saml_provider_absent', 'saml_provider_present', 'server_cert_absent', 'server_cert_present', 'user_absent', 'user_present'],
  boto_iam_role: ['absent', 'present'],
  boto_iot: ['policy_absent', 'policy_attached', 'policy_detached', 'policy_present', 'thing_type_absent', 'thing_type_present', 'topic_rule_absent', 'topic_rule_present'],
  boto_kinesis: ['absent', 'present'],
  boto_kms: ['key_present'],
  boto_lambda: ['alias_absent', 'alias_present', 'event_source_mapping_absent', 'event_source_mapping_present', 'function_absent', 'function_present'],
  boto_lc: ['absent', 'present'],
  boto_rds: ['absent', 'parameter_present', 'present', 'replica_present', 'subnet_group_absent', 'subnet_group_present'],
  boto_route53: ['absent', 'hosted_zone_absent', 'hosted_zone_present', 'present', 'rr_absent', 'rr_present'],
  boto_s3: ['object_present'],
  boto_s3_bucket: ['absent', 'present'],
  boto_secgroup: ['absent', 'present'],
  boto_sns: ['absent', 'present'],
  boto_sqs: ['absent', 'present'],
  boto_vpc: ['absent', 'accept_vpc_peering_connection', 'delete_vpc_peering_connection', 'dhcp_options_absent', 'dhcp_options_present', 'internet_gateway_absent', 'internet_gateway_present', 'nat_gateway_absent', 'nat_gateway_present', 'present', 'request_vpc_peering_connection', 'route_table_absent', 'route_table_present', 'subnet_absent', 'subnet_present', 'vpc_peering_connection_absent', 'vpc_peering_connection_present'],
  bower: ['bootstrap', 'installed', 'pruned', 'removed'],
  btrfs: ['properties', 'subvolume_created', 'subvolume_deleted'],
  buildout: ['installed'],
  cabal: ['installed', 'removed'],
  ceph: ['quorum'],
  certutil: ['add_store', 'del_store'],
  chef: ['client', 'solo'],
  chocolatey: ['installed', 'source_present', 'uninstalled', 'upgraded'],
  chronos_job: ['absent', 'config'],
  cimc: ['hostname', 'logging_levels', 'ntp', 'power_configuration', 'syslog', 'user'],
  cisconso: ['value_present'],
  cloud: ['absent', 'present', 'profile', 'volume_absent', 'volume_attached', 'volume_detached', 'volume_present'],
  cmd: ['call', 'run', 'script', 'wait', 'wait_call', 'wait_script'],
  composer: ['installed', 'update'],
  consul: ['acl_absent', 'acl_present'],
  cron: ['absent', 'env_absent', 'env_present', 'file', 'present'],
  cryptdev: ['mapped', 'unmapped'],
  csf: ['nics_skip', 'nics_skipped', 'option_present', 'ports_open', 'rule_absent', 'rule_present', 'testing_off', 'testing_on'],
  cyg: ['installed', 'removed', 'updated'],
  ddns: ['absent', 'present'],
  debconf: ['set', 'set_file'],
  dellchassis: ['blade_idrac', 'chassis', 'switch'],
  disk: ['status'],
  dism: ['capability_installed', 'capability_removed', 'feature_installed', 'feature_removed', 'kb_removed', 'package_installed', 'package_removed'],
  docker_container: ['absent', 'run', 'running', 'stopped'],
  docker_image: ['absent', 'present'],
  docker_network: ['absent', 'present'],
  docker_volume: ['absent', 'present'],
  drac: ['absent', 'present'],
  dvs: ['dvs_configured', 'portgroups_configured', 'uplink_portgroup_configured'],
  elasticsearch: ['alias_absent', 'alias_present', 'index_absent', 'index_present', 'index_template_absent', 'index_template_present', 'pipeline_absent', 'pipeline_present', 'search_template_absent', 'search_template_present'],
  elasticsearch_index: ['absent', 'present'],
  elasticsearch_index_template: ['absent', 'present'],
  environ: ['setenv'],
  eselect: ['set'],
  esxcluster: ['cluster_configured', 'licenses_configured', 'vsan_datastore_configured'],
  esxdatacenter: ['datacenter_configured'],
  esxi: ['coredump_configured', 'diskgroups_configured', 'host_cache_configured', 'ntp_configured', 'password_present', 'ssh_configured', 'syslog_configured', 'vmotion_configured', 'vsan_configured'],
  esxvm: ['vm_cloned', 'vm_configured', 'vm_created', 'vm_updated'],
  etcd: ['directory', 'rm', 'set', 'wait_rm', 'wait_set'],
  ethtool: ['coalesce', 'offload', 'pause', 'ring'],
  event: ['send', 'wait'],
  file: ['absent', 'accumulated', 'append', 'blockreplace', 'cached', 'comment', 'copy', 'decode', 'directory', 'exists', 'hardlink', 'keyvalue', 'line', 'managed', 'missing', 'mknod', 'not_cached', 'patch', 'prepend', 'pruned', 'recurse', 'rename', 'replace', 'retention_schedule', 'serialize', 'shortcut', 'symlink', 'tidied', 'touch', 'uncomment'],
  firewall: ['check'],
  firewalld: ['present', 'service'],
  gem: ['installed', 'removed', 'sources_add', 'sources_remove'],
  git: ['cloned', 'config_set', 'config_unset', 'detached', 'latest', 'present'],
  github: ['absent', 'present', 'repo_absent', 'repo_present', 'team_absent', 'team_present'],
  glance_image: ['absent', 'present'],
  glassfish: ['connection_factory_absent', 'connection_factory_present', 'destination_absent', 'destination_present', 'jdbc_datasource_absent', 'jdbc_datasource_present', 'system_properties_absent', 'system_properties_present'],
  glusterfs: ['add_volume_bricks', 'max_op_version', 'op_version', 'peered', 'started', 'volume_present'],
  gnomedesktop: ['desktop_interface', 'desktop_lockdown', 'wm_preferences'],
  gpg: ['absent', 'present'],
  grafana: ['dashboard_absent', 'dashboard_present'],
  grafana4_dashboard: ['absent', 'present'],
  grafana4_datasource: ['absent', 'present'],
  grafana4_org: ['absent', 'present'],
  grafana4_user: ['absent', 'present'],
  grafana_dashboard: ['absent', 'present'],
  grafana_datasource: ['absent', 'present'],
  grains: ['absent', 'append', 'exists', 'list_absent', 'list_present', 'present'],
  group: ['absent', 'present'],
  heat: ['absent', 'deployed'],
  helm: ['release_absent', 'release_present', 'repo_managed', 'repo_updated'],
  hg: ['latest'],
  highstate_doc: ['note'],
  host: ['absent', 'only', 'present'],
  http: ['query', 'wait_for_successful_query'],
  icinga2: ['generate_cert', 'generate_ticket', 'node_setup', 'request_cert', 'save_cert'],
  idem: ['state'],
  ifttt: ['trigger_event'],
  incron: ['absent', 'present'],
  influxdb08_database: ['absent', 'present'],
  influxdb08_user: ['absent', 'present'],
  influxdb_continuous_query: ['absent', 'present'],
  influxdb_database: ['absent', 'present'],
  influxdb_retention_policy: ['absent', 'present'],
  influxdb_user: ['absent', 'present'],
  infoblox_a: ['absent', 'present'],
  infoblox_cname: ['absent', 'present'],
  infoblox_host_record: ['absent', 'present'],
  infoblox_range: ['absent', 'present'],
  ini: ['options_absent', 'options_present', 'sections_absent', 'sections_present'],
  ipmi: ['boot_device', 'power', 'user_absent', 'user_present'],
  ipset: ['absent', 'flush', 'present', 'set_absent', 'set_present'],
  iptables: ['append', 'chain_absent', 'chain_present', 'delete', 'flush', 'insert', 'set_policy'],
  jboss7: ['bindings_exist', 'datasource_exists', 'deployed', 'reloaded'],
  jenkins: ['absent', 'present'],
  junos: ['cli', 'commit', 'commit_check', 'diff', 'file_copy', 'get_table', 'install_config', 'install_os', 'load', 'lock', 'rollback', 'rpc', 'set_hostname', 'shutdown', 'unlock', 'zeroize'],
  kapacitor: ['task_absent', 'task_present'],
  kernelpkg: ['latest_active', 'latest_installed', 'latest_wait'],
  keyboard: ['system', 'xorg'],
  keychain: ['default_keychain', 'installed', 'uninstalled'],
  keystone: ['endpoint_absent', 'endpoint_present', 'project_absent', 'project_present', 'role_absent', 'role_present', 'service_absent', 'service_present', 'tenant_absent', 'tenant_present', 'user_absent', 'user_present'],
  keystone_domain: ['absent', 'present'],
  keystone_endpoint: ['absent', 'present'],
  keystone_group: ['absent', 'present'],
  keystone_project: ['absent', 'present'],
  keystone_role: ['absent', 'present'],
  keystone_role_grant: ['absent', 'present'],
  keystone_service: ['absent', 'present'],
  keystone_user: ['absent', 'present'],
  keystore: ['managed'],
  kmod: ['absent', 'present'],
  kubernetes: ['configmap_absent', 'configmap_present', 'deployment_absent', 'deployment_present', 'namespace_absent', 'namespace_present', 'node_label_absent', 'node_label_folder_absent', 'node_label_present', 'pod_absent', 'pod_present', 'secret_absent', 'secret_present', 'service_absent', 'service_present'],
  layman: ['absent', 'present'],
  ldap: ['managed'],
  lgpo: ['set'],
  lgpo_reg: ['refresh_policy', 'value_absent', 'value_disabled', 'value_present'],
  libcloud_dns: ['record_absent', 'record_present', 'state_result'],
  libcloud_loadbalancer: ['balancer_absent', 'balancer_present', 'member_absent', 'member_present', 'state_result'],
  libcloud_storage: ['container_absent', 'container_present', 'file_present', 'object_absent', 'object_present', 'state_result'],
  license: ['activate'],
  locale: ['present', 'system'],
  logadm: ['remove', 'rotate'],
  logrotate: ['set'],
  loop: ['until', 'until_no_eval'],
  lvm: ['lv_absent', 'lv_present', 'pv_absent', 'pv_present', 'vg_absent', 'vg_present'],
  lvs_server: ['absent', 'present'],
  lvs_service: ['absent', 'present'],
  lxc: ['absent', 'edited_conf', 'frozen', 'present', 'running', 'set_pass', 'stopped'],
  lxd: ['authenticate', 'config_managed', 'init'],
  lxd_container: ['absent', 'frozen', 'migrated', 'present', 'running', 'stopped'],
  lxd_image: ['absent', 'present'],
  lxd_profile: ['absent', 'present'],
  macdefaults: ['absent', 'write'],
  macpackage: ['installed'],
  makeconf: ['absent', 'present'],
  marathon_app: ['absent', 'config', 'running'],
  memcached: ['absent', 'managed'],
  modjk: ['worker_activated', 'worker_disabled', 'worker_recover', 'worker_stopped'],
  modjk_worker: ['activate', 'disable', 'stop'],
  module: ['run', 'wait'],
  mongodb_database: ['absent'],
  mongodb_user: ['absent', 'present'],
  monit: ['monitor', 'unmonitor'],
  mount: ['fstab_absent', 'fstab_present', 'mounted', 'swap', 'unmounted'],
  mssql_database: ['absent', 'present'],
  mssql_login: ['absent', 'present'],
  mssql_role: ['absent', 'present'],
  mssql_user: ['absent', 'present'],
  msteams: ['post_card'],
  mysql_database: ['absent', 'present'],
  mysql_grants: ['absent', 'present'],
  mysql_query: ['run', 'run_file'],
  mysql_user: ['absent', 'present'],
  napalm_yang: ['configured', 'managed'],
  netacl: ['filter', 'managed', 'term'],
  netconfig: ['commit_cancelled', 'commit_confirmed', 'managed', 'replace_pattern', 'saved'],
  netntp: ['managed'],
  netsnmp: ['managed'],
  netusers: ['managed'],
  network: ['managed', 'routes', 'system'],
  neutron_network: ['absent', 'present'],
  neutron_secgroup: ['absent', 'present'],
  neutron_secgroup_rule: ['absent', 'present'],
  neutron_subnet: ['absent', 'present'],
  nexus: ['downloaded'],
  nfs_export: ['absent', 'present'],
  nftables: ['append', 'chain_absent', 'chain_present', 'delete', 'flush', 'insert', 'set_policy', 'table_absent', 'table_present'],
  npm: ['bootstrap', 'cache_cleaned', 'installed', 'removed'],
  ntp: ['managed'],
  nxos: ['config_absent', 'config_present', 'image_running', 'replace', 'user_absent', 'user_present'],
  openstack_config: ['absent', 'present'],
  openvswitch_bridge: ['absent', 'present'],
  openvswitch_db: ['managed'],
  openvswitch_port: ['absent', 'present'],
  opsgenie: ['close_alert', 'create_alert'],
  pagerduty: ['create_event'],
  pagerduty_escalation_policy: ['absent', 'present'],
  pagerduty_schedule: ['absent', 'present'],
  pagerduty_service: ['absent', 'present'],
  pagerduty_user: ['absent', 'present'],
  panos: ['add_config_lock', 'address_exists', 'address_group_exists', 'clone_config', 'commit_config', 'delete_config', 'download_software', 'edit_config', 'move_config', 'remove_config_lock', 'rename_config', 'security_rule_exists', 'service_exists', 'service_group_exists', 'set_config'],
  pbm: ['default_storage_policy_assigned', 'default_vsan_policy_configured', 'storage_policies_configured'],
  pcs: ['auth', 'cib_present', 'cib_pushed', 'cluster_node_present', 'cluster_setup', 'constraint_present', 'prop_has_value', 'resource_defaults_to', 'resource_op_defaults_to', 'resource_present', 'stonith_present'],
  pdbedit: ['absent', 'managed', 'present'],
  pecl: ['installed', 'removed'],
  pip: ['installed', 'removed', 'uptodate'],
  pkg: ['downloaded', 'group_installed', 'held', 'installed', 'latest', 'patch_downloaded', 'patch_installed', 'purged', 'removed', 'unheld', 'uptodate'],
  pkgbuild: ['built', 'repo'],
  pkgng: ['update_packaging_site'],
  pkgrepo: ['absent', 'managed'],
  portage_config: ['flags'],
  ports: ['installed'],
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
  powerpath: ['license_absent', 'license_present'],
  probes: ['managed'],
  process: ['absent'],
  proxy: ['managed'],
  pushover: ['post_message'],
  pyenv: ['absent', 'install_pyenv', 'installed'],
  pyrax_queues: ['absent', 'present'],
  quota: ['mode'],
  rabbitmq_cluster: ['joined'],
  rabbitmq_plugin: ['disabled', 'enabled'],
  rabbitmq_policy: ['absent', 'present'],
  rabbitmq_upstream: ['absent', 'present'],
  rabbitmq_user: ['absent', 'present'],
  rabbitmq_vhost: ['absent', 'present'],
  raid: ['absent', 'present'],
  rbac: ['managed'],
  rbenv: ['absent', 'install_rbenv', 'installed'],
  rdp: ['disabled', 'enabled'],
  redis: ['absent', 'slaveof', 'string'],
  reg: ['absent', 'key_absent', 'present'],
  restconf: ['config_manage'],
  rsync: ['synchronized'],
  rvm: ['gemset_present', 'installed'],
  salt: ['function', 'parallel_runners', 'runner', 'state', 'wait_for_event', 'wheel'],
  salt_proxy: ['configure_proxy'],
  saltutil: ['sync_all', 'sync_beacons', 'sync_clouds', 'sync_engines', 'sync_executors', 'sync_grains', 'sync_log_handlers', 'sync_matchers', 'sync_modules', 'sync_output', 'sync_outputters', 'sync_pillar', 'sync_proxymodules', 'sync_renderers', 'sync_returners', 'sync_sdb', 'sync_serializers', 'sync_states', 'sync_thorium', 'sync_utils'],
  schedule: ['absent', 'disabled', 'enabled', 'present'],
  selinux: ['boolean', 'fcontext_policy_absent', 'fcontext_policy_applied', 'fcontext_policy_present', 'mode', 'module', 'module_install', 'module_remove', 'port_policy_absent', 'port_policy_present'],
  serverdensity_device: ['monitored'],
  service: ['dead', 'disabled', 'enabled', 'masked', 'running', 'unmasked'],
  shortcut: ['present'],
  slack: ['post_message'],
  smartos: ['config_absent', 'config_present', 'image_absent', 'image_present', 'image_vacuum', 'source_absent', 'source_present', 'vm_absent', 'vm_present', 'vm_running', 'vm_stopped'],
  smtp: ['send_msg'],
  snapper: ['baseline_snapshot'],
  solrcloud: ['alias', 'collection'],
  splunk: ['absent', 'present'],
  splunk_search: ['absent', 'present'],
  sqlite3: ['row_absent', 'row_present', 'table_absent', 'table_present'],
  ssh_auth: ['absent', 'manage', 'present'],
  ssh_known_hosts: ['absent', 'present'],
  stateconf: ['context', 'set'],
  status: ['loadavg', 'process'],
  statuspage: ['create', 'delete', 'managed', 'update'],
  supervisord: ['dead', 'running'],
  svn: ['dirty', 'export', 'latest'],
  sysctl: ['present'],
  sysfs: ['present'],
  syslog_ng: ['config', 'reloaded', 'started', 'stopped'],
  sysrc: ['absent', 'managed'],
  system: ['computer_desc', 'computer_name', 'hostname', 'join_domain', 'reboot', 'shutdown', 'workgroup'],
  telemetry_alert: ['absent', 'present'],
  test: ['check_pillar', 'configurable_test_state', 'fail_with_changes', 'fail_without_changes', 'nop', 'show_notification', 'succeed_with_changes', 'succeed_without_changes'],
  timezone: ['system'],
  tls: ['valid_certificate'],
  tomcat: ['undeployed', 'wait', 'war_deployed'],
  trafficserver: ['bounce_cluster', 'bounce_local', 'clear_cluster', 'clear_node', 'config', 'offline', 'refresh', 'restart_cluster', 'restart_local', 'shutdown', 'startup', 'zero_cluster', 'zero_node'],
  tuned: ['off', 'profile'],
  uptime: ['monitored'],
  user: ['absent', 'present'],
  vagrant: ['destroyed', 'initialized', 'paused', 'powered_off', 'rebooted', 'running', 'stopped'],
  vault: ['policy_present'],
  vbox_guest: ['additions_installed', 'additions_removed', 'grant_access_to_shared_folders_to'],
  victorops: ['create_event'],
  virt: ['defined', 'keys', 'network_defined', 'network_running', 'pool_defined', 'pool_deleted', 'pool_running', 'powered_off', 'rebooted', 'reverted', 'running', 'saved', 'snapshot', 'stopped', 'unpowered', 'volume_defined'],
  virtualenv: ['managed'],
  webutil: ['user_absent', 'user_exists'],
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
  wordpress: ['activated', 'deactivated', 'installed'],
  wua: ['installed', 'removed', 'uptodate'],
  wusa: ['installed', 'uninstalled'],
  x509: ['certificate_managed', 'crl_managed', 'csr_managed', 'pem_managed', 'private_key_managed'],
  x509_v2: ['certificate_managed', 'crl_managed', 'csr_managed', 'pem_managed', 'private_key_managed'],
  xattr: ['delete', 'exists'],
  xml: ['value_present'],
  xmpp: ['send_msg', 'send_msg_multi'],
  zabbix_action: ['absent', 'present'],
  zabbix_host: ['absent', 'assign_templates', 'present'],
  zabbix_hostgroup: ['absent', 'present'],
  zabbix_mediatype: ['absent', 'present'],
  zabbix_template: ['absent', 'is_present', 'present'],
  zabbix_user: ['absent', 'admin_password_present', 'present'],
  zabbix_usergroup: ['absent', 'present'],
  zabbix_usermacro: ['absent', 'present'],
  zabbix_valuemap: ['absent', 'present'],
  zenoss: ['monitored'],
  zfs: ['bookmark_absent', 'bookmark_present', 'filesystem_absent', 'filesystem_present', 'hold_absent', 'hold_present', 'promoted', 'scheduled_snapshot', 'snapshot_absent', 'snapshot_present', 'volume_absent', 'volume_present'],
  zk_concurrency: ['lock', 'min_party', 'unlock'],
  zone: ['absent', 'attached', 'booted', 'detached', 'export', 'halted', 'import', 'installed', 'present', 'property_absent', 'property_present', 'resource_absent', 'resource_present', 'uninstalled'],
  zookeeper: ['absent', 'acls', 'present'],
  zpool: ['absent', 'present'],
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
// without it) -- generated the same way as MODULE_FUNCTIONS_3008/
// FULL_FUNCTION_FIELDS_3008, not hand-written. Used to guarantee "basic"
// always includes these, even for functions with no curated FUNCTION_FIELDS
// entry: showing just `name` for something like acl.absent (which also
// needs acl_type) would produce a state Salt rejects outright.

const MANDATORY_FIELDS_3008 = {
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

// Every 3006.x module.function with at least one parameter that has no
// default at all in its real v3006.27 signature -- see the comment above
// MANDATORY_FIELDS_3008 for what this guarantees.
const MANDATORY_FIELDS_3006 = {
  'acl.absent': ['acl_type'],
  'acl.list_absent': ['acl_type'],
  'acl.list_present': ['acl_type'],
  'acl.present': ['acl_type'],
  'alias.present': ['target'],
  'alternatives.install': ['link', 'path', 'priority'],
  'alternatives.remove': ['path'],
  'alternatives.set': ['path'],
  'apache.configfile': ['config'],
  'archive.extracted': ['source'],
  'artifactory.downloaded': ['artifact'],
  'at.present': ['timespec'],
  'at.watch': ['timespec'],
  'aws_sqs.absent': ['region'],
  'aws_sqs.exists': ['region'],
  'azurearm_compute.availability_set_absent': ['resource_group'],
  'azurearm_compute.availability_set_present': ['resource_group'],
  'azurearm_dns.record_set_absent': ['zone_name', 'resource_group'],
  'azurearm_dns.record_set_present': ['zone_name', 'resource_group', 'record_type'],
  'azurearm_dns.zone_absent': ['resource_group'],
  'azurearm_dns.zone_present': ['resource_group'],
  'azurearm_network.load_balancer_absent': ['resource_group'],
  'azurearm_network.load_balancer_present': ['resource_group'],
  'azurearm_network.network_interface_absent': ['resource_group'],
  'azurearm_network.network_interface_present': ['ip_configurations', 'subnet', 'virtual_network', 'resource_group'],
  'azurearm_network.network_security_group_absent': ['resource_group'],
  'azurearm_network.network_security_group_present': ['resource_group'],
  'azurearm_network.public_ip_address_absent': ['resource_group'],
  'azurearm_network.public_ip_address_present': ['resource_group'],
  'azurearm_network.route_absent': ['route_table', 'resource_group'],
  'azurearm_network.route_present': ['address_prefix', 'next_hop_type', 'route_table', 'resource_group'],
  'azurearm_network.route_table_absent': ['resource_group'],
  'azurearm_network.route_table_present': ['resource_group'],
  'azurearm_network.security_rule_absent': ['security_group', 'resource_group'],
  'azurearm_network.security_rule_present': ['access', 'direction', 'priority', 'protocol', 'security_group', 'resource_group'],
  'azurearm_network.subnet_absent': ['virtual_network', 'resource_group'],
  'azurearm_network.subnet_present': ['address_prefix', 'virtual_network', 'resource_group'],
  'azurearm_network.virtual_network_absent': ['resource_group'],
  'azurearm_network.virtual_network_present': ['address_prefixes', 'resource_group'],
  'azurearm_resource.policy_assignment_absent': ['scope'],
  'azurearm_resource.policy_assignment_present': ['scope', 'definition_name'],
  'azurearm_resource.resource_group_present': ['location'],
  'bigip.add_pool_member': ['hostname', 'username', 'password', 'member'],
  'bigip.create_monitor': ['hostname', 'username', 'password', 'monitor_type'],
  'bigip.create_node': ['hostname', 'username', 'password', 'address'],
  'bigip.create_pool': ['hostname', 'username', 'password'],
  'bigip.create_profile': ['hostname', 'username', 'password', 'profile_type'],
  'bigip.create_virtual': ['hostname', 'username', 'password', 'destination'],
  'bigip.delete_monitor': ['hostname', 'username', 'password', 'monitor_type'],
  'bigip.delete_node': ['hostname', 'username', 'password'],
  'bigip.delete_pool': ['hostname', 'username', 'password'],
  'bigip.delete_pool_member': ['hostname', 'username', 'password', 'member'],
  'bigip.delete_profile': ['hostname', 'username', 'password', 'profile_type'],
  'bigip.delete_virtual': ['hostname', 'username', 'password'],
  'bigip.list_monitor': ['hostname', 'username', 'password', 'monitor_type'],
  'bigip.list_node': ['hostname', 'username', 'password'],
  'bigip.list_pool': ['hostname', 'username', 'password'],
  'bigip.list_profile': ['hostname', 'username', 'password', 'profile_type'],
  'bigip.list_virtual': ['hostname', 'username', 'password'],
  'bigip.manage_monitor': ['hostname', 'username', 'password', 'monitor_type'],
  'bigip.manage_node': ['hostname', 'username', 'password', 'address'],
  'bigip.manage_pool': ['hostname', 'username', 'password'],
  'bigip.manage_pool_members': ['hostname', 'username', 'password', 'members'],
  'bigip.manage_profile': ['hostname', 'username', 'password', 'profile_type'],
  'bigip.manage_virtual': ['hostname', 'username', 'password', 'destination'],
  'bigip.modify_monitor': ['hostname', 'username', 'password', 'monitor_type'],
  'bigip.modify_node': ['hostname', 'username', 'password'],
  'bigip.modify_pool': ['hostname', 'username', 'password'],
  'bigip.modify_pool_member': ['hostname', 'username', 'password', 'member'],
  'bigip.modify_profile': ['hostname', 'username', 'password', 'profile_type'],
  'bigip.modify_virtual': ['hostname', 'username', 'password', 'destination'],
  'boto3_elasticsearch.upgraded': ['elasticsearch_version'],
  'boto_apigateway.absent': ['api_name', 'stage_name'],
  'boto_apigateway.present': ['api_name', 'swagger_file', 'stage_name', 'api_key_required', 'lambda_integration_role'],
  'boto_apigateway.usage_plan_absent': ['plan_name'],
  'boto_apigateway.usage_plan_association_absent': ['plan_name', 'api_stages'],
  'boto_apigateway.usage_plan_association_present': ['plan_name', 'api_stages'],
  'boto_apigateway.usage_plan_present': ['plan_name'],
  'boto_asg.present': ['launch_config_name', 'availability_zones', 'min_size', 'max_size'],
  'boto_cloudfront.present': ['config', 'tags'],
  'boto_cloudtrail.absent': ['Name'],
  'boto_cloudtrail.present': ['Name', 'S3BucketName'],
  'boto_cloudwatch_alarm.present': ['attributes'],
  'boto_cognitoidentity.pool_absent': ['IdentityPoolName'],
  'boto_cognitoidentity.pool_present': ['IdentityPoolName', 'AuthenticatedRole'],
  'boto_ec2.snapshot_created': ['ami_name', 'instance_name'],
  'boto_ec2.volumes_tagged': ['tag_maps'],
  'boto_elasticache.creategroup': ['primary_cluster_id', 'replication_group_description'],
  'boto_elasticsearch_domain.absent': ['DomainName'],
  'boto_elasticsearch_domain.present': ['DomainName'],
  'boto_elb.present': ['listeners'],
  'boto_elb.register_instances': ['instances'],
  'boto_elbv2.create_target_group': ['protocol', 'port', 'vpc_id'],
  'boto_elbv2.targets_deregistered': ['targets'],
  'boto_elbv2.targets_registered': ['targets'],
  'boto_iam.keys_present': ['number', 'save_dir'],
  'boto_iam.policy_present': ['policy_document'],
  'boto_iam.saml_provider_present': ['saml_metadata_document'],
  'boto_iam.server_cert_present': ['public_key', 'private_key'],
  'boto_iot.policy_absent': ['policyName'],
  'boto_iot.policy_attached': ['policyName', 'principal'],
  'boto_iot.policy_detached': ['policyName', 'principal'],
  'boto_iot.policy_present': ['policyName', 'policyDocument'],
  'boto_iot.thing_type_absent': ['thingTypeName'],
  'boto_iot.thing_type_present': ['thingTypeName', 'thingTypeDescription', 'searchableAttributesList'],
  'boto_iot.topic_rule_absent': ['ruleName'],
  'boto_iot.topic_rule_present': ['ruleName', 'sql', 'actions'],
  'boto_kms.key_present': ['policy'],
  'boto_lambda.alias_absent': ['FunctionName', 'Name'],
  'boto_lambda.alias_present': ['FunctionName', 'Name', 'FunctionVersion'],
  'boto_lambda.event_source_mapping_absent': ['EventSourceArn', 'FunctionName'],
  'boto_lambda.event_source_mapping_present': ['EventSourceArn', 'FunctionName', 'StartingPosition'],
  'boto_lambda.function_absent': ['FunctionName'],
  'boto_lambda.function_present': ['FunctionName', 'Runtime', 'Role', 'Handler'],
  'boto_lc.present': ['image_id'],
  'boto_rds.parameter_present': ['db_parameter_group_family', 'description'],
  'boto_rds.present': ['allocated_storage', 'db_instance_class', 'engine', 'master_username', 'master_user_password'],
  'boto_rds.replica_present': ['source'],
  'boto_rds.subnet_group_present': ['description'],
  'boto_route53.absent': ['zone', 'record_type'],
  'boto_route53.present': ['value', 'zone', 'record_type'],
  'boto_s3_bucket.absent': ['Bucket'],
  'boto_s3_bucket.present': ['Bucket'],
  'boto_secgroup.present': ['description'],
  'boto_vpc.present': ['cidr_block'],
  'boto_vpc.subnet_present': ['cidr_block'],
  'bower.installed': ['dir'],
  'bower.removed': ['dir'],
  'btrfs.properties': ['device'],
  'btrfs.subvolume_created': ['device'],
  'btrfs.subvolume_deleted': ['device'],
  'certutil.add_store': ['store'],
  'certutil.del_store': ['store'],
  'chocolatey.source_present': ['source_location'],
  'chronos_job.config': ['config'],
  'cimc.ntp': ['servers'],
  'cisconso.value_present': ['datastore', 'path', 'config'],
  'cloud.present': ['cloud_provider'],
  'cloud.profile': ['profile'],
  'cloud.volume_attached': ['server_name'],
  'cmd.call': ['func'],
  'cmd.wait_call': ['func'],
  'cryptdev.mapped': ['device'],
  'csf.nics_skip': ['nics', 'ipv6'],
  'csf.nics_skipped': ['nics'],
  'csf.option_present': ['value'],
  'csf.ports_open': ['ports'],
  'csf.rule_absent': ['method'],
  'csf.rule_present': ['method'],
  'ddns.absent': ['zone'],
  'ddns.present': ['zone', 'ttl', 'data'],
  'debconf.set': ['data'],
  'debconf.set_file': ['source'],
  'drac.present': ['password', 'permission'],
  'dvs.dvs_configured': ['dvs'],
  'dvs.portgroups_configured': ['dvs', 'portgroups'],
  'dvs.uplink_portgroup_configured': ['dvs', 'uplink_portgroup'],
  'elasticsearch.alias_absent': ['index'],
  'elasticsearch.alias_present': ['index'],
  'elasticsearch.index_template_present': ['definition'],
  'elasticsearch.pipeline_present': ['definition'],
  'elasticsearch.search_template_present': ['definition'],
  'elasticsearch_index_template.present': ['definition'],
  'environ.setenv': ['value'],
  'eselect.set': ['target'],
  'esxcluster.cluster_configured': ['cluster_config'],
  'esxcluster.vsan_datastore_configured': ['datastore_name'],
  'esxi.coredump_configured': ['enabled', 'dump_ip'],
  'esxi.diskgroups_configured': ['diskgroups'],
  'esxi.host_cache_configured': ['enabled', 'datastore'],
  'esxi.ntp_configured': ['service_running'],
  'esxi.password_present': ['password'],
  'esxi.ssh_configured': ['service_running'],
  'esxi.syslog_configured': ['syslog_configs'],
  'esxi.vmotion_configured': ['enabled'],
  'esxi.vsan_configured': ['enabled'],
  'esxvm.vm_configured': ['vm_name', 'cpu', 'memory', 'image', 'version', 'interfaces', 'disks', 'scsi_devices', 'serial_ports', 'datacenter', 'datastore', 'placement'],
  'esxvm.vm_created': ['vm_name', 'cpu', 'memory', 'image', 'version', 'interfaces', 'disks', 'scsi_devices', 'serial_ports', 'datacenter', 'datastore', 'placement'],
  'esxvm.vm_updated': ['vm_name', 'cpu', 'memory', 'image', 'version', 'interfaces', 'disks', 'scsi_devices', 'serial_ports', 'datacenter', 'datastore'],
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
  'glassfish.destination_present': ['physical'],
  'glusterfs.add_volume_bricks': ['bricks'],
  'glusterfs.op_version': ['version'],
  'glusterfs.volume_present': ['bricks'],
  'grafana4_datasource.present': ['type', 'url'],
  'grafana4_user.present': ['password', 'email'],
  'grafana_datasource.present': ['type', 'url'],
  'grains.append': ['value'],
  'grains.list_absent': ['value'],
  'grains.list_present': ['value'],
  'grains.present': ['value'],
  'helm.release_present': ['chart'],
  'host.absent': ['ip'],
  'host.only': ['hostnames'],
  'host.present': ['ip'],
  'icinga2.node_setup': ['master', 'ticket'],
  'icinga2.request_cert': ['master', 'ticket'],
  'icinga2.save_cert': ['master'],
  'idem.state': ['sls'],
  'ifttt.trigger_event': ['event'],
  'incron.absent': ['path', 'mask', 'cmd'],
  'incron.present': ['path', 'mask', 'cmd'],
  'influxdb08_user.present': ['passwd'],
  'influxdb_continuous_query.absent': ['database'],
  'influxdb_continuous_query.present': ['database', 'query'],
  'influxdb_retention_policy.absent': ['database'],
  'influxdb_retention_policy.present': ['database'],
  'influxdb_user.present': ['passwd'],
  'ipmi.user_present': ['uid', 'password'],
  'ipset.set_present': ['set_type'],
  'jboss7.bindings_exist': ['jboss_config', 'bindings'],
  'jboss7.datasource_exists': ['jboss_config', 'datasource_properties'],
  'jboss7.deployed': ['jboss_config'],
  'jboss7.reloaded': ['jboss_config'],
  'junos.get_table': ['table', 'table_file'],
  'junos.rollback': ['d_id'],
  'kapacitor.task_present': ['tick_script'],
  'keychain.installed': ['password'],
  'keychain.uninstalled': ['password'],
  'keystone.service_present': ['service_type'],
  'keystone.user_present': ['password', 'email'],
  'keystone_endpoint.absent': ['service_name'],
  'keystone_endpoint.present': ['service_name'],
  'keystore.managed': ['passphrase', 'entries'],
  'kubernetes.node_label_absent': ['node'],
  'kubernetes.node_label_folder_absent': ['node'],
  'kubernetes.node_label_present': ['node', 'value'],
  'ldap.managed': ['entries'],
  'lgpo_reg.value_absent': ['key'],
  'lgpo_reg.value_disabled': ['key'],
  'lgpo_reg.value_present': ['key', 'v_data'],
  'libcloud_dns.record_absent': ['zone', 'type', 'data', 'profile'],
  'libcloud_dns.record_present': ['zone', 'type', 'data', 'profile'],
  'libcloud_dns.state_result': ['result', 'message'],
  'libcloud_loadbalancer.balancer_absent': ['profile'],
  'libcloud_loadbalancer.balancer_present': ['port', 'protocol', 'profile'],
  'libcloud_loadbalancer.state_result': ['result', 'message'],
  'libcloud_storage.container_absent': ['profile'],
  'libcloud_storage.container_present': ['profile'],
  'libcloud_storage.file_present': ['container', 'path', 'profile'],
  'libcloud_storage.object_absent': ['container', 'profile'],
  'libcloud_storage.object_present': ['container', 'path', 'profile'],
  'libcloud_storage.state_result': ['result', 'message', 'changes'],
  'logrotate.set': ['key', 'value'],
  'loop.until_no_eval': ['expected'],
  'lxd.authenticate': ['remote_addr', 'password', 'cert', 'key'],
  'lxd.config_managed': ['value'],
  'lxd_container.migrated': ['remote_addr', 'cert', 'key', 'verify_cert', 'src_remote_addr'],
  'lxd_image.present': ['source'],
  'macdefaults.absent': ['domain'],
  'macdefaults.write': ['domain', 'value'],
  'marathon_app.config': ['config'],
  'modjk_worker.activate': ['lbn', 'target'],
  'modjk_worker.disable': ['lbn', 'target'],
  'modjk_worker.stop': ['lbn', 'target'],
  'mongodb_user.present': ['passwd'],
  'mount.fstab_absent': ['fs_file'],
  'mount.fstab_present': ['fs_file', 'fs_vfstype'],
  'mount.mounted': ['device', 'fstype'],
  'msteams.post_card': ['message'],
  'mysql_query.run': ['database', 'query'],
  'mysql_query.run_file': ['database'],
  'napalm_yang.configured': ['data'],
  'napalm_yang.managed': ['data'],
  'netacl.filter': ['filter_name'],
  'netacl.term': ['filter_name', 'term_name'],
  'netconfig.replace_pattern': ['pattern', 'repl'],
  'nexus.downloaded': ['artifact'],
  'nxos.image_running': ['system_image'],
  'nxos.replace': ['repl'],
  'openstack_config.absent': ['filename', 'section'],
  'openstack_config.present': ['filename', 'section', 'value'],
  'openvswitch_db.managed': ['table', 'data'],
  'openvswitch_port.present': ['bridge'],
  'pagerduty.create_event': ['details', 'service_key', 'profile'],
  'pbm.default_storage_policy_assigned': ['policy', 'datastore'],
  'pbm.default_vsan_policy_configured': ['policy'],
  'pbm.storage_policies_configured': ['policies'],
  'pcs.auth': ['nodes'],
  'pcs.cib_present': ['cibname'],
  'pcs.cib_pushed': ['cibname'],
  'pcs.cluster_node_present': ['node'],
  'pcs.cluster_setup': ['nodes'],
  'pcs.constraint_present': ['constraint_id', 'constraint_type'],
  'pcs.prop_has_value': ['prop', 'value'],
  'pcs.resource_defaults_to': ['default', 'value'],
  'pcs.resource_op_defaults_to': ['op_default', 'value'],
  'pcs.resource_present': ['resource_id', 'resource_type'],
  'pcs.stonith_present': ['stonith_id', 'stonith_device_type'],
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
  'probes.managed': ['probes'],
  'proxy.managed': ['port'],
  'pyrax_queues.absent': ['provider'],
  'pyrax_queues.present': ['provider'],
  'quota.mode': ['mode', 'quotatype'],
  'rabbitmq_cluster.joined': ['host'],
  'rabbitmq_policy.present': ['pattern', 'definition'],
  'rabbitmq_upstream.present': ['uri'],
  'raid.present': ['level', 'devices'],
  'redis.string': ['value'],
  'restconf.config_manage': ['path', 'method', 'config'],
  'rsync.synchronized': ['source'],
  'salt.function': ['tgt'],
  'salt.parallel_runners': ['runners'],
  'salt.state': ['tgt'],
  'salt.wait_for_event': ['id_list'],
  'selinux.boolean': ['value'],
  'selinux.fcontext_policy_present': ['sel_type'],
  'selinux.port_policy_present': ['sel_type'],
  'smartos.config_present': ['value'],
  'smartos.vm_present': ['vmconfig'],
  'smtp.send_msg': ['recipient', 'subject'],
  'solrcloud.alias': ['collections'],
  'splunk.absent': ['email'],
  'splunk.present': ['email'],
  'sqlite3.row_absent': ['db', 'table', 'where_sql'],
  'sqlite3.row_present': ['db', 'table', 'data', 'where_sql'],
  'sqlite3.table_absent': ['db'],
  'sqlite3.table_present': ['db', 'schema'],
  'ssh_auth.absent': ['user'],
  'ssh_auth.manage': ['ssh_keys', 'user'],
  'ssh_auth.present': ['user'],
  'statuspage.managed': ['config'],
  'svn.dirty': ['target'],
  'sysctl.present': ['value'],
  'sysfs.present': ['value'],
  'syslog_ng.config': ['config'],
  'sysrc.managed': ['value'],
  'telemetry_alert.absent': ['deployment_id', 'metric_name'],
  'telemetry_alert.present': ['deployment_id', 'metric_name', 'alert_config'],
  'tomcat.war_deployed': ['war'],
  'trafficserver.config': ['value'],
  'trafficserver.offline': ['path'],
  'vault.policy_present': ['rules'],
  'victorops.create_event': ['message_type'],
  'virt.network_defined': ['bridge', 'forward'],
  'virt.network_running': ['bridge', 'forward'],
  'virt.volume_defined': ['pool', 'size'],
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
  'wordpress.activated': ['path', 'user'],
  'wordpress.deactivated': ['path', 'user'],
  'wordpress.installed': ['user', 'admin_user', 'admin_password', 'admin_email', 'title', 'url'],
  'wusa.installed': ['source'],
  'x509.crl_managed': ['signing_private_key'],
  'x509.pem_managed': ['text'],
  'x509_v2.crl_managed': ['signing_private_key', 'revoked'],
  'x509_v2.csr_managed': ['private_key'],
  'x509_v2.pem_managed': ['text'],
  'xattr.delete': ['attributes'],
  'xattr.exists': ['attributes'],
  'xml.value_present': ['xpath', 'value'],
  'xmpp.send_msg': ['recipient', 'profile'],
  'xmpp.send_msg_multi': ['profile'],
  'zabbix_action.present': ['params'],
  'zabbix_host.assign_templates': ['host', 'templates'],
  'zabbix_host.present': ['host', 'groups', 'interfaces'],
  'zabbix_mediatype.present': ['mediatype'],
  'zabbix_template.present': ['params'],
  'zabbix_user.present': ['alias', 'passwd', 'usrgrps'],
  'zabbix_usermacro.present': ['value'],
  'zabbix_valuemap.present': ['params'],
  'zfs.bookmark_present': ['snapshot'],
  'zfs.hold_absent': ['snapshot'],
  'zfs.hold_present': ['snapshot'],
  'zfs.scheduled_snapshot': ['prefix'],
  'zfs.volume_present': ['volume_size'],
  'zk_concurrency.min_party': ['zk_hosts', 'min_nodes'],
  'zone.export': ['path'],
  'zone.import': ['path'],
  'zone.present': ['brand', 'zonepath'],
  'zone.property_absent': ['property'],
  'zone.property_present': ['property', 'value'],
  'zone.resource_absent': ['resource_type', 'resource_selector_property', 'resource_selector_value'],
  'zone.resource_present': ['resource_type', 'resource_selector_property', 'resource_selector_value'],
  'zookeeper.acls': ['acls'],
  'zookeeper.present': ['value'],
};

// Picks which argument set a completion item should use.
function getFields(mod, fn, variant, dataset) {
  const key = `${mod}.${fn}`;
  if (variant === 'full' && dataset.fullFunctionFields[key] && dataset.fullFunctionFields[key].length > 0) {
    return dataset.fullFunctionFields[key];
  }
  return getBasicFields(mod, fn, dataset);
}

// "basic" = the curated common set (or just `name` if nothing's curated for
// this function), with any genuinely mandatory parameter merged in that
// isn't already present -- pulling its real default-or-placeholder from
// the dataset's full-fields map when available, falling back to the bare
// param name otherwise. This is what keeps "basic" from ever omitting
// something Salt would actually require.
function getBasicFields(mod, fn, dataset) {
  const key = `${mod}.${fn}`;
  const curated = FUNCTION_FIELDS[key];
  const required = dataset.mandatoryFields[key] || [];
  const fields = curated ? curated.slice() : [['name', 'name']];
  if (required.length === 0) {
    return fields;
  }
  const present = new Set(fields.map(([k]) => k));
  const fullFields = dataset.fullFunctionFields[key] || [];
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

function availableVariants(mod, fn, dataset) {
  const key = `${mod}.${fn}`;
  const variants = ['basic'];
  if (dataset.fullFunctionFields[key] && dataset.fullFunctionFields[key].length > 0) {
    variants.push('full');
  }
  return variants;
}

// Full (all-arguments) variant of the same data, keyed the same way, generated
// the same way as MODULE_FUNCTIONS_3008 (real function signatures from Salt
// v3008.2 source, not hand-written) -- see the comment above
// MODULE_FUNCTIONS_3008 and AGENTS.md's "Updating the Salt module/function
// list" section. Only includes module.function pairs that actually have
// parameters beyond `name`; nothing to show "full" for is just omitted
// rather than duplicating the basic/name-only entry.
const FULL_FUNCTION_FIELDS_3008 = {
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

// Full (all-arguments) variant for the 3006.x dataset, generated the same
// way as FULL_FUNCTION_FIELDS_3008 -- see the comment above
// MODULE_FUNCTIONS_3006 and AGENTS.md's "Updating the Salt
// module/function list" section.
const FULL_FUNCTION_FIELDS_3006 = {
  'acl.absent': [['acl_type', 'acl_type'], ['acl_name', '\'\''], ['perms', '\'\''], ['recurse', 'False']],
  'acl.list_absent': [['acl_type', 'acl_type'], ['acl_names', 'None'], ['recurse', 'False']],
  'acl.list_present': [['acl_type', 'acl_type'], ['acl_names', 'None'], ['perms', '\'\''], ['recurse', 'False'], ['force', 'False']],
  'acl.present': [['acl_type', 'acl_type'], ['acl_name', '\'\''], ['perms', '\'\''], ['recurse', 'False'], ['force', 'False']],
  'acme.cert': [['aliases', 'None'], ['email', 'None'], ['webroot', 'None'], ['test_cert', 'False'], ['renew', 'None'], ['keysize', 'None'], ['server', 'None'], ['owner', 'root'], ['group', 'root'], ['mode', '0640'], ['certname', 'None'], ['preferred_challenges', 'None'], ['tls_sni_01_port', 'None'], ['tls_sni_01_address', 'None'], ['http_01_port', 'None'], ['http_01_address', 'None'], ['dns_plugin', 'None'], ['dns_plugin_credentials', 'None'], ['dns_plugin_propagate_seconds', '10']],
  'alias.present': [['target', 'target']],
  'alternatives.install': [['link', 'link'], ['path', 'path'], ['priority', 'priority']],
  'alternatives.remove': [['path', 'path']],
  'alternatives.set': [['path', 'path']],
  'ansible.playbooks': [['rundir', 'None'], ['git_repo', 'None'], ['git_kwargs', 'None'], ['ansible_kwargs', 'None']],
  'apache.configfile': [['config', 'config']],
  'archive.extracted': [['source', 'source'], ['source_hash', 'None'], ['source_hash_name', 'None'], ['source_hash_update', 'False'], ['skip_files_list_verify', 'False'], ['skip_verify', 'False'], ['password', 'None'], ['options', 'None'], ['list_options', 'None'], ['force', 'False'], ['overwrite', 'False'], ['clean', 'False'], ['clean_parent', 'False'], ['user', 'None'], ['group', 'None'], ['if_missing', 'None'], ['trim_output', 'False'], ['use_cmd_unzip', 'None'], ['extract_perms', 'True'], ['enforce_toplevel', 'True'], ['enforce_ownership_on', 'None'], ['archive_format', 'None'], ['use_etag', 'False']],
  'artifactory.downloaded': [['artifact', 'artifact'], ['target_dir', '/tmp'], ['target_file', 'None'], ['use_literal_group_id', 'False']],
  'assistive.installed': [['enabled', 'True']],
  'at.absent': [['jobid', 'None']],
  'at.present': [['timespec', 'timespec'], ['tag', 'None'], ['user', 'None'], ['job', 'None'], ['unique_tag', 'False']],
  'at.watch': [['timespec', 'timespec'], ['tag', 'None'], ['user', 'None'], ['job', 'None'], ['unique_tag', 'False']],
  'augeas.change': [['context', 'None'], ['changes', 'None'], ['lens', 'None'], ['load_path', 'None']],
  'aws_sqs.absent': [['region', 'region'], ['user', 'None'], ['opts', 'False']],
  'aws_sqs.exists': [['region', 'region'], ['user', 'None'], ['opts', 'False']],
  'azurearm_compute.availability_set_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_compute.availability_set_present': [['resource_group', 'resource_group'], ['tags', 'None'], ['platform_update_domain_count', 'None'], ['platform_fault_domain_count', 'None'], ['virtual_machines', 'None'], ['sku', 'None'], ['connection_auth', 'None']],
  'azurearm_dns.record_set_absent': [['zone_name', 'zone_name'], ['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_dns.record_set_present': [['zone_name', 'zone_name'], ['resource_group', 'resource_group'], ['record_type', 'record_type'], ['if_match', 'None'], ['if_none_match', 'None'], ['etag', 'None'], ['metadata', 'None'], ['ttl', 'None'], ['arecords', 'None'], ['aaaa_records', 'None'], ['mx_records', 'None'], ['ns_records', 'None'], ['ptr_records', 'None'], ['srv_records', 'None'], ['txt_records', 'None'], ['cname_record', 'None'], ['soa_record', 'None'], ['caa_records', 'None'], ['connection_auth', 'None']],
  'azurearm_dns.zone_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_dns.zone_present': [['resource_group', 'resource_group'], ['etag', 'None'], ['if_match', 'None'], ['if_none_match', 'None'], ['registration_virtual_networks', 'None'], ['resolution_virtual_networks', 'None'], ['tags', 'None'], ['zone_type', 'Public'], ['connection_auth', 'None']],
  'azurearm_network.load_balancer_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.load_balancer_present': [['resource_group', 'resource_group'], ['sku', 'None'], ['frontend_ip_configurations', 'None'], ['backend_address_pools', 'None'], ['load_balancing_rules', 'None'], ['probes', 'None'], ['inbound_nat_rules', 'None'], ['inbound_nat_pools', 'None'], ['outbound_nat_rules', 'None'], ['tags', 'None'], ['connection_auth', 'None']],
  'azurearm_network.network_interface_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.network_interface_present': [['ip_configurations', 'ip_configurations'], ['subnet', 'subnet'], ['virtual_network', 'virtual_network'], ['resource_group', 'resource_group'], ['tags', 'None'], ['virtual_machine', 'None'], ['network_security_group', 'None'], ['dns_settings', 'None'], ['mac_address', 'None'], ['primary', 'None'], ['enable_accelerated_networking', 'None'], ['enable_ip_forwarding', 'None'], ['connection_auth', 'None']],
  'azurearm_network.network_security_group_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.network_security_group_present': [['resource_group', 'resource_group'], ['tags', 'None'], ['security_rules', 'None'], ['connection_auth', 'None']],
  'azurearm_network.public_ip_address_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.public_ip_address_present': [['resource_group', 'resource_group'], ['tags', 'None'], ['sku', 'None'], ['public_ip_allocation_method', 'None'], ['public_ip_address_version', 'None'], ['dns_settings', 'None'], ['idle_timeout_in_minutes', 'None'], ['connection_auth', 'None']],
  'azurearm_network.route_absent': [['route_table', 'route_table'], ['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.route_present': [['address_prefix', 'address_prefix'], ['next_hop_type', 'next_hop_type'], ['route_table', 'route_table'], ['resource_group', 'resource_group'], ['next_hop_ip_address', 'None'], ['connection_auth', 'None']],
  'azurearm_network.route_table_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.route_table_present': [['resource_group', 'resource_group'], ['tags', 'None'], ['routes', 'None'], ['disable_bgp_route_propagation', 'None'], ['connection_auth', 'None']],
  'azurearm_network.security_rule_absent': [['security_group', 'security_group'], ['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.security_rule_present': [['access', 'access'], ['direction', 'direction'], ['priority', 'priority'], ['protocol', 'protocol'], ['security_group', 'security_group'], ['resource_group', 'resource_group'], ['destination_address_prefix', 'None'], ['destination_port_range', 'None'], ['source_address_prefix', 'None'], ['source_port_range', 'None'], ['description', 'None'], ['destination_address_prefixes', 'None'], ['destination_port_ranges', 'None'], ['source_address_prefixes', 'None'], ['source_port_ranges', 'None'], ['connection_auth', 'None']],
  'azurearm_network.subnet_absent': [['virtual_network', 'virtual_network'], ['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.subnet_present': [['address_prefix', 'address_prefix'], ['virtual_network', 'virtual_network'], ['resource_group', 'resource_group'], ['security_group', 'None'], ['route_table', 'None'], ['connection_auth', 'None']],
  'azurearm_network.virtual_network_absent': [['resource_group', 'resource_group'], ['connection_auth', 'None']],
  'azurearm_network.virtual_network_present': [['address_prefixes', 'address_prefixes'], ['resource_group', 'resource_group'], ['dns_servers', 'None'], ['tags', 'None'], ['connection_auth', 'None']],
  'azurearm_resource.policy_assignment_absent': [['scope', 'scope'], ['connection_auth', 'None']],
  'azurearm_resource.policy_assignment_present': [['scope', 'scope'], ['definition_name', 'definition_name'], ['display_name', 'None'], ['description', 'None'], ['assignment_type', 'None'], ['parameters', 'None'], ['connection_auth', 'None']],
  'azurearm_resource.policy_definition_absent': [['connection_auth', 'None']],
  'azurearm_resource.policy_definition_present': [['policy_rule', 'None'], ['policy_type', 'None'], ['mode', 'None'], ['display_name', 'None'], ['description', 'None'], ['metadata', 'None'], ['parameters', 'None'], ['policy_rule_json', 'None'], ['policy_rule_file', 'None'], ['template', 'jinja'], ['source_hash', 'None'], ['source_hash_name', 'None'], ['skip_verify', 'False'], ['connection_auth', 'None']],
  'azurearm_resource.resource_group_absent': [['connection_auth', 'None']],
  'azurearm_resource.resource_group_present': [['location', 'location'], ['managed_by', 'None'], ['tags', 'None'], ['connection_auth', 'None']],
  'beacon.absent': [['save', 'False']],
  'beacon.present': [['save', 'False']],
  'bigip.add_pool_member': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['member', 'member']],
  'bigip.create_monitor': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['monitor_type', 'monitor_type']],
  'bigip.create_node': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['address', 'address']],
  'bigip.create_pool': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['members', 'None'], ['allow_nat', 'None'], ['allow_snat', 'None'], ['description', 'None'], ['gateway_failsafe_device', 'None'], ['ignore_persisted_weight', 'None'], ['ip_tos_to_client', 'None'], ['ip_tos_to_server', 'None'], ['link_qos_to_client', 'None'], ['link_qos_to_server', 'None'], ['load_balancing_mode', 'None'], ['min_active_members', 'None'], ['min_up_members', 'None'], ['min_up_members_action', 'None'], ['min_up_members_checking', 'None'], ['monitor', 'None'], ['profiles', 'None'], ['queue_depth_limit', 'None'], ['queue_on_connection_limit', 'None'], ['queue_time_limit', 'None'], ['reselect_tries', 'None'], ['service_down_action', 'None'], ['slow_ramp_time', 'None']],
  'bigip.create_profile': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['profile_type', 'profile_type']],
  'bigip.create_virtual': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['destination', 'destination'], ['pool', 'None'], ['address_status', 'None'], ['auto_lasthop', 'None'], ['bwc_policy', 'None'], ['cmp_enabled', 'None'], ['connection_limit', 'None'], ['dhcp_relay', 'None'], ['description', 'None'], ['fallback_persistence', 'None'], ['flow_eviction_policy', 'None'], ['gtm_score', 'None'], ['ip_forward', 'None'], ['ip_protocol', 'None'], ['internal', 'None'], ['twelve_forward', 'None'], ['last_hop_pool', 'None'], ['mask', 'None'], ['mirror', 'None'], ['nat64', 'None'], ['persist', 'None'], ['profiles', 'None'], ['policies', 'None'], ['rate_class', 'None'], ['rate_limit', 'None'], ['rate_limit_mode', 'None'], ['rate_limit_dst', 'None'], ['rate_limit_src', 'None'], ['rules', 'None'], ['related_rules', 'None'], ['reject', 'None'], ['source', 'None'], ['source_address_translation', 'None'], ['source_port', 'None'], ['virtual_state', 'None'], ['traffic_classes', 'None'], ['translate_address', 'None'], ['translate_port', 'None'], ['vlans', 'None']],
  'bigip.delete_monitor': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['monitor_type', 'monitor_type']],
  'bigip.delete_node': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.delete_pool': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.delete_pool_member': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['member', 'member']],
  'bigip.delete_profile': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['profile_type', 'profile_type']],
  'bigip.delete_virtual': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.list_monitor': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['monitor_type', 'monitor_type']],
  'bigip.list_node': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.list_pool': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.list_profile': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['profile_type', 'profile_type']],
  'bigip.list_virtual': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password']],
  'bigip.manage_monitor': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['monitor_type', 'monitor_type']],
  'bigip.manage_node': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['address', 'address'], ['connection_limit', 'None'], ['description', 'None'], ['dynamic_ratio', 'None'], ['logging', 'None'], ['monitor', 'None'], ['rate_limit', 'None'], ['ratio', 'None'], ['session', 'None'], ['node_state', 'None']],
  'bigip.manage_pool': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['allow_nat', 'None'], ['allow_snat', 'None'], ['description', 'None'], ['gateway_failsafe_device', 'None'], ['ignore_persisted_weight', 'None'], ['ip_tos_to_client', 'None'], ['ip_tos_to_server', 'None'], ['link_qos_to_client', 'None'], ['link_qos_to_server', 'None'], ['load_balancing_mode', 'None'], ['min_active_members', 'None'], ['min_up_members', 'None'], ['min_up_members_action', 'None'], ['min_up_members_checking', 'None'], ['monitor', 'None'], ['profiles', 'None'], ['queue_depth_limit', 'None'], ['queue_on_connection_limit', 'None'], ['queue_time_limit', 'None'], ['reselect_tries', 'None'], ['service_down_action', 'None'], ['slow_ramp_time', 'None']],
  'bigip.manage_pool_members': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['members', 'members']],
  'bigip.manage_profile': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['profile_type', 'profile_type']],
  'bigip.manage_virtual': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['destination', 'destination'], ['pool', 'None'], ['address_status', 'None'], ['auto_lasthop', 'None'], ['bwc_policy', 'None'], ['cmp_enabled', 'None'], ['connection_limit', 'None'], ['dhcp_relay', 'None'], ['description', 'None'], ['fallback_persistence', 'None'], ['flow_eviction_policy', 'None'], ['gtm_score', 'None'], ['ip_forward', 'None'], ['ip_protocol', 'None'], ['internal', 'None'], ['twelve_forward', 'None'], ['last_hop_pool', 'None'], ['mask', 'None'], ['mirror', 'None'], ['nat64', 'None'], ['persist', 'None'], ['profiles', 'None'], ['policies', 'None'], ['rate_class', 'None'], ['rate_limit', 'None'], ['rate_limit_mode', 'None'], ['rate_limit_dst', 'None'], ['rate_limit_src', 'None'], ['rules', 'None'], ['related_rules', 'None'], ['reject', 'None'], ['source', 'None'], ['source_address_translation', 'None'], ['source_port', 'None'], ['virtual_state', 'None'], ['traffic_classes', 'None'], ['translate_address', 'None'], ['translate_port', 'None'], ['vlans', 'None']],
  'bigip.modify_monitor': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['monitor_type', 'monitor_type']],
  'bigip.modify_node': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['connection_limit', 'None'], ['description', 'None'], ['dynamic_ratio', 'None'], ['logging', 'None'], ['monitor', 'None'], ['rate_limit', 'None'], ['ratio', 'None'], ['session', 'None'], ['node_state', 'None']],
  'bigip.modify_pool': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['allow_nat', 'None'], ['allow_snat', 'None'], ['description', 'None'], ['gateway_failsafe_device', 'None'], ['ignore_persisted_weight', 'None'], ['ip_tos_to_client', 'None'], ['ip_tos_to_server', 'None'], ['link_qos_to_client', 'None'], ['link_qos_to_server', 'None'], ['load_balancing_mode', 'None'], ['min_active_members', 'None'], ['min_up_members', 'None'], ['min_up_members_action', 'None'], ['min_up_members_checking', 'None'], ['monitor', 'None'], ['profiles', 'None'], ['queue_depth_limit', 'None'], ['queue_on_connection_limit', 'None'], ['queue_time_limit', 'None'], ['reselect_tries', 'None'], ['service_down_action', 'None'], ['slow_ramp_time', 'None']],
  'bigip.modify_pool_member': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['member', 'member'], ['connection_limit', 'None'], ['description', 'None'], ['dynamic_ratio', 'None'], ['inherit_profile', 'None'], ['logging', 'None'], ['monitor', 'None'], ['priority_group', 'None'], ['profiles', 'None'], ['rate_limit', 'None'], ['ratio', 'None'], ['session', 'None'], ['member_state', 'None']],
  'bigip.modify_profile': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['profile_type', 'profile_type']],
  'bigip.modify_virtual': [['hostname', 'hostname'], ['username', 'username'], ['password', 'password'], ['destination', 'destination'], ['pool', 'None'], ['address_status', 'None'], ['auto_lasthop', 'None'], ['bwc_policy', 'None'], ['cmp_enabled', 'None'], ['connection_limit', 'None'], ['dhcp_relay', 'None'], ['description', 'None'], ['fallback_persistence', 'None'], ['flow_eviction_policy', 'None'], ['gtm_score', 'None'], ['ip_forward', 'None'], ['ip_protocol', 'None'], ['internal', 'None'], ['twelve_forward', 'None'], ['last_hop_pool', 'None'], ['mask', 'None'], ['mirror', 'None'], ['nat64', 'None'], ['persist', 'None'], ['profiles', 'None'], ['policies', 'None'], ['rate_class', 'None'], ['rate_limit', 'None'], ['rate_limit_mode', 'None'], ['rate_limit_dst', 'None'], ['rate_limit_src', 'None'], ['rules', 'None'], ['related_rules', 'None'], ['reject', 'None'], ['source', 'None'], ['source_address_translation', 'None'], ['source_port', 'None'], ['virtual_state', 'None'], ['traffic_classes', 'None'], ['translate_address', 'None'], ['translate_port', 'None'], ['vlans', 'None']],
  'blockdev.formatted': [['fs_type', 'ext4'], ['force', 'False']],
  'boto3_elasticache.cache_cluster_absent': [['wait', '600'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticache.cache_cluster_present': [['wait', '900'], ['security_groups', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticache.cache_subnet_group_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticache.cache_subnet_group_present': [['subnets', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticache.replication_group_absent': [['wait', '600'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticache.replication_group_present': [['wait', '900'], ['security_groups', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_elasticsearch.absent': [['blocking', 'True'], ['region', 'None'], ['keyid', 'None'], ['key', 'None'], ['profile', 'None']],
  'boto3_elasticsearch.latest': [['minor_only', 'True'], ['region', 'None'], ['keyid', 'None'], ['key', 'None'], ['profile', 'None']],
  'boto3_elasticsearch.present': [['elasticsearch_version', 'None'], ['elasticsearch_cluster_config', 'None'], ['ebs_options', 'None'], ['access_policies', 'None'], ['snapshot_options', 'None'], ['vpc_options', 'None'], ['cognito_options', 'None'], ['encryption_at_rest_options', 'None'], ['node_to_node_encryption_options', 'None'], ['advanced_options', 'None'], ['log_publishing_options', 'None'], ['blocking', 'True'], ['tags', 'None'], ['region', 'None'], ['keyid', 'None'], ['key', 'None'], ['profile', 'None']],
  'boto3_elasticsearch.tagged': [['tags', 'None'], ['replace', 'False'], ['region', 'None'], ['keyid', 'None'], ['key', 'None'], ['profile', 'None']],
  'boto3_elasticsearch.upgraded': [['elasticsearch_version', 'elasticsearch_version'], ['blocking', 'True'], ['region', 'None'], ['keyid', 'None'], ['key', 'None'], ['profile', 'None']],
  'boto3_route53.hosted_zone_absent': [['Name', 'None'], ['PrivateZone', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_route53.hosted_zone_present': [['Name', 'None'], ['PrivateZone', 'False'], ['CallerReference', 'None'], ['Comment', 'None'], ['VPCs', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_route53.rr_absent': [['HostedZoneId', 'None'], ['DomainName', 'None'], ['PrivateZone', 'False'], ['Name', 'None'], ['Type', 'None'], ['SetIdentifier', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_route53.rr_present': [['HostedZoneId', 'None'], ['DomainName', 'None'], ['PrivateZone', 'False'], ['Name', 'None'], ['Type', 'None'], ['SetIdentifier', 'None'], ['Weight', 'None'], ['Region', 'None'], ['GeoLocation', 'None'], ['Failover', 'None'], ['TTL', 'None'], ['ResourceRecords', 'None'], ['AliasTarget', 'None'], ['HealthCheckId', 'None'], ['TrafficPolicyInstanceId', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_sns.topic_absent': [['unsubscribe', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto3_sns.topic_present': [['subscriptions', 'None'], ['attributes', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_apigateway.absent': [['api_name', 'api_name'], ['stage_name', 'stage_name'], ['nuke_api', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_apigateway.present': [['api_name', 'api_name'], ['swagger_file', 'swagger_file'], ['stage_name', 'stage_name'], ['api_key_required', 'api_key_required'], ['lambda_integration_role', 'lambda_integration_role'], ['lambda_region', 'None'], ['stage_variables', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['lambda_funcname_format', '{stage}_{api}_{resource}_{method}'], ['authorization_type', 'NONE'], ['error_response_template', 'None'], ['response_template', 'None']],
  'boto_apigateway.usage_plan_absent': [['plan_name', 'plan_name'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_apigateway.usage_plan_association_absent': [['plan_name', 'plan_name'], ['api_stages', 'api_stages'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_apigateway.usage_plan_association_present': [['plan_name', 'plan_name'], ['api_stages', 'api_stages'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_apigateway.usage_plan_present': [['plan_name', 'plan_name'], ['description', 'None'], ['throttle', 'None'], ['quota', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_asg.absent': [['force', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['remove_lc', 'False']],
  'boto_asg.present': [['launch_config_name', 'launch_config_name'], ['availability_zones', 'availability_zones'], ['min_size', 'min_size'], ['max_size', 'max_size'], ['launch_config', 'None'], ['desired_capacity', 'None'], ['load_balancers', 'None'], ['default_cooldown', 'None'], ['health_check_type', 'None'], ['health_check_period', 'None'], ['placement_group', 'None'], ['vpc_zone_identifier', 'None'], ['subnet_names', 'None'], ['tags', 'None'], ['termination_policies', 'None'], ['termination_policies_from_pillar', 'boto_asg_termination_policies'], ['suspended_processes', 'None'], ['scaling_policies', 'None'], ['scaling_policies_from_pillar', 'boto_asg_scaling_policies'], ['scheduled_actions', 'None'], ['scheduled_actions_from_pillar', 'boto_asg_scheduled_actions'], ['alarms', 'None'], ['alarms_from_pillar', 'boto_asg_alarms'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['notification_arn', 'None'], ['notification_arn_from_pillar', 'boto_asg_notification_arn'], ['notification_types', 'None'], ['notification_types_from_pillar', 'boto_asg_notification_types']],
  'boto_cfn.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cfn.present': [['template_body', 'None'], ['template_url', 'None'], ['parameters', 'None'], ['notification_arns', 'None'], ['disable_rollback', 'None'], ['timeout_in_minutes', 'None'], ['capabilities', 'None'], ['tags', 'None'], ['on_failure', 'None'], ['stack_policy_body', 'None'], ['stack_policy_url', 'None'], ['use_previous_template', 'None'], ['stack_policy_during_update_body', 'None'], ['stack_policy_during_update_url', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudfront.present': [['config', 'config'], ['tags', 'tags'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudtrail.absent': [['Name', 'Name'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudtrail.present': [['Name', 'Name'], ['S3BucketName', 'S3BucketName'], ['S3KeyPrefix', 'None'], ['SnsTopicName', 'None'], ['IncludeGlobalServiceEvents', 'True'], ['IsMultiRegionTrail', 'None'], ['EnableLogFileValidation', 'False'], ['CloudWatchLogsLogGroupArn', 'None'], ['CloudWatchLogsRoleArn', 'None'], ['KmsKeyId', 'None'], ['LoggingEnabled', 'True'], ['Tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudwatch_alarm.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudwatch_alarm.present': [['attributes', 'attributes'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudwatch_event.absent': [['Name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cloudwatch_event.present': [['Name', 'None'], ['ScheduleExpression', 'None'], ['EventPattern', 'None'], ['Description', 'None'], ['RoleArn', 'None'], ['State', 'None'], ['Targets', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cognitoidentity.pool_absent': [['IdentityPoolName', 'IdentityPoolName'], ['RemoveAllMatched', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_cognitoidentity.pool_present': [['IdentityPoolName', 'IdentityPoolName'], ['AuthenticatedRole', 'AuthenticatedRole'], ['AllowUnauthenticatedIdentities', 'False'], ['UnauthenticatedRole', 'None'], ['SupportedLoginProviders', 'None'], ['DeveloperProviderName', 'None'], ['OpenIdConnectProviderARNs', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_datapipeline.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_datapipeline.present': [['pipeline_objects', 'None'], ['pipeline_objects_from_pillars', 'boto_datapipeline_pipeline_objects'], ['parameter_objects', 'None'], ['parameter_objects_from_pillars', 'boto_datapipeline_parameter_objects'], ['parameter_values', 'None'], ['parameter_values_from_pillars', 'boto_datapipeline_parameter_values'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_dynamodb.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_dynamodb.present': [['table_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['read_capacity_units', 'None'], ['write_capacity_units', 'None'], ['alarms', 'None'], ['alarms_from_pillar', 'boto_dynamodb_alarms'], ['hash_key', 'None'], ['hash_key_data_type', 'None'], ['range_key', 'None'], ['range_key_data_type', 'None'], ['local_indexes', 'None'], ['global_indexes', 'None'], ['backup_configs_from_pillars', 'boto_dynamodb_backup_configs']],
  'boto_ec2.eni_absent': [['release_eip', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.eni_present': [['subnet_id', 'None'], ['subnet_name', 'None'], ['private_ip_address', 'None'], ['description', 'None'], ['groups', 'None'], ['source_dest_check', 'True'], ['allocate_eip', 'None'], ['arecords', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.instance_absent': [['instance_name', 'None'], ['instance_id', 'None'], ['release_eip', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['filters', 'None']],
  'boto_ec2.instance_present': [['instance_name', 'None'], ['instance_id', 'None'], ['image_id', 'None'], ['image_name', 'None'], ['tags', 'None'], ['key_name', 'None'], ['security_groups', 'None'], ['user_data', 'None'], ['instance_type', 'None'], ['placement', 'None'], ['kernel_id', 'None'], ['ramdisk_id', 'None'], ['vpc_id', 'None'], ['vpc_name', 'None'], ['monitoring_enabled', 'None'], ['subnet_id', 'None'], ['subnet_name', 'None'], ['private_ip_address', 'None'], ['block_device_map', 'None'], ['disable_api_termination', 'None'], ['instance_initiated_shutdown_behavior', 'None'], ['placement_group', 'None'], ['client_token', 'None'], ['security_group_ids', 'None'], ['security_group_names', 'None'], ['additional_info', 'None'], ['tenancy', 'None'], ['instance_profile_arn', 'None'], ['instance_profile_name', 'None'], ['ebs_optimized', 'None'], ['network_interfaces', 'None'], ['network_interface_name', 'None'], ['network_interface_id', 'None'], ['attributes', 'None'], ['target_state', 'None'], ['public_ip', 'None'], ['allocation_id', 'None'], ['allocate_eip', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.key_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.key_present': [['save_private', 'None'], ['upload_public', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.private_ips_absent': [['network_interface_name', 'None'], ['network_interface_id', 'None'], ['private_ip_addresses', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.private_ips_present': [['network_interface_name', 'None'], ['network_interface_id', 'None'], ['private_ip_addresses', 'None'], ['allow_reassignment', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.snapshot_created': [['ami_name', 'ami_name'], ['instance_name', 'instance_name'], ['wait_until_available', 'True'], ['wait_timeout_seconds', '300']],
  'boto_ec2.volume_absent': [['volume_name', 'None'], ['volume_id', 'None'], ['instance_name', 'None'], ['instance_id', 'None'], ['device', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.volume_present': [['volume_name', 'None'], ['volume_id', 'None'], ['instance_name', 'None'], ['instance_id', 'None'], ['device', 'None'], ['size', 'None'], ['snapshot_id', 'None'], ['volume_type', 'None'], ['iops', 'None'], ['encrypted', 'False'], ['kms_key_id', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_ec2.volumes_tagged': [['tag_maps', 'tag_maps'], ['authoritative', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.absent': [['wait', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.creategroup': [['primary_cluster_id', 'primary_cluster_id'], ['replication_group_description', 'replication_group_description'], ['wait', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.present': [['engine', 'None'], ['cache_node_type', 'None'], ['num_cache_nodes', 'None'], ['preferred_availability_zone', 'None'], ['port', 'None'], ['cache_parameter_group_name', 'None'], ['cache_security_group_names', 'None'], ['replication_group_id', 'None'], ['auto_minor_version_upgrade', 'True'], ['security_group_ids', 'None'], ['cache_subnet_group_name', 'None'], ['engine_version', 'None'], ['notification_topic_arn', 'None'], ['preferred_maintenance_window', 'None'], ['wait', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.replication_group_absent': [['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.subnet_group_absent': [['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticache.subnet_group_present': [['subnet_ids', 'None'], ['subnet_names', 'None'], ['description', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticsearch_domain.absent': [['DomainName', 'DomainName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elasticsearch_domain.present': [['DomainName', 'DomainName'], ['ElasticsearchClusterConfig', 'None'], ['EBSOptions', 'None'], ['AccessPolicies', 'None'], ['SnapshotOptions', 'None'], ['AdvancedOptions', 'None'], ['Tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['ElasticsearchVersion', '1.5']],
  'boto_elb.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elb.present': [['listeners', 'listeners'], ['availability_zones', 'None'], ['subnets', 'None'], ['subnet_names', 'None'], ['security_groups', 'None'], ['scheme', 'internet-facing'], ['health_check', 'None'], ['attributes', 'None'], ['attributes_from_pillar', 'boto_elb_attributes'], ['cnames', 'None'], ['alarms', 'None'], ['alarms_from_pillar', 'boto_elb_alarms'], ['policies', 'None'], ['policies_from_pillar', 'boto_elb_policies'], ['backends', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['wait_for_sync', 'True'], ['tags', 'None'], ['instance_ids', 'None'], ['instance_names', 'None']],
  'boto_elb.register_instances': [['instances', 'instances'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elbv2.create_target_group': [['protocol', 'protocol'], ['port', 'port'], ['vpc_id', 'vpc_id'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['health_check_protocol', 'HTTP'], ['health_check_port', 'traffic-port'], ['health_check_path', '/'], ['health_check_interval_seconds', '30'], ['health_check_timeout_seconds', '5'], ['healthy_threshold_count', '5'], ['unhealthy_threshold_count', '2']],
  'boto_elbv2.delete_target_group': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elbv2.targets_deregistered': [['targets', 'targets'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_elbv2.targets_registered': [['targets', 'targets'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.account_policy': [['allow_users_to_change_password', 'None'], ['hard_expiry', 'None'], ['max_password_age', 'None'], ['minimum_password_length', 'None'], ['password_reuse_prevention', 'None'], ['require_lowercase_characters', 'None'], ['require_numbers', 'None'], ['require_symbols', 'None'], ['require_uppercase_characters', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.group_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.group_present': [['policies', 'None'], ['policies_from_pillars', 'None'], ['managed_policies', 'None'], ['users', 'None'], ['path', '/'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['delete_policies', 'True']],
  'boto_iam.keys_present': [['number', 'number'], ['save_dir', 'save_dir'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['save_format', '{2}\n{0}\n{3}\n{1}\n']],
  'boto_iam.policy_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.policy_present': [['policy_document', 'policy_document'], ['path', 'None'], ['description', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.saml_provider_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.saml_provider_present': [['saml_metadata_document', 'saml_metadata_document'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.server_cert_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.server_cert_present': [['public_key', 'public_key'], ['private_key', 'private_key'], ['cert_chain', 'None'], ['path', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.user_absent': [['delete_keys', 'True'], ['delete_mfa_devices', 'True'], ['delete_profile', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam.user_present': [['policies', 'None'], ['policies_from_pillars', 'None'], ['managed_policies', 'None'], ['password', 'None'], ['path', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam_role.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iam_role.present': [['policy_document', 'None'], ['policy_document_from_pillars', 'None'], ['path', 'None'], ['policies', 'None'], ['policies_from_pillars', 'None'], ['managed_policies', 'None'], ['create_instance_profile', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['delete_policies', 'True']],
  'boto_iot.policy_absent': [['policyName', 'policyName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.policy_attached': [['policyName', 'policyName'], ['principal', 'principal'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.policy_detached': [['policyName', 'policyName'], ['principal', 'principal'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.policy_present': [['policyName', 'policyName'], ['policyDocument', 'policyDocument'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.thing_type_absent': [['thingTypeName', 'thingTypeName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.thing_type_present': [['thingTypeName', 'thingTypeName'], ['thingTypeDescription', 'thingTypeDescription'], ['searchableAttributesList', 'searchableAttributesList'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.topic_rule_absent': [['ruleName', 'ruleName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_iot.topic_rule_present': [['ruleName', 'ruleName'], ['sql', 'sql'], ['actions', 'actions'], ['description', '\'\''], ['ruleDisabled', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_kinesis.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_kinesis.present': [['retention_hours', 'None'], ['enhanced_monitoring', 'None'], ['num_shards', 'None'], ['do_reshard', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_kms.key_present': [['policy', 'policy'], ['description', 'None'], ['key_usage', 'None'], ['grants', 'None'], ['manage_grants', 'False'], ['key_rotation', 'False'], ['enabled', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.alias_absent': [['FunctionName', 'FunctionName'], ['Name', 'Name'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.alias_present': [['FunctionName', 'FunctionName'], ['Name', 'Name'], ['FunctionVersion', 'FunctionVersion'], ['Description', '\'\''], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.event_source_mapping_absent': [['EventSourceArn', 'EventSourceArn'], ['FunctionName', 'FunctionName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.event_source_mapping_present': [['EventSourceArn', 'EventSourceArn'], ['FunctionName', 'FunctionName'], ['StartingPosition', 'StartingPosition'], ['Enabled', 'True'], ['BatchSize', '100'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.function_absent': [['FunctionName', 'FunctionName'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lambda.function_present': [['FunctionName', 'FunctionName'], ['Runtime', 'Runtime'], ['Role', 'Role'], ['Handler', 'Handler'], ['ZipFile', 'None'], ['S3Bucket', 'None'], ['S3Key', 'None'], ['S3ObjectVersion', 'None'], ['Description', '\'\''], ['Timeout', '3'], ['MemorySize', '128'], ['Permissions', 'None'], ['RoleRetries', '5'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['VpcConfig', 'None'], ['Environment', 'None']],
  'boto_lc.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_lc.present': [['image_id', 'image_id'], ['key_name', 'None'], ['vpc_id', 'None'], ['vpc_name', 'None'], ['security_groups', 'None'], ['user_data', 'None'], ['cloud_init', 'None'], ['instance_type', 'm1.small'], ['kernel_id', 'None'], ['ramdisk_id', 'None'], ['block_device_mappings', 'None'], ['delete_on_termination', 'None'], ['instance_monitoring', 'False'], ['spot_price', 'None'], ['instance_profile_name', 'None'], ['ebs_optimized', 'False'], ['associate_public_ip_address', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_rds.absent': [['skip_final_snapshot', 'None'], ['final_db_snapshot_identifier', 'None'], ['tags', 'None'], ['wait_for_deletion', 'True'], ['timeout', '180'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_rds.parameter_present': [['db_parameter_group_family', 'db_parameter_group_family'], ['description', 'description'], ['parameters', 'None'], ['apply_method', 'pending-reboot'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_rds.present': [['allocated_storage', 'allocated_storage'], ['db_instance_class', 'db_instance_class'], ['engine', 'engine'], ['master_username', 'master_username'], ['master_user_password', 'master_user_password'], ['db_name', 'None'], ['storage_type', 'None'], ['db_security_groups', 'None'], ['vpc_security_group_ids', 'None'], ['vpc_security_groups', 'None'], ['availability_zone', 'None'], ['db_subnet_group_name', 'None'], ['preferred_maintenance_window', 'None'], ['db_parameter_group_name', 'None'], ['db_cluster_identifier', 'None'], ['tde_credential_arn', 'None'], ['tde_credential_password', 'None'], ['storage_encrypted', 'None'], ['kms_keyid', 'None'], ['backup_retention_period', 'None'], ['preferred_backup_window', 'None'], ['port', 'None'], ['multi_az', 'None'], ['engine_version', 'None'], ['auto_minor_version_upgrade', 'None'], ['license_model', 'None'], ['iops', 'None'], ['option_group_name', 'None'], ['character_set_name', 'None'], ['publicly_accessible', 'None'], ['wait_status', 'None'], ['tags', 'None'], ['copy_tags_to_snapshot', 'None'], ['region', 'None'], ['domain', 'None'], ['key', 'None'], ['keyid', 'None'], ['monitoring_interval', 'None'], ['monitoring_role_arn', 'None'], ['domain_iam_role_name', 'None'], ['promotion_tier', 'None'], ['profile', 'None']],
  'boto_rds.replica_present': [['source', 'source'], ['db_instance_class', 'None'], ['availability_zone', 'None'], ['port', 'None'], ['auto_minor_version_upgrade', 'None'], ['iops', 'None'], ['option_group_name', 'None'], ['publicly_accessible', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['db_parameter_group_name', 'None']],
  'boto_rds.subnet_group_absent': [['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_rds.subnet_group_present': [['description', 'description'], ['subnet_ids', 'None'], ['subnet_names', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_route53.absent': [['zone', 'zone'], ['record_type', 'record_type'], ['identifier', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['wait_for_sync', 'True'], ['split_dns', 'False'], ['private_zone', 'False']],
  'boto_route53.hosted_zone_absent': [['domain_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_route53.hosted_zone_present': [['domain_name', 'None'], ['private_zone', 'False'], ['caller_ref', 'None'], ['comment', '\'\''], ['vpc_id', 'None'], ['vpc_name', 'None'], ['vpc_region', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_route53.present': [['value', 'value'], ['zone', 'zone'], ['record_type', 'record_type'], ['ttl', 'None'], ['identifier', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['wait_for_sync', 'True'], ['split_dns', 'False'], ['private_zone', 'False']],
  'boto_s3.object_present': [['source', 'None'], ['hash_type', 'None'], ['extra_args', 'None'], ['extra_args_from_pillar', 'boto_s3_object_extra_args'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_s3_bucket.absent': [['Bucket', 'Bucket'], ['Force', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_s3_bucket.present': [['Bucket', 'Bucket'], ['LocationConstraint', 'None'], ['ACL', 'None'], ['CORSRules', 'None'], ['LifecycleConfiguration', 'None'], ['Logging', 'None'], ['NotificationConfiguration', 'None'], ['Policy', 'None'], ['Replication', 'None'], ['RequestPayment', 'None'], ['Tagging', 'None'], ['Versioning', 'None'], ['Website', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_secgroup.absent': [['vpc_id', 'None'], ['vpc_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_secgroup.present': [['description', 'description'], ['vpc_id', 'None'], ['vpc_name', 'None'], ['rules', 'None'], ['rules_egress', 'None'], ['delete_ingress_rules', 'True'], ['delete_egress_rules', 'True'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['tags', 'None']],
  'boto_sns.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['unsubscribe', 'False']],
  'boto_sns.present': [['subscriptions', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_sqs.absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_sqs.present': [['attributes', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.absent': [['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.accept_vpc_peering_connection': [['conn_id', 'None'], ['conn_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.delete_vpc_peering_connection': [['conn_id', 'None'], ['conn_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.dhcp_options_absent': [['dhcp_options_id', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.dhcp_options_present': [['dhcp_options_id', 'None'], ['vpc_name', 'None'], ['vpc_id', 'None'], ['domain_name', 'None'], ['domain_name_servers', 'None'], ['ntp_servers', 'None'], ['netbios_name_servers', 'None'], ['netbios_node_type', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.internet_gateway_absent': [['detach', 'False'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.internet_gateway_present': [['vpc_name', 'None'], ['vpc_id', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.nat_gateway_absent': [['subnet_name', 'None'], ['subnet_id', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['wait_for_delete_retries', '0']],
  'boto_vpc.nat_gateway_present': [['subnet_name', 'None'], ['subnet_id', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['allocation_id', 'None']],
  'boto_vpc.present': [['cidr_block', 'cidr_block'], ['instance_tenancy', 'None'], ['dns_support', 'None'], ['dns_hostnames', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.request_vpc_peering_connection': [['requester_vpc_id', 'None'], ['requester_vpc_name', 'None'], ['peer_vpc_id', 'None'], ['peer_vpc_name', 'None'], ['conn_name', 'None'], ['peer_owner_id', 'None'], ['peer_region', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.route_table_absent': [['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.route_table_present': [['vpc_name', 'None'], ['vpc_id', 'None'], ['routes', 'None'], ['subnet_ids', 'None'], ['subnet_names', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.subnet_absent': [['subnet_id', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.subnet_present': [['cidr_block', 'cidr_block'], ['vpc_name', 'None'], ['vpc_id', 'None'], ['availability_zone', 'None'], ['tags', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None'], ['route_table_id', 'None'], ['route_table_name', 'None'], ['auto_assign_public_ipv4', 'False']],
  'boto_vpc.vpc_peering_connection_absent': [['conn_id', 'None'], ['conn_name', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'boto_vpc.vpc_peering_connection_present': [['requester_vpc_id', 'None'], ['requester_vpc_name', 'None'], ['peer_vpc_id', 'None'], ['peer_vpc_name', 'None'], ['conn_name', 'None'], ['peer_owner_id', 'None'], ['peer_region', 'None'], ['region', 'None'], ['key', 'None'], ['keyid', 'None'], ['profile', 'None']],
  'bower.bootstrap': [['user', 'None']],
  'bower.installed': [['dir', 'dir'], ['pkgs', 'None'], ['user', 'None'], ['env', 'None']],
  'bower.pruned': [['user', 'None'], ['env', 'None']],
  'bower.removed': [['dir', 'dir'], ['user', 'None']],
  'btrfs.properties': [['device', 'device'], ['use_default', 'False'], ['__dest', 'None']],
  'btrfs.subvolume_created': [['device', 'device'], ['qgroupids', 'None'], ['set_default', 'False'], ['copy_on_write', 'True'], ['force_set_default', 'True'], ['__dest', 'None']],
  'btrfs.subvolume_deleted': [['device', 'device'], ['commit', 'False'], ['__dest', 'None']],
  'buildout.installed': [['config', 'buildout.cfg'], ['quiet', 'False'], ['parts', 'None'], ['user', 'None'], ['env', '()'], ['buildout_ver', 'None'], ['test_release', 'False'], ['distribute', 'None'], ['new_st', 'None'], ['offline', 'False'], ['newest', 'False'], ['python', 'sys.executable'], ['debug', 'False'], ['verbose', 'False'], ['unless', 'None'], ['onlyif', 'None'], ['use_vt', 'False'], ['loglevel', 'debug']],
  'cabal.installed': [['pkgs', 'None'], ['user', 'None'], ['install_global', 'False'], ['env', 'None']],
  'cabal.removed': [['user', 'None'], ['env', 'None']],
  'certutil.add_store': [['store', 'store'], ['saltenv', 'base']],
  'certutil.del_store': [['store', 'store'], ['saltenv', 'base']],
  'chocolatey.installed': [['version', 'None'], ['source', 'None'], ['force', 'False'], ['pre_versions', 'False'], ['install_args', 'None'], ['override_args', 'False'], ['force_x86', 'False'], ['package_args', 'None'], ['allow_multiple', 'False'], ['execution_timeout', 'None'], ['virus_check', 'None']],
  'chocolatey.source_present': [['source_location', 'source_location'], ['username', 'None'], ['password', 'None'], ['force', 'False'], ['priority', 'None']],
  'chocolatey.uninstalled': [['version', 'None'], ['uninstall_args', 'None'], ['override_args', 'False']],
  'chocolatey.upgraded': [['version', 'None'], ['source', 'None'], ['force', 'False'], ['pre_versions', 'False'], ['install_args', 'None'], ['override_args', 'False'], ['force_x86', 'False'], ['package_args', 'None']],
  'chronos_job.config': [['config', 'config']],
  'cimc.hostname': [['hostname', 'None']],
  'cimc.logging_levels': [['remote', 'None'], ['local', 'None']],
  'cimc.ntp': [['servers', 'servers']],
  'cimc.power_configuration': [['policy', 'None'], ['delayType', 'None'], ['delayValue', 'None']],
  'cimc.syslog': [['primary', 'None'], ['secondary', 'None']],
  'cimc.user': [['id', '\'\''], ['user', '\'\''], ['priv', '\'\''], ['password', '\'\''], ['status', 'active']],
  'cisconso.value_present': [['datastore', 'datastore'], ['path', 'path'], ['config', 'config']],
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
  'composer.installed': [['composer', 'None'], ['php', 'None'], ['user', 'None'], ['prefer_source', 'None'], ['prefer_dist', 'None'], ['no_scripts', 'None'], ['no_plugins', 'None'], ['optimize', 'None'], ['no_dev', 'None'], ['quiet', 'False'], ['composer_home', '/root'], ['always_check', 'True'], ['env', 'None']],
  'composer.update': [['composer', 'None'], ['php', 'None'], ['user', 'None'], ['prefer_source', 'None'], ['prefer_dist', 'None'], ['no_scripts', 'None'], ['no_plugins', 'None'], ['optimize', 'None'], ['no_dev', 'None'], ['quiet', 'False'], ['composer_home', '/root'], ['env', 'None']],
  'consul.acl_absent': [['id', 'None'], ['token', 'None'], ['consul_url', 'http://localhost:8500']],
  'consul.acl_present': [['id', 'None'], ['token', 'None'], ['type', 'client'], ['rules', '\'\''], ['consul_url', 'http://localhost:8500']],
  'cron.absent': [['user', 'root'], ['identifier', 'False'], ['special', 'None']],
  'cron.env_absent': [['user', 'root']],
  'cron.env_present': [['value', 'None'], ['user', 'root']],
  'cron.file': [['source_hash', '\'\''], ['source_hash_name', 'None'], ['user', 'root'], ['template', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['backup', '\'\'']],
  'cron.present': [['user', 'root'], ['minute', '*'], ['hour', '*'], ['daymonth', '*'], ['month', '*'], ['dayweek', '*'], ['comment', 'None'], ['commented', 'False'], ['identifier', 'False'], ['special', 'None']],
  'cryptdev.mapped': [['device', 'device'], ['keyfile', 'None'], ['opts', 'None'], ['config', '/etc/crypttab'], ['persist', 'True'], ['immediate', 'False'], ['match_on', 'name']],
  'cryptdev.unmapped': [['config', '/etc/crypttab'], ['persist', 'True'], ['immediate', 'False']],
  'csf.nics_skip': [['nics', 'nics'], ['ipv6', 'ipv6']],
  'csf.nics_skipped': [['nics', 'nics'], ['ipv6', 'False']],
  'csf.option_present': [['value', 'value'], ['reload', 'False']],
  'csf.ports_open': [['ports', 'ports'], ['proto', 'tcp'], ['direction', 'in']],
  'csf.rule_absent': [['method', 'method'], ['port', 'None'], ['proto', 'tcp'], ['direction', 'in'], ['port_origin', 'd'], ['ip_origin', 's'], ['ttl', 'None'], ['reload', 'False']],
  'csf.rule_present': [['method', 'method'], ['port', 'None'], ['proto', 'tcp'], ['direction', 'in'], ['port_origin', 'd'], ['ip_origin', 's'], ['ttl', 'None'], ['comment', '\'\''], ['reload', 'False']],
  'csf.testing_off': [['reload', 'False']],
  'csf.testing_on': [['reload', 'False']],
  'cyg.installed': [['cyg_arch', 'x86_64'], ['mirrors', 'None']],
  'cyg.removed': [['cyg_arch', 'x86_64'], ['mirrors', 'None']],
  'cyg.updated': [['cyg_arch', 'x86_64'], ['mirrors', 'None']],
  'ddns.absent': [['zone', 'zone'], ['data', 'None'], ['rdtype', 'None']],
  'ddns.present': [['zone', 'zone'], ['ttl', 'ttl'], ['data', 'data'], ['rdtype', 'A']],
  'debconf.set': [['data', 'data']],
  'debconf.set_file': [['source', 'source'], ['template', 'None'], ['context', 'None'], ['defaults', 'None']],
  'dellchassis.blade_idrac': [['idrac_password', 'None'], ['idrac_ipmi', 'None'], ['idrac_ip', 'None'], ['idrac_netmask', 'None'], ['idrac_gateway', 'None'], ['idrac_dnsname', 'None'], ['idrac_dhcp', 'None']],
  'dellchassis.chassis': [['chassis_name', 'None'], ['password', 'None'], ['datacenter', 'None'], ['location', 'None'], ['mode', 'None'], ['idrac_launch', 'None'], ['slot_names', 'None'], ['blade_power_states', 'None']],
  'dellchassis.switch': [['ip', 'None'], ['netmask', 'None'], ['gateway', 'None'], ['dhcp', 'None'], ['password', 'None'], ['snmp', 'None']],
  'disk.status': [['maximum', 'None'], ['minimum', 'None'], ['absolute', 'False'], ['free', 'False']],
  'dism.capability_installed': [['source', 'None'], ['limit_access', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.capability_removed': [['image', 'None'], ['restart', 'False']],
  'dism.feature_installed': [['package', 'None'], ['source', 'None'], ['limit_access', 'False'], ['enable_parent', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.feature_removed': [['remove_payload', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.kb_removed': [['image', 'None'], ['restart', 'False']],
  'dism.package_installed': [['ignore_check', 'False'], ['prevent_pending', 'False'], ['image', 'None'], ['restart', 'False']],
  'dism.package_removed': [['image', 'None'], ['restart', 'False']],
  'docker_container.absent': [['force', 'False']],
  'docker_container.run': [['image', 'None'], ['bg', 'False'], ['failhard', 'True'], ['replace', 'False'], ['force', 'False'], ['skip_translate', 'None'], ['ignore_collisions', 'False'], ['validate_ip_addrs', 'True'], ['client_timeout', 'salt.utils.dockermod.CLIENT_TIMEOUT']],
  'docker_container.running': [['image', 'None'], ['skip_translate', 'None'], ['ignore_collisions', 'False'], ['validate_ip_addrs', 'True'], ['force', 'False'], ['watch_action', 'force'], ['start', 'True'], ['shutdown_timeout', 'None'], ['client_timeout', 'salt.utils.dockermod.CLIENT_TIMEOUT'], ['networks', 'None']],
  'docker_container.stopped': [['containers', 'None'], ['shutdown_timeout', 'None'], ['unpause', 'False'], ['error_on_absent', 'True']],
  'docker_image.absent': [['images', 'None'], ['force', 'False']],
  'docker_image.present': [['tag', 'None'], ['build', 'None'], ['load', 'None'], ['force', 'False'], ['insecure_registry', 'False'], ['client_timeout', 'salt.utils.dockermod.CLIENT_TIMEOUT'], ['dockerfile', 'None'], ['sls', 'None'], ['base', 'opensuse/python'], ['saltenv', 'base'], ['pillarenv', 'None'], ['pillar', 'None']],
  'docker_network.present': [['skip_translate', 'None'], ['ignore_collisions', 'False'], ['validate_ip_addrs', 'True'], ['containers', 'None'], ['reconnect', 'True']],
  'docker_volume.absent': [['driver', 'None']],
  'docker_volume.present': [['driver', 'None'], ['driver_opts', 'None'], ['force', 'False']],
  'drac.present': [['password', 'password'], ['permission', 'permission']],
  'dvs.dvs_configured': [['dvs', 'dvs']],
  'dvs.portgroups_configured': [['dvs', 'dvs'], ['portgroups', 'portgroups']],
  'dvs.uplink_portgroup_configured': [['dvs', 'dvs'], ['uplink_portgroup', 'uplink_portgroup']],
  'elasticsearch.alias_absent': [['index', 'index']],
  'elasticsearch.alias_present': [['index', 'index'], ['definition', 'None']],
  'elasticsearch.index_present': [['definition', 'None']],
  'elasticsearch.index_template_present': [['definition', 'definition'], ['check_definition', 'False']],
  'elasticsearch.pipeline_present': [['definition', 'definition']],
  'elasticsearch.search_template_present': [['definition', 'definition']],
  'elasticsearch_index.present': [['definition', 'None']],
  'elasticsearch_index_template.present': [['definition', 'definition']],
  'environ.setenv': [['value', 'value'], ['false_unsets', 'False'], ['clear_all', 'False'], ['update_minion', 'False'], ['permanent', 'False']],
  'eselect.set': [['target', 'target'], ['module_parameter', 'None'], ['action_parameter', 'None']],
  'esxcluster.cluster_configured': [['cluster_config', 'cluster_config']],
  'esxcluster.licenses_configured': [['licenses', 'None']],
  'esxcluster.vsan_datastore_configured': [['datastore_name', 'datastore_name']],
  'esxi.coredump_configured': [['enabled', 'enabled'], ['dump_ip', 'dump_ip'], ['host_vnic', 'vmk0'], ['dump_port', '6500']],
  'esxi.diskgroups_configured': [['diskgroups', 'diskgroups'], ['erase_disks', 'False']],
  'esxi.host_cache_configured': [['enabled', 'enabled'], ['datastore', 'datastore'], ['swap_size', '100%'], ['dedicated_backing_disk', 'False'], ['erase_backing_disk', 'False']],
  'esxi.ntp_configured': [['service_running', 'service_running'], ['ntp_servers', 'None'], ['service_policy', 'None'], ['service_restart', 'False'], ['update_datetime', 'False']],
  'esxi.password_present': [['password', 'password']],
  'esxi.ssh_configured': [['service_running', 'service_running'], ['ssh_key', 'None'], ['ssh_key_file', 'None'], ['service_policy', 'None'], ['service_restart', 'False'], ['certificate_verify', 'None']],
  'esxi.syslog_configured': [['syslog_configs', 'syslog_configs'], ['firewall', 'True'], ['reset_service', 'True'], ['reset_syslog_config', 'False'], ['reset_configs', 'None']],
  'esxi.vmotion_configured': [['enabled', 'enabled'], ['device', 'vmk0']],
  'esxi.vsan_configured': [['enabled', 'enabled'], ['add_disks_to_vsan', 'False']],
  'esxvm.vm_configured': [['vm_name', 'vm_name'], ['cpu', 'cpu'], ['memory', 'memory'], ['image', 'image'], ['version', 'version'], ['interfaces', 'interfaces'], ['disks', 'disks'], ['scsi_devices', 'scsi_devices'], ['serial_ports', 'serial_ports'], ['datacenter', 'datacenter'], ['datastore', 'datastore'], ['placement', 'placement'], ['cd_dvd_drives', 'None'], ['sata_controllers', 'None'], ['advanced_configs', 'None'], ['template', 'None'], ['tools', 'True'], ['power_on', 'False'], ['deploy', 'False']],
  'esxvm.vm_created': [['vm_name', 'vm_name'], ['cpu', 'cpu'], ['memory', 'memory'], ['image', 'image'], ['version', 'version'], ['interfaces', 'interfaces'], ['disks', 'disks'], ['scsi_devices', 'scsi_devices'], ['serial_ports', 'serial_ports'], ['datacenter', 'datacenter'], ['datastore', 'datastore'], ['placement', 'placement'], ['ide_controllers', 'None'], ['sata_controllers', 'None'], ['cd_dvd_drives', 'None'], ['advanced_configs', 'None'], ['power_on', 'False']],
  'esxvm.vm_updated': [['vm_name', 'vm_name'], ['cpu', 'cpu'], ['memory', 'memory'], ['image', 'image'], ['version', 'version'], ['interfaces', 'interfaces'], ['disks', 'disks'], ['scsi_devices', 'scsi_devices'], ['serial_ports', 'serial_ports'], ['datacenter', 'datacenter'], ['datastore', 'datastore'], ['cd_dvd_drives', 'None'], ['sata_controllers', 'None'], ['advanced_configs', 'None'], ['power_on', 'False']],
  'etcd.directory': [['profile', 'None']],
  'etcd.rm': [['recurse', 'False'], ['profile', 'None']],
  'etcd.set': [['value', 'value'], ['profile', 'None']],
  'etcd.wait_rm': [['recurse', 'False'], ['profile', 'None']],
  'etcd.wait_set': [['value', 'value'], ['profile', 'None']],
  'event.send': [['data', 'None'], ['preload', 'None'], ['with_env', 'False'], ['with_grains', 'False'], ['with_pillar', 'False'], ['show_changed', 'True']],
  'event.wait': [['sfun', 'None'], ['data', 'None']],
  'file.accumulated': [['filename', 'filename'], ['text', 'text']],
  'file.append': [['text', 'None'], ['makedirs', 'False'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['ignore_whitespace', 'True']],
  'file.blockreplace': [['marker_start', '#-- start managed zone --'], ['marker_end', '#-- end managed zone --'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['content', '\'\''], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['backup', '.bak'], ['show_changes', 'True'], ['append_newline', 'None'], ['insert_before_match', 'None'], ['insert_after_match', 'None']],
  'file.cached': [['source_hash', '\'\''], ['source_hash_name', 'None'], ['skip_verify', 'False'], ['saltenv', 'base'], ['use_etag', 'False']],
  'file.comment': [['regex', 'regex'], ['char', '#'], ['backup', '.bak'], ['ignore_missing', 'False']],
  'file.copy': [['source', 'source'], ['force', 'False'], ['makedirs', 'False'], ['preserve', 'False'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['dir_mode', 'None'], ['subdir', 'False']],
  'file.decode': [['encoded_data', 'None'], ['contents_pillar', 'None'], ['encoding_type', 'base64'], ['checksum', 'md5']],
  'file.directory': [['user', 'None'], ['group', 'None'], ['recurse', 'None'], ['max_depth', 'None'], ['dir_mode', 'None'], ['file_mode', 'None'], ['makedirs', 'False'], ['clean', 'False'], ['require', 'None'], ['exclude_pat', 'None'], ['follow_symlinks', 'False'], ['force', 'False'], ['backupname', 'None'], ['allow_symlink', 'True'], ['children_only', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'file.hardlink': [['target', 'target'], ['force', 'False'], ['makedirs', 'False'], ['user', 'None'], ['group', 'None'], ['dir_mode', 'None']],
  'file.keyvalue': [['key', 'None'], ['value', 'None'], ['key_values', 'None'], ['separator', '='], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['search_only', 'False'], ['show_changes', 'True'], ['ignore_if_missing', 'False'], ['count', '1'], ['uncomment', 'None'], ['key_ignore_case', 'False'], ['value_ignore_case', 'False']],
  'file.line': [['content', 'None'], ['match', 'None'], ['mode', 'None'], ['location', 'None'], ['before', 'None'], ['after', 'None'], ['show_changes', 'True'], ['backup', 'False'], ['quiet', 'False'], ['indent', 'True'], ['create', 'False'], ['user', 'None'], ['group', 'None'], ['file_mode', 'None']],
  'file.managed': [['source', 'None'], ['source_hash', '\'\''], ['source_hash_name', 'None'], ['keep_source', 'True'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['attrs', 'None'], ['template', 'None'], ['makedirs', 'False'], ['dir_mode', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['backup', '\'\''], ['show_changes', 'True'], ['create', 'True'], ['contents', 'None'], ['tmp_dir', '\'\''], ['tmp_ext', '\'\''], ['contents_pillar', 'None'], ['contents_grains', 'None'], ['contents_newline', 'True'], ['contents_delimiter', ':'], ['encoding', 'None'], ['encoding_errors', 'strict'], ['allow_empty', 'True'], ['follow_symlinks', 'True'], ['check_cmd', 'None'], ['skip_verify', 'False'], ['selinux', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False'], ['verify_ssl', 'True'], ['use_etag', 'False']],
  'file.mknod': [['ntype', 'ntype'], ['major', '0'], ['minor', '0'], ['user', 'None'], ['group', 'None'], ['mode', '0600']],
  'file.not_cached': [['saltenv', 'base']],
  'file.patch': [['source', 'None'], ['source_hash', 'None'], ['source_hash_name', 'None'], ['skip_verify', 'False'], ['template', 'None'], ['context', 'None'], ['defaults', 'None'], ['options', '\'\''], ['reject_file', 'None'], ['strip', 'None'], ['saltenv', 'None']],
  'file.prepend': [['text', 'None'], ['makedirs', 'False'], ['source', 'None'], ['source_hash', 'None'], ['template', 'jinja'], ['sources', 'None'], ['source_hashes', 'None'], ['defaults', 'None'], ['context', 'None'], ['header', 'None']],
  'file.pruned': [['recurse', 'False'], ['ignore_errors', 'False'], ['older_than', 'None']],
  'file.recurse': [['source', 'source'], ['keep_source', 'True'], ['clean', 'False'], ['require', 'None'], ['user', 'None'], ['group', 'None'], ['dir_mode', 'None'], ['file_mode', 'None'], ['sym_mode', 'None'], ['template', 'None'], ['context', 'None'], ['replace', 'True'], ['defaults', 'None'], ['include_empty', 'False'], ['backup', '\'\''], ['include_pat', 'None'], ['exclude_pat', 'None'], ['maxdepth', 'None'], ['keep_symlinks', 'False'], ['force_symlinks', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True']],
  'file.rename': [['source', 'source'], ['force', 'False'], ['makedirs', 'False']],
  'file.replace': [['pattern', 'pattern'], ['repl', 'repl'], ['count', '0'], ['flags', '8'], ['bufsize', '1'], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['not_found_content', 'None'], ['backup', '.bak'], ['show_changes', 'True'], ['ignore_if_missing', 'False'], ['backslash_literal', 'False'], ['encoding', 'None']],
  'file.retention_schedule': [['retain', 'retain'], ['strptime_format', 'None'], ['timezone', 'None']],
  'file.serialize': [['dataset', 'None'], ['dataset_pillar', 'None'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['backup', '\'\''], ['makedirs', 'False'], ['show_changes', 'True'], ['create', 'True'], ['merge_if_exists', 'False'], ['encoding', 'None'], ['encoding_errors', 'strict'], ['serializer', 'None'], ['serializer_opts', 'None'], ['deserializer_opts', 'None']],
  'file.shortcut': [['target', 'target'], ['arguments', 'None'], ['working_dir', 'None'], ['description', 'None'], ['icon_location', 'None'], ['force', 'False'], ['backupname', 'None'], ['makedirs', 'False'], ['user', 'None']],
  'file.symlink': [['target', 'target'], ['force', 'False'], ['backupname', 'None'], ['makedirs', 'False'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'None'], ['atomic', 'False'], ['disallow_copy_and_unlink', 'False'], ['inherit_user_and_group', 'False']],
  'file.tidied': [['age', '0'], ['matches', 'None'], ['rmdirs', 'False'], ['size', '0'], ['exclude', 'None'], ['full_path_match', 'False'], ['followlinks', 'False'], ['time_comparison', 'atime'], ['age_size_logical_operator', 'OR'], ['age_size_only', 'None'], ['rmlinks', 'True']],
  'file.touch': [['atime', 'None'], ['mtime', 'None'], ['makedirs', 'False']],
  'file.uncomment': [['regex', 'regex'], ['char', '#'], ['backup', '.bak']],
  'firewall.check': [['port', 'None']],
  'firewalld.present': [['block_icmp', 'None'], ['prune_block_icmp', 'False'], ['default', 'None'], ['masquerade', 'False'], ['ports', 'None'], ['prune_ports', 'False'], ['port_fwd', 'None'], ['prune_port_fwd', 'False'], ['services', 'None'], ['prune_services', 'False'], ['interfaces', 'None'], ['prune_interfaces', 'False'], ['sources', 'None'], ['prune_sources', 'False'], ['rich_rules', 'None'], ['prune_rich_rules', 'False']],
  'firewalld.service': [['ports', 'None'], ['protocols', 'None']],
  'gem.installed': [['ruby', 'None'], ['gem_bin', 'None'], ['user', 'None'], ['version', 'None'], ['rdoc', 'False'], ['ri', 'False'], ['pre_releases', 'False'], ['proxy', 'None'], ['source', 'None']],
  'gem.removed': [['ruby', 'None'], ['user', 'None'], ['gem_bin', 'None']],
  'gem.sources_add': [['ruby', 'None'], ['user', 'None']],
  'gem.sources_remove': [['ruby', 'None'], ['user', 'None']],
  'git.cloned': [['target', 'target'], ['branch', 'None'], ['user', 'None'], ['password', 'None'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['output_encoding', 'None']],
  'git.config_set': [['value', 'None'], ['multivar', 'None'], ['repo', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'git.config_unset': [['value_regex', 'None'], ['repo', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'git.detached': [['rev', 'rev'], ['target', 'target'], ['remote', 'origin'], ['user', 'None'], ['password', 'None'], ['force_clone', 'False'], ['force_checkout', 'False'], ['fetch_remote', 'True'], ['hard_reset', 'False'], ['submodules', 'False'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['output_encoding', 'None']],
  'git.latest': [['target', 'target'], ['rev', 'HEAD'], ['branch', 'None'], ['user', 'None'], ['password', 'None'], ['update_head', 'True'], ['force_checkout', 'False'], ['force_clone', 'False'], ['force_fetch', 'False'], ['force_reset', 'False'], ['submodules', 'False'], ['bare', 'False'], ['mirror', 'False'], ['remote', 'origin'], ['fetch_tags', 'True'], ['sync_tags', 'True'], ['depth', 'None'], ['identity', 'None'], ['https_user', 'None'], ['https_pass', 'None'], ['refspec_branch', '*'], ['refspec_tag', '*'], ['output_encoding', 'None']],
  'git.present': [['force', 'False'], ['bare', 'True'], ['template', 'None'], ['separate_git_dir', 'None'], ['shared', 'None'], ['user', 'None'], ['password', 'None'], ['output_encoding', 'None']],
  'github.absent': [['profile', 'github']],
  'github.present': [['profile', 'github']],
  'github.repo_absent': [['profile', 'github']],
  'github.repo_present': [['description', 'None'], ['homepage', 'None'], ['private', 'None'], ['has_issues', 'None'], ['has_wiki', 'None'], ['has_downloads', 'None'], ['auto_init', 'False'], ['gitignore_template', 'None'], ['license_template', 'None'], ['teams', 'None'], ['profile', 'github']],
  'github.team_absent': [['profile', 'github']],
  'github.team_present': [['description', 'None'], ['repo_names', 'None'], ['privacy', 'secret'], ['permission', 'pull'], ['members', 'None'], ['enforce_mfa', 'False'], ['no_mfa_grace_seconds', '0'], ['profile', 'github']],
  'glance_image.absent': [['auth', 'None']],
  'glance_image.present': [['auth', 'None']],
  'glassfish.connection_factory_absent': [['both', 'True'], ['server', 'None']],
  'glassfish.connection_factory_present': [['restype', 'connection_factory'], ['description', '\'\''], ['enabled', 'True'], ['min_size', '1'], ['max_size', '250'], ['resize_quantity', '2'], ['idle_timeout', '300'], ['wait_timeout', '60'], ['reconnect_on_failure', 'False'], ['transaction_support', '\'\''], ['connection_validation', 'False'], ['server', 'None']],
  'glassfish.destination_absent': [['server', 'None']],
  'glassfish.destination_present': [['physical', 'physical'], ['restype', 'queue'], ['description', '\'\''], ['enabled', 'True'], ['server', 'None']],
  'glassfish.jdbc_datasource_absent': [['both', 'True'], ['server', 'None']],
  'glassfish.jdbc_datasource_present': [['description', '\'\''], ['enabled', 'True'], ['restype', 'datasource'], ['vendor', 'mysql'], ['sql_url', '\'\''], ['sql_user', '\'\''], ['sql_password', '\'\''], ['min_size', '8'], ['max_size', '32'], ['resize_quantity', '2'], ['idle_timeout', '300'], ['wait_timeout', '60'], ['non_transactional', 'False'], ['transaction_isolation', '\'\''], ['isolation_guaranteed', 'True'], ['server', 'None']],
  'glassfish.system_properties_absent': [['server', 'None']],
  'glassfish.system_properties_present': [['server', 'None']],
  'glusterfs.add_volume_bricks': [['bricks', 'bricks']],
  'glusterfs.op_version': [['version', 'version']],
  'glusterfs.volume_present': [['bricks', 'bricks'], ['stripe', 'False'], ['replica', 'False'], ['device_vg', 'False'], ['transport', 'tcp'], ['start', 'False'], ['force', 'False'], ['arbiter', 'False']],
  'gnomedesktop.desktop_interface': [['user', 'None'], ['automatic_mnemonics', 'None'], ['buttons_have_icons', 'None'], ['can_change_accels', 'None'], ['clock_format', 'None'], ['clock_show_date', 'None'], ['clock_show_seconds', 'None'], ['cursor_blink', 'None'], ['cursor_blink_time', 'None'], ['cursor_blink_timeout', 'None'], ['cursor_size', 'None'], ['cursor_theme', 'None'], ['document_font_name', 'None'], ['enable_animations', 'None'], ['font_name', 'None'], ['gtk_color_palette', 'None'], ['gtk_color_scheme', 'None'], ['gtk_im_module', 'None'], ['gtk_im_preedit_style', 'None'], ['gtk_im_status_style', 'None'], ['gtk_key_theme', 'None'], ['gtk_theme', 'None'], ['gtk_timeout_initial', 'None'], ['gtk_timeout_repeat', 'None'], ['icon_theme', 'None'], ['menubar_accel', 'None'], ['menubar_detachable', 'None'], ['menus_have_icons', 'None'], ['menus_have_tearoff', 'None'], ['monospace_font_name', 'None'], ['show_input_method_menu', 'None'], ['show_unicode_menu', 'None'], ['text_scaling_factor', 'None'], ['toolbar_detachable', 'None'], ['toolbar_icons_size', 'None'], ['toolbar_style', 'None'], ['toolkit_accessibility', 'None']],
  'gnomedesktop.desktop_lockdown': [['user', 'None'], ['disable_application_handlers', 'None'], ['disable_command_line', 'None'], ['disable_lock_screen', 'None'], ['disable_log_out', 'None'], ['disable_print_setup', 'None'], ['disable_printing', 'None'], ['disable_save_to_disk', 'None'], ['disable_user_switching', 'None'], ['user_administration_disabled', 'None']],
  'gnomedesktop.wm_preferences': [['user', 'None'], ['action_double_click_titlebar', 'None'], ['action_middle_click_titlebar', 'None'], ['action_right_click_titlebar', 'None'], ['application_based', 'None'], ['audible_bell', 'None'], ['auto_raise', 'None'], ['auto_raise_delay', 'None'], ['button_layout', 'None'], ['disable_workarounds', 'None'], ['focus_mode', 'None'], ['focus_new_windows', 'None'], ['mouse_button_modifier', 'None'], ['num_workspaces', 'None'], ['raise_on_click', 'None'], ['resize_with_right_button', 'None'], ['theme', 'None'], ['titlebar_font', 'None'], ['titlebar_uses_system_font', 'None'], ['visual_bell', 'None'], ['visual_bell_type', 'None'], ['workspace_names', 'None']],
  'gpg.absent': [['keys', 'None'], ['user', 'None'], ['gnupghome', 'None']],
  'gpg.present': [['keys', 'None'], ['user', 'None'], ['keyserver', 'None'], ['gnupghome', 'None'], ['trust', 'None']],
  'grafana.dashboard_absent': [['hosts', 'None'], ['profile', 'grafana']],
  'grafana.dashboard_present': [['dashboard', 'None'], ['dashboard_from_pillar', 'None'], ['rows', 'None'], ['rows_from_pillar', 'None'], ['profile', 'grafana']],
  'grafana4_dashboard.absent': [['orgname', 'None'], ['profile', 'grafana']],
  'grafana4_dashboard.present': [['base_dashboards_from_pillar', 'None'], ['base_panels_from_pillar', 'None'], ['base_rows_from_pillar', 'None'], ['dashboard', 'None'], ['orgname', 'None'], ['profile', 'grafana']],
  'grafana4_datasource.absent': [['orgname', 'None'], ['profile', 'grafana']],
  'grafana4_datasource.present': [['type', 'type'], ['url', 'url'], ['access', 'None'], ['user', 'None'], ['password', 'None'], ['database', 'None'], ['basic_auth', 'None'], ['basic_auth_user', 'None'], ['basic_auth_password', 'None'], ['tls_auth', 'None'], ['json_data', 'None'], ['is_default', 'None'], ['with_credentials', 'None'], ['type_logo_url', 'None'], ['orgname', 'None'], ['profile', 'grafana']],
  'grafana4_org.absent': [['profile', 'grafana']],
  'grafana4_org.present': [['users', 'None'], ['theme', 'None'], ['home_dashboard_id', 'None'], ['timezone', 'None'], ['address1', 'None'], ['address2', 'None'], ['city', 'None'], ['zip_code', 'None'], ['address_state', 'None'], ['country', 'None'], ['profile', 'grafana']],
  'grafana4_user.absent': [['profile', 'grafana']],
  'grafana4_user.present': [['password', 'password'], ['email', 'email'], ['is_admin', 'False'], ['fullname', 'None'], ['theme', 'None'], ['profile', 'grafana']],
  'grafana_dashboard.absent': [['profile', 'grafana']],
  'grafana_dashboard.present': [['base_dashboards_from_pillar', 'None'], ['base_panels_from_pillar', 'None'], ['base_rows_from_pillar', 'None'], ['dashboard', 'None'], ['profile', 'grafana']],
  'grafana_datasource.absent': [['profile', 'grafana']],
  'grafana_datasource.present': [['type', 'type'], ['url', 'url'], ['access', 'proxy'], ['user', '\'\''], ['password', '\'\''], ['database', '\'\''], ['basic_auth', 'False'], ['basic_auth_user', '\'\''], ['basic_auth_password', '\'\''], ['is_default', 'False'], ['json_data', 'None'], ['profile', 'grafana']],
  'grains.absent': [['destructive', 'False'], ['delimiter', 'DEFAULT_TARGET_DELIM'], ['force', 'False']],
  'grains.append': [['value', 'value'], ['convert', 'False'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.exists': [['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.list_absent': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.list_present': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM']],
  'grains.present': [['value', 'value'], ['delimiter', 'DEFAULT_TARGET_DELIM'], ['force', 'False']],
  'group.present': [['gid', 'None'], ['system', 'False'], ['addusers', 'None'], ['delusers', 'None'], ['members', 'None'], ['non_unique', 'False']],
  'heat.absent': [['poll', '5'], ['timeout', '60'], ['profile', 'None']],
  'heat.deployed': [['template', 'None'], ['environment', 'None'], ['params', 'None'], ['poll', '5'], ['rollback', 'False'], ['timeout', '60'], ['update', 'False'], ['profile', 'None']],
  'helm.release_absent': [['namespace', 'None'], ['flags', 'None'], ['kvflags', 'None']],
  'helm.release_present': [['chart', 'chart'], ['values', 'None'], ['version', 'None'], ['namespace', 'None'], ['set', 'None'], ['flags', 'None'], ['kvflags', 'None']],
  'helm.repo_managed': [['present', 'None'], ['absent', 'None'], ['prune', 'False'], ['repo_update', 'False'], ['namespace', 'None'], ['flags', 'None'], ['kvflags', 'None']],
  'helm.repo_updated': [['namespace', 'None'], ['flags', 'None'], ['kvflags', 'None']],
  'hg.latest': [['rev', 'None'], ['target', 'None'], ['clean', 'False'], ['user', 'None'], ['identity', 'None'], ['force', 'False'], ['opts', 'False'], ['update_head', 'True']],
  'highstate_doc.note': [['source', 'None'], ['contents', 'None']],
  'host.absent': [['ip', 'ip']],
  'host.only': [['hostnames', 'hostnames']],
  'host.present': [['ip', 'ip'], ['comment', '\'\''], ['clean', 'False']],
  'http.query': [['match', 'None'], ['match_type', 'string'], ['status', 'None'], ['status_type', 'string'], ['wait_for', 'None']],
  'http.wait_for_successful_query': [['wait_for', '300']],
  'icinga2.generate_ticket': [['output', 'None'], ['grain', 'None'], ['key', 'None'], ['overwrite', 'True']],
  'icinga2.node_setup': [['master', 'master'], ['ticket', 'ticket']],
  'icinga2.request_cert': [['master', 'master'], ['ticket', 'ticket'], ['port', '5665']],
  'icinga2.save_cert': [['master', 'master']],
  'idem.state': [['sls', 'sls'], ['acct_file', 'None'], ['acct_key', 'None'], ['acct_profile', 'None'], ['cache_dir', 'None'], ['render', 'None'], ['runtime', 'None'], ['source_dir', 'None'], ['test', 'False']],
  'ifttt.trigger_event': [['event', 'event'], ['value1', 'None'], ['value2', 'None'], ['value3', 'None']],
  'incron.absent': [['path', 'path'], ['mask', 'mask'], ['cmd', 'cmd'], ['user', 'root']],
  'incron.present': [['path', 'path'], ['mask', 'mask'], ['cmd', 'cmd'], ['user', 'root']],
  'influxdb08_database.absent': [['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None']],
  'influxdb08_database.present': [['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None']],
  'influxdb08_user.absent': [['database', 'None'], ['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None']],
  'influxdb08_user.present': [['passwd', 'passwd'], ['database', 'None'], ['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None']],
  'influxdb_continuous_query.absent': [['database', 'database']],
  'influxdb_continuous_query.present': [['database', 'database'], ['query', 'query'], ['resample_time', 'None'], ['coverage_period', 'None']],
  'influxdb_retention_policy.absent': [['database', 'database']],
  'influxdb_retention_policy.present': [['database', 'database'], ['duration', '7d'], ['replication', '1'], ['default', 'False']],
  'influxdb_user.present': [['passwd', 'passwd'], ['admin', 'False'], ['grants', 'None']],
  'infoblox_a.absent': [['ipv4addr', 'None']],
  'infoblox_a.present': [['ipv4addr', 'None'], ['data', 'None'], ['ensure_data', 'True']],
  'infoblox_cname.absent': [['canonical', 'None']],
  'infoblox_cname.present': [['data', 'None'], ['ensure_data', 'True']],
  'infoblox_host_record.absent': [['ipv4addr', 'None'], ['mac', 'None']],
  'infoblox_host_record.present': [['data', 'None'], ['ensure_data', 'True']],
  'infoblox_range.absent': [['start_addr', 'None'], ['end_addr', 'None'], ['data', 'None']],
  'infoblox_range.present': [['start_addr', 'None'], ['end_addr', 'None'], ['data', 'None']],
  'ini.options_absent': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ini.options_present': [['sections', 'None'], ['separator', '='], ['strict', 'False'], ['encoding', 'None'], ['no_spaces', 'False']],
  'ini.sections_absent': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ini.sections_present': [['sections', 'None'], ['separator', '='], ['encoding', 'None']],
  'ipmi.power': [['wait', '300']],
  'ipmi.user_absent': [['channel', '14']],
  'ipmi.user_present': [['uid', 'uid'], ['password', 'password'], ['channel', '14'], ['callback', 'False'], ['link_auth', 'True'], ['ipmi_msg', 'True'], ['privilege_level', 'administrator']],
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
  'jboss7.bindings_exist': [['jboss_config', 'jboss_config'], ['bindings', 'bindings'], ['profile', 'None']],
  'jboss7.datasource_exists': [['jboss_config', 'jboss_config'], ['datasource_properties', 'datasource_properties'], ['recreate', 'False'], ['profile', 'None']],
  'jboss7.deployed': [['jboss_config', 'jboss_config'], ['salt_source', 'None']],
  'jboss7.reloaded': [['jboss_config', 'jboss_config'], ['timeout', '60'], ['interval', '5']],
  'jenkins.present': [['config', 'None']],
  'junos.diff': [['d_id', '0']],
  'junos.file_copy': [['dest', 'None']],
  'junos.get_table': [['table', 'table'], ['table_file', 'table_file']],
  'junos.rollback': [['d_id', 'd_id']],
  'junos.rpc': [['dest', 'None'], ['format', 'xml'], ['args', 'None']],
  'kapacitor.task_present': [['tick_script', 'tick_script'], ['task_type', 'stream'], ['database', 'None'], ['retention_policy', 'default'], ['enable', 'True'], ['dbrps', 'None']],
  'kernelpkg.latest_active': [['at_time', 'None']],
  'kernelpkg.latest_wait': [['at_time', 'None']],
  'keychain.default_keychain': [['domain', 'user'], ['user', 'None']],
  'keychain.installed': [['password', 'password'], ['keychain', '/Library/Keychains/System.keychain']],
  'keychain.uninstalled': [['password', 'password'], ['keychain', '/Library/Keychains/System.keychain'], ['keychain_password', 'None']],
  'keystone.endpoint_absent': [['region', 'None'], ['profile', 'None'], ['interface', 'None']],
  'keystone.endpoint_present': [['publicurl', 'None'], ['internalurl', 'None'], ['adminurl', 'None'], ['region', 'None'], ['profile', 'None'], ['url', 'None'], ['interface', 'None']],
  'keystone.project_absent': [['profile', 'None']],
  'keystone.project_present': [['description', 'None'], ['enabled', 'True'], ['profile', 'None']],
  'keystone.role_absent': [['profile', 'None']],
  'keystone.role_present': [['profile', 'None']],
  'keystone.service_absent': [['profile', 'None']],
  'keystone.service_present': [['service_type', 'service_type'], ['description', 'None'], ['profile', 'None']],
  'keystone.tenant_absent': [['profile', 'None']],
  'keystone.tenant_present': [['description', 'None'], ['enabled', 'True'], ['profile', 'None']],
  'keystone.user_absent': [['profile', 'None']],
  'keystone.user_present': [['password', 'password'], ['email', 'email'], ['tenant', 'None'], ['enabled', 'True'], ['roles', 'None'], ['profile', 'None'], ['password_reset', 'True'], ['project', 'None']],
  'keystone_domain.absent': [['auth', 'None']],
  'keystone_domain.present': [['auth', 'None']],
  'keystone_endpoint.absent': [['service_name', 'service_name'], ['auth', 'None']],
  'keystone_endpoint.present': [['service_name', 'service_name'], ['auth', 'None']],
  'keystone_group.absent': [['auth', 'None']],
  'keystone_group.present': [['auth', 'None']],
  'keystone_project.absent': [['auth', 'None']],
  'keystone_project.present': [['auth', 'None']],
  'keystone_role.absent': [['auth', 'None']],
  'keystone_role.present': [['auth', 'None']],
  'keystone_role_grant.absent': [['auth', 'None']],
  'keystone_role_grant.present': [['auth', 'None']],
  'keystone_service.absent': [['auth', 'None']],
  'keystone_service.present': [['auth', 'None']],
  'keystone_user.absent': [['auth', 'None']],
  'keystone_user.present': [['auth', 'None']],
  'keystore.managed': [['passphrase', 'passphrase'], ['entries', 'entries'], ['force_remove', 'False']],
  'kmod.absent': [['persist', 'False'], ['comment', 'True'], ['mods', 'None']],
  'kmod.present': [['persist', 'False'], ['mods', 'None']],
  'kubernetes.configmap_absent': [['namespace', 'default']],
  'kubernetes.configmap_present': [['namespace', 'default'], ['data', 'None'], ['source', 'None'], ['template', 'None']],
  'kubernetes.deployment_absent': [['namespace', 'default']],
  'kubernetes.deployment_present': [['namespace', 'default'], ['metadata', 'None'], ['spec', 'None'], ['source', '\'\''], ['template', '\'\'']],
  'kubernetes.node_label_absent': [['node', 'node']],
  'kubernetes.node_label_folder_absent': [['node', 'node']],
  'kubernetes.node_label_present': [['node', 'node'], ['value', 'value']],
  'kubernetes.pod_absent': [['namespace', 'default']],
  'kubernetes.pod_present': [['namespace', 'default'], ['metadata', 'None'], ['spec', 'None'], ['source', '\'\''], ['template', '\'\'']],
  'kubernetes.secret_absent': [['namespace', 'default']],
  'kubernetes.secret_present': [['namespace', 'default'], ['data', 'None'], ['source', 'None'], ['template', 'None']],
  'kubernetes.service_absent': [['namespace', 'default']],
  'kubernetes.service_present': [['namespace', 'default'], ['metadata', 'None'], ['spec', 'None'], ['source', '\'\''], ['template', '\'\'']],
  'ldap.managed': [['entries', 'entries'], ['connect_spec', 'None'], ['attrlist', 'None']],
  'lgpo.set': [['setting', 'None'], ['policy_class', 'None'], ['computer_policy', 'None'], ['user_policy', 'None'], ['cumulative_rights_assignments', 'True'], ['adml_language', 'en-US'], ['refresh_cache', 'False']],
  'lgpo_reg.value_absent': [['key', 'key'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'lgpo_reg.value_disabled': [['key', 'key'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'lgpo_reg.value_present': [['key', 'key'], ['v_data', 'v_data'], ['v_type', 'REG_DWORD'], ['policy_class', 'Machine'], ['write_registry', 'None'], ['refresh_policy', 'False']],
  'libcloud_dns.record_absent': [['zone', 'zone'], ['type', 'type'], ['data', 'data'], ['profile', 'profile']],
  'libcloud_dns.record_present': [['zone', 'zone'], ['type', 'type'], ['data', 'data'], ['profile', 'profile']],
  'libcloud_dns.state_result': [['result', 'result'], ['message', 'message'], ['changes', 'None']],
  'libcloud_loadbalancer.balancer_absent': [['profile', 'profile']],
  'libcloud_loadbalancer.balancer_present': [['port', 'port'], ['protocol', 'protocol'], ['profile', 'profile'], ['algorithm', 'None'], ['members', 'None']],
  'libcloud_loadbalancer.member_absent': [['ip', 'None'], ['port', 'None'], ['balancer_id', 'None'], ['profile', 'None']],
  'libcloud_loadbalancer.member_present': [['ip', 'None'], ['port', 'None'], ['balancer_id', 'None'], ['profile', 'None']],
  'libcloud_loadbalancer.state_result': [['result', 'result'], ['message', 'message'], ['changes', 'None']],
  'libcloud_storage.container_absent': [['profile', 'profile']],
  'libcloud_storage.container_present': [['profile', 'profile']],
  'libcloud_storage.file_present': [['container', 'container'], ['path', 'path'], ['profile', 'profile'], ['overwrite_existing', 'False']],
  'libcloud_storage.object_absent': [['container', 'container'], ['profile', 'profile']],
  'libcloud_storage.object_present': [['container', 'container'], ['path', 'path'], ['profile', 'profile']],
  'libcloud_storage.state_result': [['result', 'result'], ['message', 'message'], ['changes', 'changes']],
  'logadm.remove': [['log_file', 'None']],
  'logrotate.set': [['key', 'key'], ['value', 'value'], ['setting', 'None'], ['conf_file', '_DEFAULT_CONF']],
  'loop.until': [['m_args', 'None'], ['m_kwargs', 'None'], ['condition', 'None'], ['period', '1'], ['timeout', '60']],
  'loop.until_no_eval': [['expected', 'expected'], ['compare_operator', 'eq'], ['timeout', '60'], ['period', '1'], ['init_wait', '0'], ['args', 'None'], ['kwargs', 'None']],
  'lvm.lv_absent': [['vgname', 'None']],
  'lvm.lv_present': [['vgname', 'None'], ['size', 'None'], ['extents', 'None'], ['snapshot', 'None'], ['pv', '\'\''], ['thinvolume', 'False'], ['thinpool', 'False'], ['force', 'False'], ['resizefs', 'False']],
  'lvm.vg_present': [['devices', 'None']],
  'lvs_server.absent': [['protocol', 'None'], ['service_address', 'None'], ['server_address', 'None']],
  'lvs_server.present': [['protocol', 'None'], ['service_address', 'None'], ['server_address', 'None'], ['packet_forward_method', 'dr'], ['weight', '1']],
  'lvs_service.absent': [['protocol', 'None'], ['service_address', 'None']],
  'lvs_service.present': [['protocol', 'None'], ['service_address', 'None'], ['scheduler', 'wlc']],
  'lxc.absent': [['stop', 'False'], ['path', 'None']],
  'lxc.edited_conf': [['lxc_conf', 'None'], ['lxc_conf_unset', 'None']],
  'lxc.frozen': [['start', 'True'], ['path', 'None']],
  'lxc.present': [['running', 'None'], ['clone_from', 'None'], ['snapshot', 'False'], ['profile', 'None'], ['network_profile', 'None'], ['template', 'None'], ['options', 'None'], ['image', 'None'], ['config', 'None'], ['fstype', 'None'], ['size', 'None'], ['backing', 'None'], ['vgname', 'None'], ['lvname', 'None'], ['thinpool', 'None'], ['path', 'None']],
  'lxc.running': [['restart', 'False'], ['path', 'None']],
  'lxc.stopped': [['kill', 'False'], ['path', 'None']],
  'lxd.authenticate': [['remote_addr', 'remote_addr'], ['password', 'password'], ['cert', 'cert'], ['key', 'key'], ['verify_cert', 'True']],
  'lxd.config_managed': [['value', 'value'], ['force_password', 'False']],
  'lxd.init': [['storage_backend', 'dir'], ['trust_password', 'None'], ['network_address', 'None'], ['network_port', 'None'], ['storage_create_device', 'None'], ['storage_create_loop', 'None'], ['storage_pool', 'None'], ['done_file', '%SALT_CONFIG_DIR%/lxd_initialized']],
  'lxd_container.absent': [['stop', 'False'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_container.frozen': [['start', 'True'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_container.migrated': [['remote_addr', 'remote_addr'], ['cert', 'cert'], ['key', 'key'], ['verify_cert', 'verify_cert'], ['src_remote_addr', 'src_remote_addr'], ['stop_and_start', 'False'], ['src_cert', 'None'], ['src_key', 'None'], ['src_verify_cert', 'None']],
  'lxd_container.present': [['running', 'None'], ['source', 'None'], ['profiles', 'None'], ['config', 'None'], ['devices', 'None'], ['architecture', 'x86_64'], ['ephemeral', 'False'], ['restart_on_change', 'False'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_container.running': [['restart', 'False'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_container.stopped': [['kill', 'False'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_image.absent': [['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_image.present': [['source', 'source'], ['aliases', 'None'], ['public', 'None'], ['auto_update', 'None'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_profile.absent': [['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'lxd_profile.present': [['description', 'None'], ['config', 'None'], ['devices', 'None'], ['remote_addr', 'None'], ['cert', 'None'], ['key', 'None'], ['verify_cert', 'True']],
  'macdefaults.absent': [['domain', 'domain'], ['user', 'None']],
  'macdefaults.write': [['domain', 'domain'], ['value', 'value'], ['vtype', 'string'], ['user', 'None']],
  'macpackage.installed': [['target', 'LocalSystem'], ['dmg', 'False'], ['store', 'False'], ['app', 'False'], ['mpkg', 'False'], ['force', 'False'], ['allow_untrusted', 'False'], ['version_check', 'None']],
  'makeconf.present': [['value', 'None'], ['contains', 'None'], ['excludes', 'None']],
  'marathon_app.config': [['config', 'config']],
  'marathon_app.running': [['restart', 'False'], ['force', 'True']],
  'memcached.absent': [['value', 'None'], ['host', 'DEFAULT_HOST'], ['port', 'DEFAULT_PORT'], ['time', 'DEFAULT_TIME']],
  'memcached.managed': [['value', 'None'], ['host', 'DEFAULT_HOST'], ['port', 'DEFAULT_PORT'], ['time', 'DEFAULT_TIME'], ['min_compress_len', 'DEFAULT_MIN_COMPRESS_LEN']],
  'modjk.worker_activated': [['workers', 'None'], ['profile', 'default']],
  'modjk.worker_disabled': [['workers', 'None'], ['profile', 'default']],
  'modjk.worker_recover': [['workers', 'None'], ['profile', 'default']],
  'modjk.worker_stopped': [['workers', 'None'], ['profile', 'default']],
  'modjk_worker.activate': [['lbn', 'lbn'], ['target', 'target'], ['profile', 'default'], ['tgt_type', 'glob']],
  'modjk_worker.disable': [['lbn', 'lbn'], ['target', 'target'], ['profile', 'default'], ['tgt_type', 'glob']],
  'modjk_worker.stop': [['lbn', 'lbn'], ['target', 'target'], ['profile', 'default'], ['tgt_type', 'glob']],
  'mongodb_database.absent': [['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None'], ['authdb', 'None']],
  'mongodb_user.absent': [['user', 'None'], ['password', 'None'], ['host', 'None'], ['port', 'None'], ['database', 'admin'], ['authdb', 'None']],
  'mongodb_user.present': [['passwd', 'passwd'], ['database', 'admin'], ['user', 'None'], ['password', 'None'], ['host', 'localhost'], ['port', '27017'], ['authdb', 'None'], ['roles', 'None']],
  'mount.fstab_absent': [['fs_file', 'fs_file'], ['mount_by', 'None'], ['config', '/etc/fstab']],
  'mount.fstab_present': [['fs_file', 'fs_file'], ['fs_vfstype', 'fs_vfstype'], ['fs_mntops', 'defaults'], ['fs_freq', '0'], ['fs_passno', '0'], ['mount_by', 'None'], ['config', '/etc/fstab'], ['mount', 'True'], ['match_on', 'auto'], ['not_change', 'False'], ['fs_mount', 'True']],
  'mount.mounted': [['device', 'device'], ['fstype', 'fstype'], ['mkmnt', 'False'], ['opts', 'defaults'], ['dump', '0'], ['pass_num', '0'], ['config', '/etc/fstab'], ['persist', 'True'], ['mount', 'True'], ['user', 'None'], ['match_on', 'auto'], ['device_name_regex', 'None'], ['extra_mount_invisible_options', 'None'], ['extra_mount_invisible_keys', 'None'], ['extra_mount_ignore_fs_keys', 'None'], ['extra_mount_translate_options', 'None'], ['hidden_opts', 'None'], ['bind_mount_copy_active_opts', 'True']],
  'mount.swap': [['persist', 'True'], ['config', '/etc/fstab']],
  'mount.unmounted': [['device', 'None'], ['config', '/etc/fstab'], ['persist', 'False'], ['user', 'None']],
  'mssql_database.present': [['containment', 'NONE'], ['options', 'None']],
  'mssql_login.present': [['password', 'None'], ['domain', 'None'], ['server_roles', 'None'], ['options', 'None']],
  'mssql_role.present': [['owner', 'None'], ['grants', 'None']],
  'mssql_user.present': [['login', 'None'], ['domain', 'None'], ['database', 'None'], ['roles', 'None'], ['options', 'None']],
  'msteams.post_card': [['message', 'message'], ['hook_url', 'None'], ['title', 'None'], ['theme_color', 'None']],
  'mysql_database.present': [['character_set', 'None'], ['collate', 'None']],
  'mysql_grants.absent': [['grant', 'None'], ['database', 'None'], ['user', 'None'], ['host', 'localhost'], ['grant_option', 'False'], ['escape', 'True']],
  'mysql_grants.present': [['grant', 'None'], ['database', 'None'], ['user', 'None'], ['host', 'localhost'], ['grant_option', 'False'], ['escape', 'True'], ['revoke_first', 'False'], ['ssl_option', 'False']],
  'mysql_query.run': [['database', 'database'], ['query', 'query'], ['output', 'None'], ['grain', 'None'], ['key', 'None'], ['overwrite', 'True'], ['check_db_exists', 'True'], ['client_flags', 'None']],
  'mysql_query.run_file': [['database', 'database'], ['query_file', 'None'], ['output', 'None'], ['grain', 'None'], ['key', 'None'], ['overwrite', 'True'], ['saltenv', 'None'], ['check_db_exists', 'True'], ['client_flags', 'None']],
  'mysql_user.absent': [['host', 'localhost']],
  'mysql_user.present': [['host', 'localhost'], ['password', 'None'], ['password_hash', 'None'], ['allow_passwordless', 'False'], ['unix_socket', 'False'], ['password_column', 'None'], ['auth_plugin', 'mysql_native_password']],
  'napalm_yang.configured': [['data', 'data']],
  'napalm_yang.managed': [['data', 'data']],
  'netacl.filter': [['filter_name', 'filter_name'], ['filter_options', 'None'], ['terms', 'None'], ['prepend', 'True'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['only_lower_merge', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False']],
  'netacl.managed': [['filters', 'None'], ['prepend', 'True'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['only_lower_merge', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False']],
  'netacl.term': [['filter_name', 'filter_name'], ['term_name', 'term_name'], ['filter_options', 'None'], ['pillar_key', 'acl'], ['pillarenv', 'None'], ['saltenv', 'None'], ['merge_pillar', 'False'], ['revision_id', 'None'], ['revision_no', 'None'], ['revision_date', 'True'], ['revision_date_format', '%Y/%m/%d'], ['test', 'False'], ['commit', 'True'], ['debug', 'False'], ['source_service', 'None'], ['destination_service', 'None']],
  'netconfig.managed': [['template_name', 'None'], ['template_source', 'None'], ['template_hash', 'None'], ['template_hash_name', 'None'], ['saltenv', 'base'], ['template_engine', 'jinja'], ['skip_verify', 'False'], ['context', 'None'], ['defaults', 'None'], ['test', 'False'], ['commit', 'True'], ['debug', 'False'], ['replace', 'False'], ['commit_in', 'None'], ['commit_at', 'None'], ['revert_in', 'None'], ['revert_at', 'None']],
  'netconfig.replace_pattern': [['pattern', 'pattern'], ['repl', 'repl'], ['count', '0'], ['flags', '8'], ['bufsize', '1'], ['append_if_not_found', 'False'], ['prepend_if_not_found', 'False'], ['not_found_content', 'None'], ['search_only', 'False'], ['show_changes', 'True'], ['backslash_literal', 'False'], ['source', 'running'], ['path', 'None'], ['test', 'False'], ['replace', 'True'], ['debug', 'False'], ['commit', 'True']],
  'netconfig.saved': [['source', 'running'], ['user', 'None'], ['group', 'None'], ['mode', 'None'], ['attrs', 'None'], ['makedirs', 'False'], ['dir_mode', 'None'], ['replace', 'True'], ['backup', '\'\''], ['show_changes', 'True'], ['create', 'True'], ['tmp_dir', '\'\''], ['tmp_ext', '\'\''], ['encoding', 'None'], ['encoding_errors', 'strict'], ['allow_empty', 'False'], ['follow_symlinks', 'True'], ['check_cmd', 'None'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'netntp.managed': [['peers', 'None'], ['servers', 'None']],
  'netsnmp.managed': [['config', 'None'], ['defaults', 'None']],
  'netusers.managed': [['users', 'None'], ['defaults', 'None']],
  'network.managed': [['dns_proto', 'None'], ['dns_servers', 'None'], ['ip_proto', 'None'], ['ip_addrs', 'None'], ['gateway', 'None'], ['enabled', 'True']],
  'neutron_network.absent': [['auth', 'None']],
  'neutron_network.present': [['auth', 'None']],
  'neutron_secgroup.absent': [['auth', 'None']],
  'neutron_secgroup.present': [['auth', 'None']],
  'neutron_secgroup_rule.absent': [['auth', 'None']],
  'neutron_secgroup_rule.present': [['auth', 'None']],
  'neutron_subnet.absent': [['auth', 'None']],
  'neutron_subnet.present': [['auth', 'None']],
  'nexus.downloaded': [['artifact', 'artifact'], ['target_dir', '/tmp'], ['target_file', 'None']],
  'nfs_export.absent': [['exports', '/etc/exports']],
  'nfs_export.present': [['clients', 'None'], ['hosts', 'None'], ['options', 'None'], ['exports', '/etc/exports']],
  'nftables.append': [['family', 'ipv4']],
  'nftables.chain_absent': [['table', 'filter'], ['family', 'ipv4']],
  'nftables.chain_present': [['table', 'filter'], ['table_type', 'None'], ['hook', 'None'], ['priority', 'None'], ['family', 'ipv4']],
  'nftables.delete': [['family', 'ipv4']],
  'nftables.flush': [['family', 'ipv4'], ['ignore_absence', 'False']],
  'nftables.insert': [['family', 'ipv4']],
  'nftables.set_policy': [['table', 'filter'], ['family', 'ipv4']],
  'nftables.table_absent': [['family', 'ipv4']],
  'nftables.table_present': [['family', 'ipv4']],
  'npm.bootstrap': [['user', 'None'], ['silent', 'True']],
  'npm.cache_cleaned': [['user', 'None'], ['force', 'False']],
  'npm.installed': [['pkgs', 'None'], ['dir', 'None'], ['user', 'None'], ['force_reinstall', 'False'], ['registry', 'None'], ['env', 'None']],
  'npm.removed': [['dir', 'None'], ['user', 'None']],
  'ntp.managed': [['servers', 'None']],
  'nxos.image_running': [['system_image', 'system_image'], ['kickstart_image', 'None'], ['issu', 'True']],
  'nxos.replace': [['repl', 'repl'], ['full_match', 'False']],
  'nxos.user_present': [['password', 'None'], ['roles', 'None'], ['encrypted', 'False'], ['crypt_salt', 'None'], ['algorithm', 'sha256']],
  'openstack_config.absent': [['filename', 'filename'], ['section', 'section'], ['parameter', 'None']],
  'openstack_config.present': [['filename', 'filename'], ['section', 'section'], ['value', 'value'], ['parameter', 'None']],
  'openvswitch_bridge.present': [['parent', 'None'], ['vlan', 'None']],
  'openvswitch_db.managed': [['table', 'table'], ['data', 'data'], ['record', 'None']],
  'openvswitch_port.absent': [['bridge', 'None']],
  'openvswitch_port.present': [['bridge', 'bridge'], ['tunnel_type', 'None'], ['id', 'None'], ['remote', 'None'], ['dst_port', 'None'], ['internal', 'False']],
  'opsgenie.close_alert': [['api_key', 'None'], ['reason', 'Conditions are met.'], ['action_type', 'Close']],
  'opsgenie.create_alert': [['api_key', 'None'], ['reason', 'None'], ['action_type', 'Create']],
  'pagerduty.create_event': [['details', 'details'], ['service_key', 'service_key'], ['profile', 'profile']],
  'pagerduty_escalation_policy.absent': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_escalation_policy.present': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_schedule.absent': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_schedule.present': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_service.absent': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_service.present': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_user.absent': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'pagerduty_user.present': [['profile', '\'pagerduty\''], ['subdomain', 'None'], ['api_key', 'None']],
  'panos.address_exists': [['addressname', 'None'], ['vsys', '1'], ['ipnetmask', 'None'], ['iprange', 'None'], ['fqdn', 'None'], ['description', 'None'], ['commit', 'False']],
  'panos.address_group_exists': [['groupname', 'None'], ['vsys', '1'], ['members', 'None'], ['description', 'None'], ['commit', 'False']],
  'panos.clone_config': [['xpath', 'None'], ['newname', 'None'], ['commit', 'False']],
  'panos.delete_config': [['xpath', 'None'], ['commit', 'False']],
  'panos.download_software': [['version', 'None'], ['synch', 'False'], ['check', 'False']],
  'panos.edit_config': [['xpath', 'None'], ['value', 'None'], ['commit', 'False']],
  'panos.move_config': [['xpath', 'None'], ['where', 'None'], ['dst', 'None'], ['commit', 'False']],
  'panos.rename_config': [['xpath', 'None'], ['newname', 'None'], ['commit', 'False']],
  'panos.security_rule_exists': [['rulename', 'None'], ['vsys', '1'], ['action', 'None'], ['disabled', 'None'], ['sourcezone', 'None'], ['destinationzone', 'None'], ['source', 'None'], ['destination', 'None'], ['application', 'None'], ['service', 'None'], ['description', 'None'], ['logsetting', 'None'], ['logstart', 'None'], ['logend', 'None'], ['negatesource', 'None'], ['negatedestination', 'None'], ['profilegroup', 'None'], ['datafilter', 'None'], ['fileblock', 'None'], ['spyware', 'None'], ['urlfilter', 'None'], ['virus', 'None'], ['vulnerability', 'None'], ['wildfire', 'None'], ['move', 'None'], ['movetarget', 'None'], ['commit', 'False']],
  'panos.service_exists': [['servicename', 'None'], ['vsys', '1'], ['protocol', 'None'], ['port', 'None'], ['description', 'None'], ['commit', 'False']],
  'panos.service_group_exists': [['groupname', 'None'], ['vsys', '1'], ['members', 'None'], ['description', 'None'], ['commit', 'False']],
  'panos.set_config': [['xpath', 'None'], ['value', 'None'], ['commit', 'False']],
  'pbm.default_storage_policy_assigned': [['policy', 'policy'], ['datastore', 'datastore']],
  'pbm.default_vsan_policy_configured': [['policy', 'policy']],
  'pbm.storage_policies_configured': [['policies', 'policies']],
  'pcs.auth': [['nodes', 'nodes'], ['pcsuser', 'hacluster'], ['pcspasswd', 'hacluster'], ['extra_args', 'None']],
  'pcs.cib_present': [['cibname', 'cibname'], ['scope', 'None'], ['extra_args', 'None']],
  'pcs.cib_pushed': [['cibname', 'cibname'], ['scope', 'None'], ['extra_args', 'None']],
  'pcs.cluster_node_present': [['node', 'node'], ['extra_args', 'None']],
  'pcs.cluster_setup': [['nodes', 'nodes'], ['pcsclustername', 'pcscluster'], ['extra_args', 'None'], ['pcsuser', 'hacluster'], ['pcspasswd', 'hacluster'], ['pcs_auth_extra_args', 'None'], ['wipe_default', 'False']],
  'pcs.constraint_present': [['constraint_id', 'constraint_id'], ['constraint_type', 'constraint_type'], ['constraint_options', 'None'], ['cibname', 'None']],
  'pcs.prop_has_value': [['prop', 'prop'], ['value', 'value'], ['extra_args', 'None'], ['cibname', 'None']],
  'pcs.resource_defaults_to': [['default', 'default'], ['value', 'value'], ['extra_args', 'None'], ['cibname', 'None']],
  'pcs.resource_op_defaults_to': [['op_default', 'op_default'], ['value', 'value'], ['extra_args', 'None'], ['cibname', 'None']],
  'pcs.resource_present': [['resource_id', 'resource_id'], ['resource_type', 'resource_type'], ['resource_options', 'None'], ['cibname', 'None']],
  'pcs.stonith_present': [['stonith_id', 'stonith_id'], ['stonith_device_type', 'stonith_device_type'], ['stonith_device_options', 'None'], ['cibname', 'None']],
  'pecl.installed': [['version', 'None'], ['defaults', 'False'], ['force', 'False'], ['preferred_state', 'stable']],
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
  'portage_config.flags': [['use', 'None'], ['accept_keywords', 'None'], ['env', 'None'], ['license', 'None'], ['properties', 'None'], ['unmask', 'False'], ['mask', 'False']],
  'ports.installed': [['options', 'None']],
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
  'probes.managed': [['probes', 'probes'], ['defaults', 'None']],
  'process.absent': [['user', 'None'], ['signal', 'None']],
  'proxy.managed': [['port', 'port'], ['services', 'None'], ['user', 'None'], ['password', 'None'], ['bypass_domains', 'None'], ['network_service', 'Ethernet']],
  'pushover.post_message': [['user', 'None'], ['device', 'None'], ['message', 'None'], ['title', 'None'], ['priority', 'None'], ['expire', 'None'], ['retry', 'None'], ['sound', 'None'], ['api_version', '1'], ['token', 'None']],
  'pyenv.absent': [['user', 'None']],
  'pyenv.install_pyenv': [['user', 'None']],
  'pyenv.installed': [['default', 'False'], ['user', 'None']],
  'pyrax_queues.absent': [['provider', 'provider']],
  'pyrax_queues.present': [['provider', 'provider']],
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
  'rbac.managed': [['roles', 'None'], ['profiles', 'None'], ['authorizations', 'None']],
  'rbenv.absent': [['user', 'None']],
  'rbenv.install_rbenv': [['user', 'None']],
  'rbenv.installed': [['default', 'False'], ['user', 'None']],
  'redis.absent': [['keys', 'None']],
  'redis.slaveof': [['sentinel_host', 'None'], ['sentinel_port', 'None'], ['sentinel_password', 'None']],
  'redis.string': [['value', 'value'], ['expire', 'None'], ['expireat', 'None']],
  'reg.absent': [['vname', 'None'], ['use_32bit_registry', 'False']],
  'reg.key_absent': [['use_32bit_registry', 'False']],
  'reg.present': [['vname', 'None'], ['vdata', 'None'], ['vtype', 'REG_SZ'], ['use_32bit_registry', 'False'], ['win_owner', 'None'], ['win_perms', 'None'], ['win_deny_perms', 'None'], ['win_inheritance', 'True'], ['win_perms_reset', 'False']],
  'restconf.config_manage': [['path', 'path'], ['method', 'method'], ['config', 'config'], ['init_path', 'None'], ['init_method', 'PATCH'], ['init_config', 'None']],
  'rsync.synchronized': [['source', 'source'], ['delete', 'False'], ['force', 'False'], ['update', 'False'], ['passwordfile', 'None'], ['exclude', 'None'], ['excludefrom', 'None'], ['prepare', 'False'], ['dryrun', 'False'], ['additional_opts', 'None']],
  'rvm.gemset_present': [['ruby', 'default'], ['user', 'None']],
  'rvm.installed': [['default', 'False'], ['user', 'None'], ['opts', 'None'], ['env', 'None']],
  'salt.function': [['tgt', 'tgt'], ['ssh', 'False'], ['tgt_type', 'glob'], ['ret', '\'\''], ['ret_config', 'None'], ['ret_kwargs', 'None'], ['expect_minions', 'False'], ['fail_minions', 'None'], ['fail_function', 'None'], ['arg', 'None'], ['kwarg', 'None'], ['timeout', 'None'], ['batch', 'None'], ['subset', 'None'], ['failhard', 'None']],
  'salt.parallel_runners': [['runners', 'runners']],
  'salt.state': [['tgt', 'tgt'], ['ssh', 'False'], ['tgt_type', 'glob'], ['ret', '\'\''], ['ret_config', 'None'], ['ret_kwargs', 'None'], ['highstate', 'None'], ['sls', 'None'], ['top', 'None'], ['saltenv', 'None'], ['test', 'None'], ['pillar', 'None'], ['pillarenv', 'None'], ['expect_minions', 'True'], ['exclude', 'None'], ['fail_minions', 'None'], ['allow_fail', '0'], ['concurrent', 'False'], ['timeout', 'None'], ['batch', 'None'], ['queue', 'False'], ['subset', 'None'], ['orchestration_jid', 'None'], ['failhard', 'None']],
  'salt.wait_for_event': [['id_list', 'id_list'], ['event_id', 'id'], ['timeout', '300'], ['node', 'master']],
  'salt_proxy.configure_proxy': [['proxyname', 'p8000'], ['start', 'True']],
  'selinux.boolean': [['value', 'value'], ['persist', 'False']],
  'selinux.fcontext_policy_absent': [['filetype', 'a'], ['sel_type', 'None'], ['sel_user', 'None'], ['sel_level', 'None']],
  'selinux.fcontext_policy_applied': [['recursive', 'False']],
  'selinux.fcontext_policy_present': [['sel_type', 'sel_type'], ['filetype', 'a'], ['sel_user', 'None'], ['sel_level', 'None']],
  'selinux.module': [['module_state', 'Enabled'], ['version', 'any']],
  'selinux.port_policy_absent': [['sel_type', 'None'], ['protocol', 'None'], ['port', 'None']],
  'selinux.port_policy_present': [['sel_type', 'sel_type'], ['protocol', 'None'], ['port', 'None'], ['sel_range', 'None']],
  'serverdensity_device.monitored': [['group', 'None'], ['salt_name', 'True'], ['salt_params', 'True'], ['agent_version', '1']],
  'service.dead': [['enable', 'None'], ['sig', 'None'], ['init_delay', 'None']],
  'service.masked': [['runtime', 'False']],
  'service.running': [['enable', 'None'], ['sig', 'None'], ['init_delay', 'None']],
  'service.unmasked': [['runtime', 'False']],
  'shortcut.present': [['arguments', '\'\''], ['description', '\'\''], ['hot_key', '\'\''], ['icon_location', '\'\''], ['icon_index', '0'], ['target', '\'\''], ['window_style', 'Normal'], ['working_dir', '\'\''], ['backup', 'False'], ['force', 'False'], ['make_dirs', 'False'], ['user', 'None']],
  'smartos.config_present': [['value', 'value']],
  'smartos.source_present': [['source_type', 'imgapi']],
  'smartos.vm_absent': [['archive', 'False']],
  'smartos.vm_present': [['vmconfig', 'vmconfig'], ['config', 'None']],
  'smtp.send_msg': [['recipient', 'recipient'], ['subject', 'subject'], ['sender', 'None'], ['profile', 'None'], ['use_ssl', 'True'], ['attachments', 'None']],
  'snapper.baseline_snapshot': [['number', 'None'], ['tag', 'None'], ['include_diff', 'True'], ['config', 'root'], ['ignore', 'None']],
  'solrcloud.alias': [['collections', 'collections']],
  'solrcloud.collection': [['options', 'None']],
  'splunk.absent': [['email', 'email'], ['profile', '\'splunk\'']],
  'splunk.present': [['email', 'email'], ['profile', '\'splunk\'']],
  'splunk_search.absent': [['profile', 'splunk']],
  'splunk_search.present': [['profile', 'splunk']],
  'sqlite3.row_absent': [['db', 'db'], ['table', 'table'], ['where_sql', 'where_sql'], ['where_args', 'None']],
  'sqlite3.row_present': [['db', 'db'], ['table', 'table'], ['data', 'data'], ['where_sql', 'where_sql'], ['where_args', 'None'], ['update', 'False']],
  'sqlite3.table_absent': [['db', 'db']],
  'sqlite3.table_present': [['db', 'db'], ['schema', 'schema'], ['force', 'False']],
  'ssh_auth.absent': [['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_auth.manage': [['ssh_keys', 'ssh_keys'], ['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_auth.present': [['user', 'user'], ['enc', 'ssh-rsa'], ['comment', '\'\''], ['source', '\'\''], ['options', 'None'], ['config', '.ssh/authorized_keys'], ['fingerprint_hash_type', 'None']],
  'ssh_known_hosts.absent': [['user', 'None'], ['config', 'None']],
  'ssh_known_hosts.present': [['user', 'None'], ['fingerprint', 'None'], ['key', 'None'], ['port', 'None'], ['enc', 'None'], ['config', 'None'], ['hash_known_hosts', 'True'], ['timeout', '5'], ['fingerprint_hash_type', 'None']],
  'status.loadavg': [['maximum', 'None'], ['minimum', 'None']],
  'statuspage.create': [['endpoint', 'incidents'], ['api_url', 'None'], ['page_id', 'None'], ['api_key', 'None'], ['api_version', 'None']],
  'statuspage.delete': [['endpoint', 'incidents'], ['id', 'None'], ['api_url', 'None'], ['page_id', 'None'], ['api_key', 'None'], ['api_version', 'None']],
  'statuspage.managed': [['config', 'config'], ['api_url', 'None'], ['page_id', 'None'], ['api_key', 'None'], ['api_version', 'None'], ['pace', '_PACE'], ['allow_empty', 'False']],
  'statuspage.update': [['endpoint', 'incidents'], ['id', 'None'], ['api_url', 'None'], ['page_id', 'None'], ['api_key', 'None'], ['api_version', 'None']],
  'supervisord.dead': [['user', 'None'], ['conf_file', 'None'], ['bin_env', 'None']],
  'supervisord.running': [['restart', 'False'], ['update', 'False'], ['user', 'None'], ['conf_file', 'None'], ['bin_env', 'None']],
  'svn.dirty': [['target', 'target'], ['user', 'None'], ['username', 'None'], ['password', 'None'], ['ignore_unversioned', 'False']],
  'svn.export': [['target', 'None'], ['rev', 'None'], ['user', 'None'], ['username', 'None'], ['password', 'None'], ['force', 'False'], ['overwrite', 'False'], ['externals', 'True'], ['trust', 'False'], ['trust_failures', 'None']],
  'svn.latest': [['target', 'None'], ['rev', 'None'], ['user', 'None'], ['username', 'None'], ['password', 'None'], ['force', 'False'], ['externals', 'True'], ['trust', 'False'], ['trust_failures', 'None']],
  'sysctl.present': [['value', 'value'], ['config', 'None']],
  'sysfs.present': [['value', 'value'], ['config', 'None']],
  'syslog_ng.config': [['config', 'config'], ['write', 'True']],
  'syslog_ng.started': [['user', 'None'], ['group', 'None'], ['chroot', 'None'], ['caps', 'None'], ['no_caps', 'False'], ['pidfile', 'None'], ['enable_core', 'False'], ['fd_limit', 'None'], ['verbose', 'False'], ['debug', 'False'], ['trace', 'False'], ['yydebug', 'False'], ['persist_file', 'None'], ['control', 'None'], ['worker_threads', 'None']],
  'sysrc.managed': [['value', 'value']],
  'system.join_domain': [['username', 'None'], ['password', 'None'], ['account_ou', 'None'], ['account_exists', 'False'], ['restart', 'False']],
  'system.reboot': [['message', 'None'], ['timeout', '5'], ['force_close', 'True'], ['in_seconds', 'False'], ['only_on_pending_reboot', 'True']],
  'system.shutdown': [['message', 'None'], ['timeout', '5'], ['force_close', 'True'], ['reboot', 'False'], ['in_seconds', 'False'], ['only_on_pending_reboot', 'False']],
  'telemetry_alert.absent': [['deployment_id', 'deployment_id'], ['metric_name', 'metric_name'], ['api_key', 'None'], ['profile', 'telemetry']],
  'telemetry_alert.present': [['deployment_id', 'deployment_id'], ['metric_name', 'metric_name'], ['alert_config', 'alert_config'], ['api_key', 'None'], ['profile', 'telemetry']],
  'test.check_pillar': [['present', 'None'], ['boolean', 'None'], ['integer', 'None'], ['string', 'None'], ['listing', 'None'], ['dictionary', 'None'], ['verbose', 'False']],
  'test.configurable_test_state': [['changes', 'True'], ['result', 'True'], ['comment', '\'\''], ['warnings', 'None']],
  'test.show_notification': [['text', 'None']],
  'timezone.system': [['utc', 'True']],
  'tls.valid_certificate': [['weeks', '0'], ['days', '0'], ['hours', '0'], ['minutes', '0'], ['seconds', '0']],
  'tomcat.undeployed': [['url', 'http://localhost:8080/manager'], ['timeout', '180']],
  'tomcat.wait': [['url', 'http://localhost:8080/manager'], ['timeout', '180']],
  'tomcat.war_deployed': [['war', 'war'], ['force', 'False'], ['url', 'http://localhost:8080/manager'], ['timeout', '180'], ['temp_war_location', 'None'], ['version', 'True']],
  'trafficserver.bounce_local': [['drain', 'False']],
  'trafficserver.config': [['value', 'value']],
  'trafficserver.offline': [['path', 'path']],
  'trafficserver.restart_local': [['drain', 'False']],
  'user.absent': [['purge', 'False'], ['force', 'False']],
  'user.present': [['uid', 'None'], ['gid', 'None'], ['usergroup', 'None'], ['groups', 'None'], ['optional_groups', 'None'], ['remove_groups', 'True'], ['home', 'None'], ['createhome', 'True'], ['persist_home', 'False'], ['password', 'None'], ['hash_password', 'False'], ['enforce_password', 'True'], ['empty_password', 'False'], ['shell', 'None'], ['unique', 'True'], ['system', 'False'], ['fullname', 'None'], ['roomnumber', 'None'], ['workphone', 'None'], ['homephone', 'None'], ['other', 'None'], ['loginclass', 'None'], ['date', 'None'], ['mindays', 'None'], ['maxdays', 'None'], ['inactdays', 'None'], ['warndays', 'None'], ['expire', 'None'], ['win_homedrive', 'None'], ['win_profile', 'None'], ['win_logonscript', 'None'], ['win_description', 'None'], ['nologinit', 'False'], ['allow_uid_change', 'False'], ['allow_gid_change', 'False'], ['password_lock', 'None']],
  'vault.policy_present': [['rules', 'rules']],
  'vbox_guest.additions_installed': [['reboot', 'False'], ['upgrade_os', 'False']],
  'vbox_guest.additions_removed': [['force', 'False']],
  'vbox_guest.grant_access_to_shared_folders_to': [['users', 'None']],
  'victorops.create_event': [['message_type', 'message_type'], ['routing_key', 'everyone']],
  'virt.defined': [['cpu', 'None'], ['mem', 'None'], ['vm_type', 'None'], ['disk_profile', 'None'], ['disks', 'None'], ['nic_profile', 'None'], ['interfaces', 'None'], ['graphics', 'None'], ['seed', 'True'], ['install', 'True'], ['pub_key', 'None'], ['priv_key', 'None'], ['connection', 'None'], ['username', 'None'], ['password', 'None'], ['os_type', 'None'], ['arch', 'None'], ['boot', 'None'], ['numatune', 'None'], ['boot_dev', 'None'], ['hypervisor_features', 'None'], ['clock', 'None'], ['serials', 'None'], ['consoles', 'None'], ['stop_on_reboot', 'False'], ['live', 'True'], ['host_devices', 'None'], ['autostart', 'False']],
  'virt.keys': [['basepath', '/etc/pki']],
  'virt.network_defined': [['bridge', 'bridge'], ['forward', 'forward'], ['vport', 'None'], ['tag', 'None'], ['ipv4_config', 'None'], ['ipv6_config', 'None'], ['autostart', 'True'], ['connection', 'None'], ['username', 'None'], ['password', 'None'], ['mtu', 'None'], ['domain', 'None'], ['nat', 'None'], ['interfaces', 'None'], ['addresses', 'None'], ['physical_function', 'None'], ['dns', 'None']],
  'virt.network_running': [['bridge', 'bridge'], ['forward', 'forward'], ['vport', 'None'], ['tag', 'None'], ['ipv4_config', 'None'], ['ipv6_config', 'None'], ['autostart', 'True'], ['connection', 'None'], ['username', 'None'], ['password', 'None'], ['mtu', 'None'], ['domain', 'None'], ['nat', 'None'], ['interfaces', 'None'], ['addresses', 'None'], ['physical_function', 'None'], ['dns', 'None']],
  'virt.pool_defined': [['ptype', 'None'], ['target', 'None'], ['permissions', 'None'], ['source', 'None'], ['transient', 'False'], ['autostart', 'True'], ['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.pool_deleted': [['purge', 'False'], ['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.pool_running': [['ptype', 'None'], ['target', 'None'], ['permissions', 'None'], ['source', 'None'], ['transient', 'False'], ['autostart', 'True'], ['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.powered_off': [['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.rebooted': [['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.reverted': [['snapshot', 'None'], ['cleanup', 'False']],
  'virt.running': [['cpu', 'None'], ['mem', 'None'], ['vm_type', 'None'], ['disk_profile', 'None'], ['disks', 'None'], ['nic_profile', 'None'], ['interfaces', 'None'], ['graphics', 'None'], ['seed', 'True'], ['install', 'True'], ['pub_key', 'None'], ['priv_key', 'None'], ['connection', 'None'], ['username', 'None'], ['password', 'None'], ['os_type', 'None'], ['arch', 'None'], ['boot', 'None'], ['boot_dev', 'None'], ['numatune', 'None'], ['hypervisor_features', 'None'], ['clock', 'None'], ['serials', 'None'], ['consoles', 'None'], ['stop_on_reboot', 'False'], ['host_devices', 'None'], ['autostart', 'False']],
  'virt.saved': [['suffix', 'None']],
  'virt.snapshot': [['suffix', 'None'], ['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.stopped': [['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virt.volume_defined': [['pool', 'pool'], ['size', 'size'], ['allocation', '0'], ['format', 'None'], ['type', 'None'], ['permissions', 'None'], ['backing_store', 'None'], ['nocow', 'False'], ['connection', 'None'], ['username', 'None'], ['password', 'None']],
  'virtualenv.managed': [['venv_bin', 'None'], ['requirements', 'None'], ['system_site_packages', 'False'], ['distribute', 'False'], ['use_wheel', 'False'], ['clear', 'False'], ['python', 'None'], ['extra_search_dir', 'None'], ['never_download', 'None'], ['prompt', 'None'], ['user', 'None'], ['cwd', 'None'], ['index_url', 'None'], ['extra_index_url', 'None'], ['pre_releases', 'False'], ['no_deps', 'False'], ['pip_download', 'None'], ['pip_download_cache', 'None'], ['pip_exists_action', 'None'], ['pip_ignore_installed', 'False'], ['proxy', 'None'], ['use_vt', 'False'], ['env_vars', 'None'], ['no_use_wheel', 'False'], ['pip_upgrade', 'False'], ['pip_pkgs', 'None'], ['pip_no_cache_dir', 'False'], ['pip_cache_dir', 'None'], ['process_dependency_links', 'False'], ['no_binary', 'None']],
  'webutil.user_absent': [['htpasswd_file', 'None'], ['runas', 'None']],
  'webutil.user_exists': [['password', 'None'], ['htpasswd_file', 'None'], ['options', '\'\''], ['force', 'False'], ['runas', 'None'], ['update', 'False']],
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
  'wordpress.activated': [['path', 'path'], ['user', 'user']],
  'wordpress.deactivated': [['path', 'path'], ['user', 'user']],
  'wordpress.installed': [['user', 'user'], ['admin_user', 'admin_user'], ['admin_password', 'admin_password'], ['admin_email', 'admin_email'], ['title', 'title'], ['url', 'url']],
  'wua.installed': [['updates', 'None']],
  'wua.removed': [['updates', 'None']],
  'wua.uptodate': [['software', 'True'], ['drivers', 'False'], ['skip_hidden', 'False'], ['skip_mandatory', 'False'], ['skip_reboot', 'True'], ['categories', 'None'], ['severities', 'None']],
  'wusa.installed': [['source', 'source']],
  'x509.certificate_managed': [['days_remaining', '90'], ['append_certs', 'None']],
  'x509.crl_managed': [['signing_private_key', 'signing_private_key'], ['signing_private_key_passphrase', 'None'], ['signing_cert', 'None'], ['revoked', 'None'], ['days_valid', '100'], ['digest', '\'\''], ['days_remaining', '30'], ['include_expired', 'False']],
  'x509.pem_managed': [['text', 'text'], ['backup', 'False']],
  'x509.private_key_managed': [['bits', '2048'], ['passphrase', 'None'], ['cipher', 'aes_128_cbc'], ['new', 'False'], ['overwrite', 'False'], ['verbose', 'True']],
  'x509_v2.certificate_managed': [['days_remaining', 'None'], ['ca_server', 'None'], ['signing_policy', 'None'], ['encoding', 'pem'], ['append_certs', 'None'], ['digest', 'sha256'], ['signing_private_key', 'None'], ['signing_private_key_passphrase', 'None'], ['signing_cert', 'None'], ['public_key', 'None'], ['private_key', 'None'], ['private_key_passphrase', 'None'], ['csr', 'None'], ['subject', 'None'], ['serial_number', 'None'], ['not_before', 'None'], ['not_after', 'None'], ['days_valid', 'None'], ['pkcs12_passphrase', 'None'], ['pkcs12_encryption_compat', 'False'], ['pkcs12_friendlyname', 'None']],
  'x509_v2.crl_managed': [['signing_private_key', 'signing_private_key'], ['revoked', 'revoked'], ['days_remaining', 'None'], ['signing_cert', 'None'], ['signing_private_key_passphrase', 'None'], ['include_expired', 'False'], ['days_valid', 'None'], ['digest', 'sha256'], ['encoding', 'pem'], ['extensions', 'None']],
  'x509_v2.csr_managed': [['private_key', 'private_key'], ['private_key_passphrase', 'None'], ['digest', 'sha256'], ['encoding', 'pem'], ['subject', 'None']],
  'x509_v2.pem_managed': [['text', 'text']],
  'x509_v2.private_key_managed': [['algo', 'rsa'], ['keysize', 'None'], ['passphrase', 'None'], ['encoding', 'pem'], ['new', 'False'], ['overwrite', 'False'], ['pkcs12_encryption_compat', 'False']],
  'xattr.delete': [['attributes', 'attributes']],
  'xattr.exists': [['attributes', 'attributes']],
  'xml.value_present': [['xpath', 'xpath'], ['value', 'value']],
  'xmpp.send_msg': [['recipient', 'recipient'], ['profile', 'profile']],
  'xmpp.send_msg_multi': [['profile', 'profile'], ['recipients', 'None'], ['rooms', 'None']],
  'zabbix_action.present': [['params', 'params']],
  'zabbix_host.assign_templates': [['host', 'host'], ['templates', 'templates']],
  'zabbix_host.present': [['host', 'host'], ['groups', 'groups'], ['interfaces', 'interfaces']],
  'zabbix_mediatype.present': [['mediatype', 'mediatype']],
  'zabbix_template.present': [['params', 'params'], ['static_host_list', 'True']],
  'zabbix_user.admin_password_present': [['password', 'None']],
  'zabbix_user.present': [['alias', 'alias'], ['passwd', 'passwd'], ['usrgrps', 'usrgrps'], ['medias', 'None'], ['password_reset', 'False']],
  'zabbix_usermacro.absent': [['hostid', 'None']],
  'zabbix_usermacro.present': [['value', 'value'], ['hostid', 'None']],
  'zabbix_valuemap.present': [['params', 'params']],
  'zenoss.monitored': [['device_class', 'None'], ['collector', 'localhost'], ['prod_state', 'None']],
  'zfs.bookmark_absent': [['force', 'False'], ['recursive', 'False']],
  'zfs.bookmark_present': [['snapshot', 'snapshot']],
  'zfs.filesystem_absent': [['force', 'False'], ['recursive', 'False']],
  'zfs.filesystem_present': [['create_parent', 'False'], ['properties', 'None'], ['cloned_from', 'None']],
  'zfs.hold_absent': [['snapshot', 'snapshot'], ['recursive', 'False']],
  'zfs.hold_present': [['snapshot', 'snapshot'], ['recursive', 'False']],
  'zfs.scheduled_snapshot': [['prefix', 'prefix'], ['recursive', 'True'], ['schedule', 'None']],
  'zfs.snapshot_absent': [['force', 'False'], ['recursive', 'False']],
  'zfs.snapshot_present': [['recursive', 'False'], ['properties', 'None']],
  'zfs.volume_absent': [['force', 'False'], ['recursive', 'False']],
  'zfs.volume_present': [['volume_size', 'volume_size'], ['sparse', 'False'], ['create_parent', 'False'], ['properties', 'None'], ['cloned_from', 'None']],
  'zk_concurrency.lock': [['zk_hosts', 'None'], ['identifier', 'None'], ['max_concurrency', '1'], ['timeout', 'None'], ['ephemeral_lease', 'False'], ['profile', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zk_concurrency.min_party': [['zk_hosts', 'zk_hosts'], ['min_nodes', 'min_nodes'], ['blocking', 'False'], ['profile', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zk_concurrency.unlock': [['zk_hosts', 'None'], ['identifier', 'None'], ['max_concurrency', '1'], ['ephemeral_lease', 'False'], ['profile', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zone.absent': [['uninstall', 'False']],
  'zone.attached': [['force', 'False']],
  'zone.booted': [['single', 'False']],
  'zone.export': [['path', 'path'], ['replace', 'False']],
  'zone.halted': [['graceful', 'True']],
  'zone.import': [['path', 'path'], ['mode', 'import'], ['nodataset', 'False'], ['brand_opts', 'None']],
  'zone.installed': [['nodataset', 'False'], ['brand_opts', 'None']],
  'zone.present': [['brand', 'brand'], ['zonepath', 'zonepath'], ['properties', 'None'], ['resources', 'None']],
  'zone.property_absent': [['property', 'property']],
  'zone.property_present': [['property', 'property'], ['value', 'value']],
  'zone.resource_absent': [['resource_type', 'resource_type'], ['resource_selector_property', 'resource_selector_property'], ['resource_selector_value', 'resource_selector_value']],
  'zone.resource_present': [['resource_type', 'resource_type'], ['resource_selector_property', 'resource_selector_property'], ['resource_selector_value', 'resource_selector_value']],
  'zookeeper.absent': [['version', '-1'], ['recursive', 'False'], ['profile', 'None'], ['hosts', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zookeeper.acls': [['acls', 'acls'], ['version', '-1'], ['profile', 'None'], ['hosts', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zookeeper.present': [['value', 'value'], ['acls', 'None'], ['ephemeral', 'False'], ['sequence', 'False'], ['makepath', 'False'], ['version', '-1'], ['profile', 'None'], ['hosts', 'None'], ['scheme', 'None'], ['username', 'None'], ['password', 'None'], ['default_acl', 'None']],
  'zpool.absent': [['export', 'False'], ['force', 'False']],
  'zpool.present': [['properties', 'None'], ['filesystem_properties', 'None'], ['layout', 'None'], ['config', 'None']],
};

// The two Salt release lines this extension can offer completions for --
// see the comment above MODULE_FUNCTIONS_3008. Keyed by the exact string
// values of the saltSyntax.saltVersion setting (package.json's enum).
const MODULE_DATASETS = {
  '3008': {
    moduleFunctions: MODULE_FUNCTIONS_3008,
    fullFunctionFields: FULL_FUNCTION_FIELDS_3008,
    mandatoryFields: MANDATORY_FIELDS_3008
  },
  '3006': {
    moduleFunctions: MODULE_FUNCTIONS_3006,
    fullFunctionFields: FULL_FUNCTION_FIELDS_3006,
    mandatoryFields: MANDATORY_FIELDS_3006
  }
};

// Reads live (not cached), same as stateIdPrefix() below, so switching
// saltSyntax.saltVersion (via the settings UI or the "Salt Syntax: Set Salt
// Version" command) takes effect on the very next completion.
function activeDataset() {
  const version = vscode.workspace.getConfiguration('saltSyntax').get('saltVersion', '3008');
  return MODULE_DATASETS[version] || MODULE_DATASETS['3008'];
}

// Builds `<indent>- key: ${n:placeholder}` lines, returning the joined text
// and the next unused tabstop number. Ends with a bare `$0` (final cursor
// position) right after the last value rather than an extra blank `- ` line
// -- basic now always includes every mandatory argument (see
// MANDATORY_FIELDS_3008/MANDATORY_FIELDS_3006 above), so that invite-more-args
// line wasn't earning its keep; add another `- key: value` line by hand same
// as any other YAML edit.
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

// A line that's its own unindented, non-comment ":"-terminated key --
// i.e. something a module.function line could actually nest under.
function looksLikeStateIdLine(text) {
  return /^\S[^\n]*:\s*$/.test(text) && !text.trimStart().startsWith('#');
}

// indent.length === 0 is always top-level, no ambiguity. Otherwise (some
// accidental/leftover indentation -- common after editing, or inherited
// from a blank line's auto-indent) this only treats it as "nested under an
// existing id" when the line directly above actually looks like one; if
// not, it's still a fresh top-level block, just one that also needs its
// stray leading whitespace reset to column 0 (see resetIndent in the
// caller). Gated by saltSyntax.smartTopLevelDetection so strict
// indentation-only detection (indent.length === 0, full stop) can still be
// chosen instead.
function isEffectivelyTopLevel(document, position, indentLength) {
  if (indentLength === 0) {
    return true;
  }
  const smart = vscode.workspace.getConfiguration('saltSyntax').get('smartTopLevelDetection', true);
  if (!smart) {
    return false;
  }
  if (position.line === 0) {
    return true;
  }
  return !looksLikeStateIdLine(document.lineAt(position.line - 1).text);
}

// Off by default (see the comment above JINJA_BLOCK_SNIPPETS). When on,
// every "{%" this extension generates becomes "{%-" -- leading-trim only,
// no trailing "-%}", matching the style already used throughout this
// repo's own example file (e.g. "{%- set tplroot = ... %}") and common
// Salt-formula convention: it removes the blank line the tag would
// otherwise leave behind without collapsing the line that follows it.
function applyJinjaWhitespaceControl(body) {
  const enabled = vscode.workspace.getConfiguration('saltSyntax').get('jinjaWhitespaceControl', false);
  return enabled ? body.replace(/\{%(?!-)/g, '{%-') : body;
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

// Matches a Jinja tag on a single line, in either its plain or "toggled"
// (commented) form. The two commented alternatives are listed first, but
// there's no real ambiguity either way: a plain {% ... %}'s 2nd character is
// always "%", {{ ... }}'s is always "{", and a commented tag's is always "#"
// -- distinct in every case, so alternation order doesn't actually matter
// for correctness, just for readability. A genuine pre-existing Jinja
// comment ({#- ... #}, no % or { as the 3rd character) matches none of
// these and is correctly left alone.
const JINJA_TAG_RE = /\{#%.*?%#\}|\{#\{.*?\}#\}|\{%.*?%\}|\{\{.*?\}\}/g;

// {% x %} <-> {#% x %#}, {{ x }} <-> {#{ x }#}: Jinja's lexer just looks
// for the literal next "{#" to start a comment and the next "#}" to end it,
// so wrapping with a single # just inside each original delimiter is a
// minimal, trivially reversible comment toggle that never touches the
// tag's own original characters (including any leading/trailing "-"
// whitespace-control markers, which just end up adjacent to our #s).
function toggleJinjaTagText(text) {
  if (text[1] === '#') {
    // Already toggled on: strip the two inserted #s.
    return text[0] + text.slice(2, -2) + text[text.length - 1];
  }
  return text[0] + '#' + text.slice(1, -1) + '#' + text[text.length - 1];
}

// Jinja statement tags, active ({% %}) and toggled off ({#% %#}) -- the ones
// that change what the rendered file contains. A YAML "# " in front of a
// line doesn't stop Jinja from executing them (Jinja renders the whole file
// before YAML ever sees it), so a line-commented block has to neutralize
// them too. {{ }} expressions are left alone: inside a YAML comment their
// output is just more comment text.
const JINJA_STMT_RE = /\{%.*?%\}/g;
const JINJA_STMT_OFF_RE = /\{#%.*?%#\}/g;

// Line-comment toggle for a multi-line block: if every non-blank line is
// already #-commented, strip one "# " from each and re-enable any {#% %#}
// tags; otherwise prefix every non-blank line with "# " (at the block's
// minimum indent, like VS Code's own line comment) and toggle every {% %}
// tag off. Returns null when the block has no statement tags at all, so the
// caller can leave it to VS Code's plain line comment.
function toggleCommentBlock(lines) {
  const nonBlank = lines.filter((l) => l.trim() !== '');
  const hasStmt = (l) => l.search(JINJA_STMT_RE) !== -1 || l.search(JINJA_STMT_OFF_RE) !== -1;
  if (nonBlank.length === 0 || !nonBlank.some(hasStmt)) {
    return null;
  }
  if (nonBlank.every((l) => /^\s*#/.test(l))) {
    return lines.map((l) =>
      l.trim() === '' ? l : l.replace(/^(\s*)# ?/, '$1').replace(JINJA_STMT_OFF_RE, toggleJinjaTagText)
    );
  }
  const indent = Math.min(...nonBlank.map((l) => l.match(/^\s*/)[0].length));
  return lines.map((l) =>
    l.trim() === '' ? l : l.slice(0, indent) + '# ' + l.slice(indent).replace(JINJA_STMT_RE, toggleJinjaTagText)
  );
}

// Jinja block structure, for highlighting every tag of the block under the
// cursor (if/elif/else/endif, for/else/endfor, ...). Keys are the opening
// keyword; `middle` lists the keywords that belong to the innermost open
// block of that kind rather than starting a new one.
const JINJA_BLOCKS = {
  if: { middle: ['elif', 'else'] },
  for: { middle: ['else'] },
  macro: { middle: [] },
  call: { middle: [] },
  filter: { middle: [] },
  set: { middle: [] },
  with: { middle: [] },
  block: { middle: [] },
  autoescape: { middle: [] },
  trans: { middle: ['pluralize'] },
  raw: { middle: [] }
};

// Jinja comments (including toggled-off {#% %#} / {#{ }#} tags) and
// statement tags, in document order. Tags can span lines.
const JINJA_SCAN_RE = /\{#[\s\S]*?#\}|\{%-?\s*([A-Za-z_]\w*)?([\s\S]*?)-?%\}/g;

// Walks every Jinja statement tag in document order, tracking block
// nesting, and calls visit(tag, role, group, stack) for each, where tag is
// { start, end, keyword } (offsets covering the whole tag) and role is:
// - 'open':   opens `group` (stack = the blocks it's nested in)
// - 'middle': elif/else/... belonging to `group`, the innermost open block
// - 'end':    closes `group` (stack = the blocks still open around it)
// - 'plain':  any other tag (inline set, include, do, ...), inside `stack`
// - 'stray':  an end/middle tag with no matching open block
// Tags inside Jinja comments and {% raw %} blocks are skipped (Jinja
// ignores them too); tags on YAML #-comment lines are not, since Jinja
// still runs those. Closing a block pops anything left unclosed inside it
// -- the same recovery an editor bracket matcher would do. Returns the
// blocks still open at the end of `text`, innermost last.
function walkJinjaTags(text, visit) {
  const stack = [];
  JINJA_SCAN_RE.lastIndex = 0;
  let m;
  while ((m = JINJA_SCAN_RE.exec(text))) {
    const keyword = m[1];
    if (keyword === undefined) {
      continue; // a comment, or a tag with no keyword
    }
    const tag = { start: m.index, end: m.index + m[0].length, keyword };
    if (keyword === 'set' && /=/.test(m[2])) {
      // inline {% set x = ... %}, not a {% set x %}...{% endset %} block
      visit(tag, 'plain', null, stack);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(JINJA_BLOCKS, keyword)) {
      const group = { keyword, tags: [tag] };
      visit(tag, 'open', group, stack);
      if (keyword === 'raw') {
        const endRaw = /\{%-?\s*endraw\s*-?%\}/g;
        endRaw.lastIndex = tag.end;
        const e = endRaw.exec(text);
        if (!e) {
          break; // unterminated raw: the rest of the file is raw text
        }
        const endTag = { start: e.index, end: e.index + e[0].length, keyword: 'endraw' };
        group.tags.push(endTag);
        visit(endTag, 'end', group, stack);
        JINJA_SCAN_RE.lastIndex = endTag.end;
        continue;
      }
      stack.push(group);
      continue;
    }
    const top = stack[stack.length - 1];
    if (keyword.startsWith('end')) {
      const idx = stack.map((g) => g.keyword).lastIndexOf(keyword.slice(3));
      if (idx === -1) {
        visit(tag, 'stray', null, stack);
        continue;
      }
      const group = stack[idx];
      group.tags.push(tag);
      stack.length = idx;
      visit(tag, 'end', group, stack);
    } else if (top && JINJA_BLOCKS[top.keyword].middle.includes(keyword)) {
      top.tags.push(tag);
      visit(tag, 'middle', top, stack);
    } else if (JINJA_BLOCKS_MIDDLE_KEYWORDS.has(keyword)) {
      visit(tag, 'stray', null, stack);
    } else {
      visit(tag, 'plain', null, stack);
    }
  }
  return stack;
}

const JINJA_BLOCKS_MIDDLE_KEYWORDS = new Set(Object.values(JINJA_BLOCKS).flatMap((b) => b.middle));

// Groups of block tags (see walkJinjaTags), each { keyword, tags }. An
// unclosed block still groups what it has.
function findJinjaBlockGroups(text) {
  const groups = [];
  walkJinjaTags(text, (tag, role, group) => {
    if (role === 'open') {
      groups.push(group);
    }
  });
  return groups;
}

// Jinja indentation check (saltSyntax.jinjaIndentCheck): a tag that starts
// its line must sit two spaces deeper than the block it's in, and a block's
// middle/closing tags (elif/else/endif, endfor, ...) level with its opening
// tag. Nesting is measured against where each block's opening tag *should*
// be, not where it is, so one misplaced opener flags its whole block in one
// pass instead of one tag per fix. A top-level tag sets its own baseline
// (no expectation), so Jinja inside an indented YAML block scalar
// (`contents: |`) nests relative to wherever it starts. Tags that don't
// start their line (`- name: {% if x %}a{% endif %}`) aren't checked.
// Returns [{ line, actual, expected, tabs, message }].
const JINJA_INDENT_STEP = 2;
const JINJA_INDENT_CODE = 'jinja-indent';

function analyzeJinjaIndent(text) {
  const issues = [];
  const lineOf = (offset) => {
    let line = 0;
    for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
      line++;
    }
    return line;
  };
  const describe = (group) => `{% ${group.keyword} %} on line ${lineOf(group.tags[0].start) + 1}`;
  const openBlocks = walkJinjaTags(text, (tag, role, group, stack) => {
    const lineStart = text.lastIndexOf('\n', tag.start - 1) + 1;
    const prefix = text.slice(lineStart, tag.start);
    const atLineStart = /^[ \t]*$/.test(prefix);
    const parent = stack[stack.length - 1];
    let expected = null;
    let reason = '';
    if (role === 'open' || role === 'plain') {
      if (parent) {
        expected = parent.expected + JINJA_INDENT_STEP;
        reason = `inside ${describe(parent)}`;
      }
      if (role === 'open') {
        // A top-level (or mid-line) opener anchors its block where it is.
        group.expected = expected !== null ? expected : text.slice(lineStart).match(/^[ \t]*/)[0].length;
      }
    } else if (role === 'middle' || role === 'end') {
      expected = group.expected;
      reason = `level with its ${describe(group)}`;
    }
    if (expected === null || !atLineStart) {
      return;
    }
    const tabs = prefix.includes('\t');
    if (prefix.length === expected && !tabs) {
      return;
    }
    const found = tabs ? 'tab indentation' : `${prefix.length} space${prefix.length === 1 ? '' : 's'}`;
    issues.push({
      line: lineOf(tag.start),
      actual: prefix.length,
      expected,
      tabs,
      message: `Jinja tag indentation doesn't follow block nesting: expected ${expected} space${expected === 1 ? '' : 's'} (${reason}), found ${found}.`
    });
  });
  return { issues, openBlocks };
}

function findJinjaIndentIssues(text) {
  return analyzeJinjaIndent(text).issues;
}

// Where a new `{% keyword ... %}` tag starting a line should be indented,
// given the blocks open at that point (analyzeJinjaIndent's openBlocks), to follow block nesting: level with the block it
// continues or closes (elif/else/end...), otherwise two spaces deeper than
// the innermost open block. null at top level, where there's nothing to
// follow -- the tag keeps whatever indentation it has.
function expectedJinjaIndentFor(openBlocks, keyword) {
  const top = openBlocks[openBlocks.length - 1];
  if (!top) {
    return null;
  }
  if (keyword.startsWith('end')) {
    const closing = openBlocks.map((g) => g.keyword).lastIndexOf(keyword.slice(3));
    if (closing !== -1) {
      return openBlocks[closing].expected;
    }
  }
  if (JINJA_BLOCKS[top.keyword].middle.includes(keyword)) {
    return top.expected;
  }
  return top.expected + JINJA_INDENT_STEP;
}

// The extra edit a Jinja completion should carry to re-indent its line (see
// expectedJinjaIndentFor), or undefined when the line is already right or
// there's no nesting to follow. `leading` is the line's current leading
// whitespace; only its range is replaced, so this never overlaps the
// completion's own edit.
function jinjaReindentEdit(openBlocks, position, leading, keyword) {
  const expected = expectedJinjaIndentFor(openBlocks, keyword);
  if (expected === null || (leading.length === expected && !leading.includes('\t'))) {
    return undefined;
  }
  return [vscode.TextEdit.replace(new vscode.Range(position.line, 0, position.line, leading.length), ' '.repeat(expected))];
}

// Maps each saltSyntax.* toggle to the [sls]-scoped settings it controls and
// what "off" (opted out of the default) should explicitly set them to.
// "on" (the default) means *no* override -- it just removes whatever
// explicit override a previous "off" wrote, falling back to
// configurationDefaults again. Writing `undefined` can't cancel a
// configurationDefault on its own (it's the lowest-priority layer, used only
// when nothing else -- including no leftover override from this function --
// is set), so "off" has to write a real value: VS Code's own built-in
// default for that setting, i.e. what a vanilla install with no Salt Syntax
// preference would use.
const EDITOR_DEFAULT_TOGGLES = [
  { setting: 'saltSyntax.showWhitespace', section: 'editor', key: 'renderWhitespace', offValue: 'selection' },
  { setting: 'saltSyntax.enforceLfLineEndings', section: 'files', key: 'eol', offValue: 'auto' },
  { setting: 'saltSyntax.enforceFinalNewline', section: 'files', key: 'insertFinalNewline', offValue: false },
  { setting: 'saltSyntax.enforceFinalNewline', section: 'files', key: 'trimFinalNewlines', offValue: false }
];

async function syncEditorDefaults() {
  const saltCfg = vscode.workspace.getConfiguration('saltSyntax');
  for (const toggle of EDITOR_DEFAULT_TOGGLES) {
    const key = toggle.setting.split('.')[1];
    const enabled = saltCfg.get(key, true);
    const cfg = vscode.workspace.getConfiguration(toggle.section, { languageId: 'sls' });
    const value = enabled ? undefined : toggle.offValue;

    // Skip the write entirely when it wouldn't change anything -- avoids
    // touching settings.json on every single activation when nothing's
    // actually toggled (the common case, since the default is "on").
    const inspected = cfg.inspect(toggle.key);
    const current = inspected && inspected.globalLanguageValue;
    if (current === value) {
      continue;
    }

    try {
      await cfg.update(toggle.key, value, vscode.ConfigurationTarget.Global, true);
    } catch (err) {
      // Global settings write can fail in restricted/untrusted-workspace
      // contexts -- not fatal, the configurationDefault (or whatever the
      // user already has) still applies either way.
      console.error('Salt Syntax: could not sync editor default', toggle.key, err);
    }
  }
}

// Non-ASCII check (saltSyntax.nonAsciiCheck): older minions -- Python 2
// based Salt, or any minion whose locale isn't UTF-8 -- can fail to render an
// SLS file containing a non-ASCII byte anywhere, comments included. The usual
// culprits are invisible or look-alike characters pasted in from docs, chat
// or a wiki page (smart quotes, en/em dashes, NBSP), so the explicit table
// below covers those first; anything else falls back to Unicode NFKD
// decomposition with combining marks stripped (e -> e, full-width A -> A,
// the "fi" ligature -> fi). A character neither path turns into pure ASCII
// (CJK, emoji, ...) is still flagged, just with no automatic replacement.
const ASCII_REPLACEMENTS = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"', '″': '"',
  '«': '<<', '»': '>>', '‹': '<', '›': '>',
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-',
  '…': '...', '•': '*', '·': '*', '×': 'x', '÷': '/',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '　': ' ',
  '​': '', '‌': '', '‍': '', '⁠': '', '﻿': '', '­': '',
  '©': '(c)', '®': '(r)', '™': '(tm)', '°': 'deg',
  'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE',
  'ø': 'o', 'Ø': 'O', 'đ': 'd', 'Đ': 'D', 'ł': 'l', 'Ł': 'L',
  'þ': 'th', 'Þ': 'Th', 'ð': 'd', 'Ð': 'D', 'ı': 'i'
};

const NON_ASCII_RE = /[^\x00-\x7F]+/g;
const NON_ASCII_CODE = 'non-ascii';

// ASCII replacement for one code point, or null if there's no sensible one.
function charToAscii(ch) {
  if (Object.prototype.hasOwnProperty.call(ASCII_REPLACEMENTS, ch)) {
    return ASCII_REPLACEMENTS[ch];
  }
  // U+2000-U+200A are all just differently-sized spaces.
  const cp = ch.codePointAt(0);
  if (cp >= 0x2000 && cp <= 0x200A) {
    return ' ';
  }
  const decomposed = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return /^[\x00-\x7F]*$/.test(decomposed) ? decomposed : null;
}

// ASCII replacement for a whole run of non-ASCII text, or null if any
// character in it has none (a partial fix would just leave the run flagged).
function textToAscii(text) {
  let out = '';
  for (const ch of text) {
    const ascii = charToAscii(ch);
    if (ascii === null) {
      return null;
    }
    out += ascii;
  }
  return out;
}

function describeNonAscii(text) {
  return [...text]
    .map((ch) => {
      const hex = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      // Invisible characters (NBSP, zero-width, ...) would print as nothing
      // useful between the quotes, so just show the code point for those.
      return /\s|\p{M}|[​-‍⁠﻿­]/u.test(ch) ? `U+${hex}` : `'${ch}' U+${hex}`;
    })
    .join(', ');
}

// How a replacement reads in a message/action title -- backticks rather than
// quotes, since the replacement is often itself a quote character.
function describeAscii(ascii) {
  return /^ +$/.test(ascii) ? (ascii.length > 1 ? 'spaces' : 'a plain space') : `\`${ascii}\``;
}

function nonAsciiCheckEnabled() {
  return vscode.workspace.getConfiguration('saltSyntax').get('nonAsciiCheck', true);
}

function findNonAsciiDiagnostics(document) {
  const diagnostics = [];
  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    for (const m of text.matchAll(NON_ASCII_RE)) {
      const range = new vscode.Range(line, m.index, line, m.index + m[0].length);
      const ascii = textToAscii(m[0]);
      const fix = ascii === null
        ? 'No ASCII equivalent -- remove or rewrite it by hand.'
        : ascii === ''
          ? 'Quick fix: remove it.'
          : `Quick fix: replace with ${describeAscii(ascii)}.`;
      const diagnostic = new vscode.Diagnostic(
        range,
        `Non-ASCII character${[...m[0]].length > 1 ? 's' : ''} (${describeNonAscii(m[0])}) can break rendering on older Salt minions (Python 2 / non-UTF-8 locale). ${fix}`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'Salt Syntax';
      diagnostic.code = NON_ASCII_CODE;
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

// One WorkspaceEdit replacing every convertible non-ASCII run in the
// document (runs with no ASCII equivalent are left as-is).
function buildConvertAllEdit(document) {
  const edit = new vscode.WorkspaceEdit();
  let count = 0;
  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    for (const m of text.matchAll(NON_ASCII_RE)) {
      const ascii = textToAscii(m[0]);
      if (ascii !== null) {
        edit.replace(document.uri, new vscode.Range(line, m.index, line, m.index + m[0].length), ascii);
        count++;
      }
    }
  }
  return { edit, count };
}

async function activate(context) {
  const selector = { language: 'sls' };

  // Awaited (not fire-and-forget): syncEditorDefaults() writes up to 4
  // settings sequentially, and VS Code lets activate() return a Promise
  // precisely so setup like this can complete before the extension is
  // considered active, rather than racing document opens or a rapid second
  // toggle against an in-flight sync.
  await syncEditorDefaults();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration('saltSyntax.showWhitespace') ||
        e.affectsConfiguration('saltSyntax.enforceLfLineEndings') ||
        e.affectsConfiguration('saltSyntax.enforceFinalNewline')
      ) {
        await syncEditorDefaults();
      }
    })
  );

  // Non-ASCII check: warnings live in their own diagnostic collection,
  // recomputed on every open/edit (a regex pass per line -- cheap enough for
  // any realistic .sls file that there's no need to debounce), and cleared
  // on close or when saltSyntax.nonAsciiCheck is turned off.
  const nonAsciiDiagnostics = vscode.languages.createDiagnosticCollection('salt-syntax-non-ascii');
  const refreshNonAscii = (document) => {
    if (document.languageId !== 'sls') {
      return;
    }
    if (!nonAsciiCheckEnabled()) {
      nonAsciiDiagnostics.delete(document.uri);
      return;
    }
    nonAsciiDiagnostics.set(document.uri, findNonAsciiDiagnostics(document));
  };
  vscode.workspace.textDocuments.forEach(refreshNonAscii);
  context.subscriptions.push(
    nonAsciiDiagnostics,
    vscode.workspace.onDidOpenTextDocument(refreshNonAscii),
    vscode.workspace.onDidChangeTextDocument((e) => refreshNonAscii(e.document)),
    vscode.workspace.onDidCloseTextDocument((document) => nonAsciiDiagnostics.delete(document.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('saltSyntax.nonAsciiCheck')) {
        vscode.workspace.textDocuments.forEach(refreshNonAscii);
      }
    })
  );

  // Quick fixes for the non-ASCII warnings: one per diagnostic under the
  // cursor, plus a whole-file "convert all" (also offered as source.fixAll,
  // so editor.codeActionsOnSave can run it on save if someone wants that).
  const nonAsciiActionProvider = vscode.languages.registerCodeActionsProvider(
    selector,
    {
      provideCodeActions(document, range, ctx) {
        const actions = [];
        const ours = ctx.diagnostics.filter((d) => d.code === NON_ASCII_CODE);
        for (const diagnostic of ours) {
          const ascii = textToAscii(document.getText(diagnostic.range));
          if (ascii === null) {
            continue;
          }
          const action = new vscode.CodeAction(
            ascii === '' ? 'Remove non-ASCII character' : `Replace with ASCII ${describeAscii(ascii)}`,
            vscode.CodeActionKind.QuickFix
          );
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(document.uri, diagnostic.range, ascii);
          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          actions.push(action);
        }
        const wantsFixAll = ctx.only && vscode.CodeActionKind.SourceFixAll.contains(ctx.only);
        if (ours.length > 0 || wantsFixAll) {
          const { edit, count } = buildConvertAllEdit(document);
          if (count > 0) {
            const kind = wantsFixAll ? vscode.CodeActionKind.SourceFixAll : vscode.CodeActionKind.QuickFix;
            const all = new vscode.CodeAction('Convert all non-ASCII characters in file to ASCII', kind);
            all.edit = edit;
            actions.push(all);
          }
        }
        return actions;
      }
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.SourceFixAll] }
  );

  const convertToAsciiCommand = vscode.commands.registerCommand('saltSyntax.convertToAscii', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'sls') {
      return;
    }
    const { edit, count } = buildConvertAllEdit(editor.document);
    if (count === 0) {
      vscode.window.showInformationMessage('Salt Syntax: no convertible non-ASCII characters in this file.');
      return;
    }
    await vscode.workspace.applyEdit(edit);
  });

  // Jinja indentation check (see findJinjaIndentIssues): same lifecycle as
  // the non-ASCII check, in its own collection, governed by
  // saltSyntax.jinjaIndentCheck.
  const jinjaIndentDiagnostics = vscode.languages.createDiagnosticCollection('salt-syntax-jinja-indent');
  const refreshJinjaIndent = (document) => {
    if (document.languageId !== 'sls') {
      return;
    }
    if (!vscode.workspace.getConfiguration('saltSyntax').get('jinjaIndentCheck', true)) {
      jinjaIndentDiagnostics.delete(document.uri);
      return;
    }
    jinjaIndentDiagnostics.set(
      document.uri,
      findJinjaIndentIssues(document.getText()).map((issue) => {
        const d = new vscode.Diagnostic(
          new vscode.Range(issue.line, 0, issue.line, document.lineAt(issue.line).text.length),
          issue.message,
          vscode.DiagnosticSeverity.Warning
        );
        d.source = 'Salt Syntax';
        d.code = JINJA_INDENT_CODE;
        return d;
      })
    );
  };
  vscode.workspace.textDocuments.forEach(refreshJinjaIndent);
  context.subscriptions.push(
    jinjaIndentDiagnostics,
    vscode.workspace.onDidOpenTextDocument(refreshJinjaIndent),
    vscode.workspace.onDidChangeTextDocument((e) => refreshJinjaIndent(e.document)),
    vscode.workspace.onDidCloseTextDocument((document) => jinjaIndentDiagnostics.delete(document.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('saltSyntax.jinjaIndentCheck')) {
        vscode.workspace.textDocuments.forEach(refreshJinjaIndent);
      }
    })
  );

  // Quick fixes: re-indent the tag(s) under the cursor, or every flagged
  // tag in the file. Issues are recomputed rather than read back off the
  // diagnostics, since VS Code hands the provider copies without any extra
  // fields; each fix only rewrites a line's leading whitespace.
  const jinjaIndentActionProvider = vscode.languages.registerCodeActionsProvider(
    selector,
    {
      provideCodeActions(document, range, ctx) {
        const ours = ctx.diagnostics.filter((d) => d.code === JINJA_INDENT_CODE);
        if (ours.length === 0) {
          return [];
        }
        const issues = findJinjaIndentIssues(document.getText());
        const reindent = (edit, issue) =>
          edit.replace(document.uri, new vscode.Range(issue.line, 0, issue.line, issue.actual), ' '.repeat(issue.expected));
        const actions = [];
        for (const diagnostic of ours) {
          const issue = issues.find((i) => i.line === diagnostic.range.start.line);
          if (!issue) {
            continue;
          }
          const action = new vscode.CodeAction(`Re-indent Jinja tag to ${issue.expected} spaces`, vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          reindent(action.edit, issue);
          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          actions.push(action);
        }
        if (issues.length > 1) {
          const all = new vscode.CodeAction('Re-indent all Jinja tags in file to follow block nesting', vscode.CodeActionKind.QuickFix);
          all.edit = new vscode.WorkspaceEdit();
          issues.forEach((issue) => reindent(all.edit, issue));
          actions.push(all);
        }
        return actions;
      }
    },
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
  );

  // Quick-pick alternative to hunting down saltSyntax.saltVersion in the
  // settings UI -- writes the same setting, so either path takes effect on
  // the very next completion (see activeDataset()'s live read).
  const setSaltVersionCommand = vscode.commands.registerCommand('saltSyntax.setSaltVersion', async () => {
    const current = vscode.workspace.getConfiguration('saltSyntax').get('saltVersion', '3008');
    const picked = await vscode.window.showQuickPick(
      [
        { label: '3008.x', description: current === '3008' ? 'current' : '', detail: 'Current stable line.', value: '3008' },
        { label: '3006.x', description: current === '3006' ? 'current' : '', detail: 'Long-term-support line — includes many state modules 3008.x dropped.', value: '3006' }
      ],
      { placeHolder: 'Salt release line for state module completions' }
    );
    if (!picked) {
      return;
    }
    await vscode.workspace.getConfiguration('saltSyntax').update('saltVersion', picked.value, vscode.ConfigurationTarget.Global);
  });

  // Ctrl+/ override (see package.json's keybindings, scoped to editorLangId
  // == sls so it doesn't affect any other language), single cursor only:
  // - a multi-line selection containing Jinja statement tags is
  //   line-commented via toggleCommentBlock(), which also neutralizes those
  //   tags (a plain "# " alone doesn't stop Jinja from running them);
  // - a single line with a Jinja tag on it toggles just that tag via
  //   toggleJinjaTagText().
  // Everything else -- multiple cursors, a multi-line selection with no
  // statement tags, or a line with no Jinja tag -- falls straight through to
  // VS Code's own normal line-comment command, unchanged.
  const toggleCommentCommand = vscode.commands.registerCommand('saltSyntax.toggleComment', async () => {
    const editor = vscode.window.activeTextEditor;
    const fallThrough = () => vscode.commands.executeCommand('editor.action.commentLine');
    if (!editor || editor.document.languageId !== 'sls' || editor.selections.length !== 1) {
      return fallThrough();
    }
    const selection = editor.selection;
    if (selection.start.line !== selection.end.line) {
      // Same convention as VS Code's own line comment: a selection ending at
      // column 0 of a line doesn't include that line.
      const startLine = selection.start.line;
      const endLine = selection.end.character === 0 ? selection.end.line - 1 : selection.end.line;
      const lines = [];
      for (let i = startLine; i <= endLine; i++) {
        lines.push(editor.document.lineAt(i).text);
      }
      const toggled = toggleCommentBlock(lines);
      if (!toggled) {
        return fallThrough();
      }
      const range = new vscode.Range(startLine, 0, endLine, lines[lines.length - 1].length);
      await editor.edit((editBuilder) => editBuilder.replace(range, toggled.join('\n')));
      return;
    }
    const lineNumber = selection.start.line;
    const lineText = editor.document.lineAt(lineNumber).text;
    const matches = [...lineText.matchAll(JINJA_TAG_RE)];
    if (matches.length === 0) {
      return fallThrough();
    }
    // All replacements are computed against the same pre-edit snapshot of
    // the line and queued in one editor.edit() call, so VS Code applies
    // them together against the original offsets -- no need to walk the
    // matches back-to-front to dodge shifting positions.
    await editor.edit((editBuilder) => {
      for (const m of matches) {
        const range = new vscode.Range(lineNumber, m.index, lineNumber, m.index + m[0].length);
        editBuilder.replace(range, toggleJinjaTagText(m[0]));
      }
    });
  });

  // Deletes the "mod." the user typed and inserts the full
  // {{ sls }}.<state_id>: / mod.fn: / ...args block as a live, tabbable
  // snippet. Invoked as a completion item's `command` rather than via plain
  // insertText+range, since a completion range that widens backward past
  // the "." trigger character isn't reliably honored by the editor.
  const insertStateBlockCommand = vscode.commands.registerCommand(
    'saltstack-sls.insertStateBlock',
    async (mod, fn, variant, resetIndent) => {
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
      // resetIndent means this was treated as top-level despite some
      // accidental/leftover leading whitespace (see isEffectivelyTopLevel)
      // -- delete that whitespace too, so the block starts clean at column 0
      // instead of inheriting stray indentation.
      const deleteStart = resetIndent ? 0 : modStart;
      const range = new vscode.Range(position.line, deleteStart, position.line, position.character);
      const fields = getFields(mod, fn, variant, activeDataset());
      const args = buildArgsBody(fields, '    ', 2);
      const snippet = new vscode.SnippetString(
        `${stateIdPrefix()}\${1:state_id}:\n  ${mod}.${fn}:\n${args.text}`
      );
      await editor.edit((editBuilder) => editBuilder.delete(range));
      await editor.insertSnippet(snippet, new vscode.Position(position.line, deleteStart));
    }
  );

  // module.function state completions, e.g. "pkg." -> installed/removed/...
  const stateProvider = vscode.languages.registerCompletionItemProvider(
    selector,
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);

        const dataset = activeDataset();
        const dotMatch = linePrefix.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\.$/);
        if (dotMatch && dataset.moduleFunctions[dotMatch[2]]) {
          const indent = dotMatch[1];
          const mod = dotMatch[2];
          const atTopLevel = isEffectivelyTopLevel(document, position, indent.length);
          const resetIndent = atTopLevel && indent.length > 0;

          return dataset.moduleFunctions[mod].flatMap((fn) =>
            availableVariants(mod, fn, dataset).map((variant) => {
              const isFull = variant === 'full';
              const fields = getFields(mod, fn, variant, dataset);
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
                  arguments: [mod, fn, variant, resetIndent]
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
          return Object.keys(dataset.moduleFunctions).map((mod) => {
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

        // Leading whitespace, when what's being completed starts its line --
        // a bare keyword about to become a block snippet, or the first word
        // right after a line-leading "{%" -- so the completion can also move
        // the line to where Jinja nesting says it belongs.
        const leading = linePrefix.match(/^[ \t]*/)[0];
        const tagStartsLine = /^[ \t]*\{%-?\s*[A-Za-z_]*$/.test(linePrefix);
        const wordStartsLine = /^[ \t]*[A-Za-z_][A-Za-z0-9_]*$/.test(linePrefix);
        // Blocks open above this line, parsed once per request (and only when
        // a re-indent is possible at all).
        const openBlocks = tagStartsLine || wordStartsLine
          ? analyzeJinjaIndent(document.getText(new vscode.Range(0, 0, position.line, 0))).openBlocks
          : [];

        if (insideJinjaTag(linePrefix)) {
          const items = [];
          JINJA_KEYWORDS.forEach((kw) => {
            const item = makeItem(kw, vscode.CompletionItemKind.Keyword, kw, 'Jinja keyword');
            if (tagStartsLine) {
              item.additionalTextEdits = jinjaReindentEdit(openBlocks, position, leading, kw);
            }
            items.push(item);
          });
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
          item.insertText = new vscode.SnippetString(applyJinjaWhitespaceControl(s.body));
          item.detail = s.detail;
          item.filterText = s.filter;
          item.sortText = `${String(i).padStart(3, '0')}_${s.filter}`;
          if (wordStartsLine) {
            item.additionalTextEdits = jinjaReindentEdit(openBlocks, position, leading, s.filter);
          }
          return item;
        });
      }
    },
    '{',
    '%',
    '|'
  );

  // Cursor on a Jinja block tag -> highlight every tag of that block (see
  // findJinjaBlockGroups). Registering any highlight provider replaces VS
  // Code's built-in same-word occurrence highlighting for the language, so
  // anywhere else this reproduces that: every whole-word match of the word
  // under the cursor.
  const blockHighlightProvider = vscode.languages.registerDocumentHighlightProvider(selector, {
    provideDocumentHighlights(document, position) {
      const text = document.getText();
      const offset = document.offsetAt(position);
      const toRange = (start, end) => new vscode.Range(document.positionAt(start), document.positionAt(end));
      for (const group of findJinjaBlockGroups(text)) {
        if (group.tags.some((t) => offset >= t.start && offset <= t.end)) {
          return group.tags.map((t) => new vscode.DocumentHighlight(toRange(t.start, t.end), vscode.DocumentHighlightKind.Text));
        }
      }
      const wordRange = document.getWordRangeAtPosition(position);
      if (!wordRange) {
        return [];
      }
      const word = document.getText(wordRange);
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // A "word character" is anything language-configuration.json's
      // wordPattern doesn't treat as a separator.
      const wordChar = "[^\\-`~!@#%^&*()=+\\[{\\]}\\\\|;:'\",.<>/?\\s]";
      const highlights = [];
      for (const w of text.matchAll(new RegExp(`(?<!${wordChar})${escaped}(?!${wordChar})`, 'g'))) {
        highlights.push(new vscode.DocumentHighlight(toRange(w.index, w.index + w[0].length), vscode.DocumentHighlightKind.Text));
      }
      return highlights;
    }
  });

  context.subscriptions.push(
    blockHighlightProvider,
    jinjaIndentActionProvider,
    setSaltVersionCommand,
    convertToAsciiCommand,
    nonAsciiActionProvider,
    toggleCommentCommand,
    insertStateBlockCommand,
    stateProvider,
    requisiteProvider,
    jinjaProvider
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
