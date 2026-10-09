// Self-check: `npm test` — asserts the generator emits valid, correctly-shaped Lagoon YAML.
import assert from 'node:assert';
import YAML from 'yaml';
import { generateAllFiles, generateLagoonYml } from './generator';
import { PRESETS } from './constants';
import { LagoonProjectSchema, serviceRefPaths } from './types';

const drupal = LagoonProjectSchema.parse({
  ...PRESETS.Drupal,
  backupsEnabled: true,
  gitSha: true,
  containerRegistries: [{ name: 'my-registry', url: 'registry.example.com', username: 'bob' }],
  autogenerateTlsAcme: false,
  autogenerateIngressClass: 'nginx',
  autogeneratePathRoutes: [{ fromService: 'nginx', toService: 'cli', path: '/api' }],
  volumes: [{ name: 'uploads', size: '10Gi', backup: false }],
  services: PRESETS.Drupal.services.map(s => (s.name === 'cli' ? { ...s, volumes: 'uploads:/uploads' } : s)),
  tasks: {
    ...PRESETS.Drupal.tasks,
    postRollout: PRESETS.Drupal.tasks.postRollout.map(t => ({ ...t, weight: '10' })),
  },
  environments: [
    {
      ...PRESETS.Drupal.environments[0],
      cronjobs: [{ ...PRESETS.Drupal.environments[0].cronjobs[0], inPod: 'false', timeout: '1h' }],
      types: [{ service: 'mariadb', type: 'mariadb-dbaas' }],
      overrides: [{ service: 'nginx', image: '', dockerfile: 'lagoon/nginx.prod.dockerfile' }],
      routes: [
        { service: 'nginx', domain: 'example.com', tlsAcme: true, insecure: 'Redirect', hstsEnabled: false, hstsMaxAge: 31536000, monitoringPath: '', annotations: '', alternativeNames: '', wildcard: false, ingressClass: '', pathRoutes: [] },
        {
          service: 'nginx', domain: 'www.example.com', tlsAcme: false, insecure: 'Allow',
          hstsEnabled: true, hstsMaxAge: 31536000, monitoringPath: '/health',
          annotations: 'nginx.ingress.kubernetes.io/permanent-redirect: https://example.com$request_uri',
          alternativeNames: 'example.org, www.example.org', wildcard: false, ingressClass: 'traefik',
          pathRoutes: [{ toService: 'cli', path: '/api' }],
        },
      ],
    },
  ],
});

const files = generateAllFiles(drupal);
const byPath = Object.fromEntries(files.map(f => [f.path, f.content]));

// .lagoon.yml parses and has the documented structure
const lagoon = YAML.parse(byPath['.lagoon.yml']);
assert.equal(lagoon['docker-compose-yaml'], 'docker-compose.yml');
assert.equal(lagoon.environment_variables.git_sha, 'true');
assert.equal(lagoon['backup-schedule'].production, 'M H(22-2) * * *');
assert.equal(lagoon['backup-retention'].production.daily, 7);
assert.equal(lagoon['container-registries']['my-registry'].username, 'bob');
assert.equal(lagoon.tasks['pre-rollout'][0].run.service, 'cli');
assert.equal(lagoon.tasks['post-rollout'][0].run.shell, 'bash');
assert.match(lagoon.tasks['post-rollout'][0].run.command, /drush -y deploy/);
assert.equal(lagoon.environments.main.cronjobs[0].command, 'drush cron');

// routes: list of single-key maps → service → [plain domain | {domain: opts}]
const routes = lagoon.environments.main.routes;
assert.deepEqual(routes[0].nginx[0], 'example.com'); // all-default route collapses to a string
const www = routes[0].nginx[1]['www.example.com'];
assert.equal(www['tls-acme'], false);
assert.equal(www.insecure, 'Allow');
assert.equal(www.hstsEnabled, true);
assert.equal(www['monitoring-path'], '/health');
assert.equal(www.annotations['nginx.ingress.kubernetes.io/permanent-redirect'], 'https://example.com$request_uri');
assert.deepEqual(www.alternativenames, ['example.org', 'www.example.org']);
assert.equal(www.ingressClass, 'traefik');
assert.deepEqual(www.pathRoutes, [{ toService: 'cli', path: '/api' }]);

