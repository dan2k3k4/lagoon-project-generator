import YAML from 'yaml';
import { LagoonProject, LagoonProjectInput, LagoonRoute, LagoonService, LagoonTask, ServiceType, SERVICE_TYPES } from './types';
import { SERVICE_DEFAULTS } from './constants';

export interface ImportResult {
  kind: '.lagoon.yml' | 'docker-compose.yml';
  project: Partial<LagoonProjectInput>;
  warnings: string[];
}

const str = (v: any) => (v == null ? '' : String(v));
const bool = (v: any) => v === true || v === 'true';

function parseTask(entry: any): LagoonTask | null {
  const run = entry?.run;
  if (!run?.name || !run?.command || !run?.service) return null;
  return {
    name: str(run.name),
    command: str(run.command),
    service: str(run.service),
    container: str(run.container),
    shell: str(run.shell),
    when: str(run.when),
  };
}

function parseRoutes(routes: any[], warnings: string[]): LagoonRoute[] {
  const result: LagoonRoute[] = [];
  for (const item of routes ?? []) {
    if (typeof item !== 'object' || item === null) continue;
    for (const [service, domains] of Object.entries(item)) {
      for (const domain of (domains as any[]) ?? []) {
        const route: LagoonRoute = {
          service,
          domain: '',
          tlsAcme: true,
          insecure: 'Redirect',
          hstsEnabled: false,
          hstsMaxAge: 31536000,
          monitoringPath: '',
          annotations: '',
        };
        if (typeof domain === 'string') {
          route.domain = domain;
        } else if (typeof domain === 'object' && domain !== null) {
          const [name, opts] = Object.entries(domain)[0] as [string, any];
          route.domain = name;
          if (opts && typeof opts === 'object') {
            if ('tls-acme' in opts) route.tlsAcme = bool(opts['tls-acme']);
            if (opts.insecure === 'Allow') route.insecure = 'Allow';
            if (bool(opts.hstsEnabled)) route.hstsEnabled = true;
            if (opts.hstsMaxAge) route.hstsMaxAge = Number(opts.hstsMaxAge);
            // deprecated string form: hsts: max-age=31536000
            const legacyHsts = /max-age=(\d+)/.exec(str(opts.hsts));
            if (legacyHsts) {
              route.hstsEnabled = true;
              route.hstsMaxAge = Number(legacyHsts[1]);
            }
            route.monitoringPath = str(opts['monitoring-path']);
            if (opts.annotations && typeof opts.annotations === 'object') {
              route.annotations = Object.entries(opts.annotations).map(([k, v]) => `${k}: ${v}`).join('\n');
            }
            const known = ['tls-acme', 'insecure', 'hstsEnabled', 'hstsMaxAge', 'hstsPreload', 'hstsIncludeSubdomains', 'hsts', 'monitoring-path', 'annotations'];
            Object.keys(opts).filter(k => !known.includes(k)).forEach(k => warnings.push(`route ${name}: option "${k}" not supported by this form, dropped`));
          }
        }
        if (route.domain) result.push(route);
      }
    }
  }
  return result;
}

function parseLagoonYml(doc: any, warnings: string[]): Partial<LagoonProjectInput> {
  const project: Partial<LagoonProjectInput> = {};

  if (doc.project) project.projectName = str(doc.project);
  if (bool(doc.environment_variables?.git_sha)) project.gitSha = true;

  const auto = doc.routes?.autogenerate;
  if (auto) {
    if ('enabled' in auto) project.autogenerateEnabled = bool(auto.enabled);
    if ('allowPullrequests' in auto) project.autogenerateAllowPullrequests = bool(auto.allowPullrequests);
    if (auto.insecure === 'Allow') project.autogenerateInsecure = 'Allow';
    if (Array.isArray(auto.prefixes)) project.autogeneratePrefixes = auto.prefixes.join(', ');
  }

  if (doc['backup-schedule']?.production || doc['backup-retention']?.production) {
    project.backupsEnabled = true;
    if (doc['backup-schedule']?.production) project.backupSchedule = str(doc['backup-schedule'].production);
    const r = doc['backup-retention']?.production;
    if (r) {
      project.backupRetention = {
        hourly: Number(r.hourly ?? 0),
        daily: Number(r.daily ?? 7),
        weekly: Number(r.weekly ?? 6),
        monthly: Number(r.monthly ?? 0),
      };
    }
  }

  if (doc['container-registries'] && typeof doc['container-registries'] === 'object') {
    project.containerRegistries = Object.entries(doc['container-registries']).map(([name, reg]: [string, any]) => ({
      name,
      url: str(reg?.url),
      username: str(reg?.username),
    }));
  }

  if (doc.tasks) {
    project.tasks = {
      preRollout: (doc.tasks['pre-rollout'] ?? []).map(parseTask).filter(Boolean) as LagoonTask[],
      postRollout: (doc.tasks['post-rollout'] ?? []).map(parseTask).filter(Boolean) as LagoonTask[],
    };
  }

  if (doc.environments && typeof doc.environments === 'object') {
    project.environments = Object.entries(doc.environments).map(([name, env]: [string, any]) => ({
      name,
      autogenerateRoutes: 'autogenerateRoutes' in (env ?? {}) ? (bool(env.autogenerateRoutes) ? 'true' as const : 'false' as const) : '' as const,
      cronjobs: (env?.cronjobs ?? []).map((c: any) => ({
        name: str(c.name), schedule: str(c.schedule), command: str(c.command), service: str(c.service),
      })),
      routes: parseRoutes(env?.routes, warnings),
    }));
  }

  const known = ['docker-compose-yaml', 'project', 'environment_variables', 'routes', 'backup-schedule', 'backup-retention', 'container-registries', 'tasks', 'environments', 'api', 'ssh'];
  Object.keys(doc).filter(k => !known.includes(k)).forEach(k => warnings.push(`top-level key "${k}" not supported by this form, dropped`));

  return project;
}

