// Self-check: `npm test` — asserts the generator emits valid, correctly-shaped Lagoon YAML.
import assert from 'node:assert';
import YAML from 'yaml';
import { generateAllFiles, generateLagoonYml } from './generator';
import { PRESETS } from './constants';
import { LagoonProjectSchema } from './types';

const drupal = LagoonProjectSchema.parse({
  ...PRESETS.Drupal,
  backupsEnabled: true,
  gitSha: true,
  containerRegistries: [{ name: 'my-registry', url: 'registry.example.com', username: 'bob' }],
  environments: [
    {
      ...PRESETS.Drupal.environments[0],
      routes: [
        { service: 'nginx', domain: 'example.com', tlsAcme: true, insecure: 'Redirect', hstsEnabled: false, hstsMaxAge: 31536000 },
        {
          service: 'nginx', domain: 'www.example.com', tlsAcme: false, insecure: 'Allow',
          hstsEnabled: true, hstsMaxAge: 31536000, monitoringPath: '/health',
          annotations: 'nginx.ingress.kubernetes.io/permanent-redirect: https://example.com$request_uri',
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

// docker-compose.yml parses (anchors resolve) and labels are right
const compose = YAML.parse(byPath['docker-compose.yml'], { merge: true });
assert.equal(compose.services.cli.labels['lagoon.type'], 'cli-persistent');
assert.equal(compose.services.php.labels['lagoon.name'], 'nginx');
assert.equal(compose.services.nginx.build.args.CLI_IMAGE, '${COMPOSE_PROJECT_NAME:-my-drupal-project}-cli');
assert.equal(compose.services.nginx.environment.LAGOON_PROJECT, 'my-drupal-project');
assert.ok(compose.services.nginx.volumes.includes('.:/app:delegated'));
assert.equal(compose.services.mariadb.labels['lagoon.type'], 'mariadb');
assert.equal(compose.networks['amazeeio-network'].external, true);

// dockerfiles: cli builds from base image, nginx multi-stages from CLI_IMAGE
assert.match(byPath['lagoon/cli.dockerfile'], /FROM uselagoon\/php-8\.3-cli-drupal:latest/);
assert.match(byPath['lagoon/cli.dockerfile'], /RUN composer install --no-dev/);
assert.match(byPath['lagoon/nginx.dockerfile'], /ARG CLI_IMAGE/);
assert.match(byPath['lagoon/nginx.dockerfile'], /COPY --from=cli \/app \/app/);

// a minimal project emits no empty sections
const minimal = LagoonProjectSchema.parse(PRESETS.Static);
const staticYml = YAML.parse(generateLagoonYml(minimal));
assert.equal(staticYml.tasks, undefined);
assert.equal(staticYml.routes, undefined);
assert.equal(staticYml['backup-schedule'], undefined);

console.log('generator self-check passed ✔');