// newer build-deploy-tool options
assert.equal(lagoon.routes.autogenerate['tls-acme'], false);
assert.equal(lagoon.routes.autogenerate.ingressClass, 'nginx');
assert.deepEqual(lagoon.routes.autogenerate.pathRoutes, [{ fromService: 'nginx', toService: 'cli', path: '/api' }]);
assert.equal(lagoon.tasks['post-rollout'][0].run.weight, 10);
assert.equal(lagoon.tasks['pre-rollout'][0].run.weight, undefined);
assert.equal(lagoon.environments.main.cronjobs[0].inPod, false);
assert.equal(lagoon.environments.main.cronjobs[0].timeout, '1h');
assert.deepEqual(lagoon.environments.main.types, { mariadb: 'mariadb-dbaas' });
assert.deepEqual(lagoon.environments.main.overrides, { nginx: { build: { dockerfile: 'lagoon/nginx.prod.dockerfile' } } });

// docker-compose.yml parses (anchors resolve) and labels are right
const compose = YAML.parse(byPath['docker-compose.yml'], { merge: true });
assert.equal(compose.services.cli.labels['lagoon.type'], 'cli-persistent');
assert.equal(compose.services.php.labels['lagoon.name'], 'nginx');
assert.equal(compose.services.nginx.build.args.CLI_IMAGE, '${COMPOSE_PROJECT_NAME:-my-drupal-project}-cli');
assert.equal(compose.services.nginx.environment.LAGOON_PROJECT, 'my-drupal-project');
assert.ok(compose.services.nginx.volumes.includes('.:/app:delegated'));
assert.equal(compose.services.mariadb.labels['lagoon.type'], 'mariadb');
assert.equal(compose.networks['amazeeio-network'].external, true);

// additional volumes: top-level labels + service path label + local mount (app mount kept)
assert.equal(compose.volumes.uploads.labels['lagoon.type'], 'persistent');
assert.equal(compose.volumes.uploads.labels['lagoon.persistent.size'], '10Gi');
assert.equal(compose.volumes.uploads.labels['lagoon.backup'], 'false');
assert.equal(compose.services.cli.labels['lagoon.volumes.uploads.path'], '/uploads');
assert.deepEqual(compose.services.cli.volumes, ['.:/app:delegated', 'uploads:/uploads']);

// dockerfiles: cli builds from base image, nginx multi-stages from CLI_IMAGE
assert.match(byPath['lagoon/cli.dockerfile'], /FROM uselagoon\/php-8\.5-cli-drupal:latest/);
assert.match(byPath['lagoon/cli.dockerfile'], /RUN composer install --no-dev/);
assert.match(byPath['lagoon/nginx.dockerfile'], /ARG CLI_IMAGE/);
assert.match(byPath['lagoon/nginx.dockerfile'], /COPY --from=cli \/app \/app/);

// round-trip: importing generated files reproduces the form values
import { parseImport } from './importer';
const lagoonImport = parseImport(byPath['.lagoon.yml']);
assert.equal(lagoonImport.kind, '.lagoon.yml');
assert.equal(lagoonImport.warnings.length, 0, lagoonImport.warnings.join('; '));
assert.deepEqual(lagoonImport.project.tasks, drupal.tasks);
assert.deepEqual(lagoonImport.project.environments, drupal.environments);
assert.equal(lagoonImport.project.gitSha, true);
assert.equal(lagoonImport.project.backupsEnabled, true);
assert.deepEqual(lagoonImport.project.backupRetention, drupal.backupRetention);
assert.deepEqual(lagoonImport.project.containerRegistries, drupal.containerRegistries);