// docker-compose labels may be a map or a list of "key=value" strings
function labelMap(labels: any): Record<string, string> {
  if (Array.isArray(labels)) {
    return Object.fromEntries(labels.map((l: string) => {
      const idx = str(l).indexOf('=');
      return [str(l).slice(0, idx), str(l).slice(idx + 1)];
    }));
  }
  return labels && typeof labels === 'object' ? labels : {};
}

const LEGACY_TYPES: Record<string, ServiceType> = { mongo: 'mongodb', 'mongo-single': 'mongodb-single' };

function parseDockerCompose(doc: any, warnings: string[]): Partial<LagoonProjectInput> {
  const project: Partial<LagoonProjectInput> = {};
  if (typeof doc['x-lagoon-project'] === 'string') project.projectName = doc['x-lagoon-project'];

  const services: LagoonService[] = [];
  for (const [name, svc] of Object.entries<any>(doc.services ?? {})) {
    const labels = labelMap(svc?.labels);
    const rawType = str(labels['lagoon.type']);
    if (!rawType) {
      warnings.push(`service "${name}" has no lagoon.type label, skipped`);
      continue;
    }
    const type = (SERVICE_TYPES as readonly string[]).includes(rawType) ? rawType as ServiceType : LEGACY_TYPES[rawType];
    if (!type) {
      warnings.push(`service "${name}": unknown lagoon.type "${rawType}", skipped`);
      continue;
    }
    const defaults = SERVICE_DEFAULTS[type];
    // with a build config, the compose image is just a local tag — use the type's base image;
    // for nginx-php pairs, lagoon.name marks the php container grouped into the nginx pod
    const isPhpOfPair = type.startsWith('nginx-php') && !!labels['lagoon.name'];
    const fallback = isPhpOfPair ? 'uselagoon/php-8.4-fpm:latest' : defaults.image;
    const image = !svc.build && str(svc.image).includes('/') ? str(svc.image) : fallback;
    services.push({
      name,
      type,
      image,
      persistent: str(labels['lagoon.persistent'] ?? defaults.persistent ?? ''),
      persistentName: str(labels['lagoon.persistent.name'] ?? ''),
      persistentSize: str(labels['lagoon.persistent.size'] ?? ''),
      lagoonName: str(labels['lagoon.name'] ?? ''),
      autogeneratedRoute: bool(labels['lagoon.autogeneratedroute']) ? 'true' : (labels['lagoon.autogeneratedroute'] != null ? 'false' : ''),
      port: str(labels['lagoon.service.port'] ?? ''),
      buildSteps: defaults.buildSteps,
    });
  }
  if (services.length > 0) project.services = services;
  return project;
}

export function parseImport(text: string): ImportResult {
  let doc: any;
  try {
    doc = YAML.parse(text, { merge: true });
  } catch (e: any) {
    throw new Error(`YAML parse error: ${e.message}`);
  }
  if (!doc || typeof doc !== 'object') throw new Error('Not a YAML mapping.');

  const warnings: string[] = [];
  const looksLikeCompose = doc.services && Object.values<any>(doc.services).some(s => labelMap(s?.labels)['lagoon.type']);
  if (looksLikeCompose) {
    return { kind: 'docker-compose.yml', project: parseDockerCompose(doc, warnings), warnings };
  }
  if (doc['docker-compose-yaml'] || doc.environments || doc.tasks || doc.project) {
    return { kind: '.lagoon.yml', project: parseLagoonYml(doc, warnings), warnings };
  }
  throw new Error('Could not recognize this as a .lagoon.yml or a Lagoon docker-compose.yml.');
}