const composeImport = parseImport(byPath['docker-compose.yml']);
assert.equal(composeImport.kind, 'docker-compose.yml');
assert.equal(composeImport.warnings.length, 0, composeImport.warnings.join('; '));
assert.equal(composeImport.project.projectName, undefined); // no x-lagoon-project key emitted
assert.deepEqual(composeImport.project.services, drupal.services);
assert.deepEqual(composeImport.project.volumes, drupal.volumes);
assert.equal(lagoonImport.project.autogenerateTlsAcme, false);
assert.deepEqual(lagoonImport.project.autogeneratePathRoutes, drupal.autogeneratePathRoutes);

// redis-persistent on redis ≥ 8 selects the flavor by env; external services carry their target as JSON
const misc = LagoonProjectSchema.parse({
  ...PRESETS['Node.js'],
  services: [
    ...PRESETS['Node.js'].services,
    { name: 'redis', type: 'redis-persistent', image: 'uselagoon/redis-8:latest' },
    { name: 'search', type: 'external', external: { name: 'solr', project: 'shared-search', environment: 'main', domain: '' } },
  ],
});
const miscCompose = YAML.parse(generateAllFiles(misc)[1].content, { merge: true });
assert.equal(miscCompose.services.redis.environment.REDIS_FLAVOR, 'persistent');
assert.equal(miscCompose.services.redis.environment.LAGOON_PROJECT, 'my-node-project');
assert.deepEqual(JSON.parse(miscCompose.services.search.labels['lagoon.external.service']), { name: 'solr', project: 'shared-search', environment: 'main' });
const miscImport = parseImport(generateAllFiles(misc)[1].content);
assert.equal(miscImport.project.services![2].external!.project, 'shared-search');

// validation: names, duplicates, dangling references, Lagoon-rejected combos
const errorsFor = (overrides: object) =>
  (LagoonProjectSchema.safeParse({ ...drupal, ...overrides }).error?.issues ?? []).map(i => i.message);
assert.deepEqual(errorsFor({}), []);
assert.match(errorsFor({ projectName: 'My_Project' })[0], /lowercase/);
assert.match(errorsFor({ services: [...drupal.services, drupal.services[0]] })[0], /Duplicate service "cli"/);
assert.match(errorsFor({ environments: [...drupal.environments, drupal.environments[0]] })[0], /Duplicate environment/);
const renamedCli = drupal.services.map(s => (s.name === 'cli' ? { ...s, name: 'cli2' } : s));
assert.ok(errorsFor({ services: renamedCli }).some(m => m === 'Unknown service "cli"'));
const wildcard = { ...drupal.environments[0].routes[0], wildcard: true };
assert.match(errorsFor({ environments: [{ ...drupal.environments[0], routes: [wildcard] }] })[0], /TLS/);
assert.match(errorsFor({ services: drupal.services.map(s => (s.name === 'mariadb' ? { ...s, volumes: 'uploads:/x' } : s)) })[0], /can't mount/);
assert.match(errorsFor({ services: drupal.services.map(s => (s.name === 'cli' ? { ...s, volumes: 'nope:/x' } : s)) })[0], /Unknown volume/);

// rename: every field naming the service is found
const cliRefs = serviceRefPaths(drupal, 'cli');
assert.ok(cliRefs.includes('tasks.preRollout.0.service'));
assert.ok(cliRefs.includes('environments.0.cronjobs.0.service'));
assert.ok(cliRefs.includes('environments.0.routes.1.pathRoutes.0.toService'));
assert.ok(cliRefs.includes('autogeneratePathRoutes.0.toService'));
assert.ok(!cliRefs.some(p => p.startsWith('services.')), 'service own name must not be rewritten');
assert.ok(serviceRefPaths(drupal, 'nginx').includes('services.2.lagoonName'));

// a minimal project emits no empty sections
const minimal = LagoonProjectSchema.parse(PRESETS.Static);
const staticYml = YAML.parse(generateLagoonYml(minimal));
assert.equal(staticYml.tasks, undefined);
assert.deepEqual(staticYml.routes, { autogenerate: { insecure: 'Redirect' } }); // Lagoon's own default is Allow
assert.equal(staticYml['backup-schedule'], undefined);

console.log('generator self-check passed ✔');
