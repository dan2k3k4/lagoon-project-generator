import { LagoonProject, GeneratedFile, LagoonTask } from './types';
import YAML from 'yaml';

function formatTask(task: LagoonTask) {
  const result: any = {
    run: {
      name: task.name,
      command: task.command,
      service: task.service,
    }
  };
  if (task.shell) result.run.shell = task.shell;
  if (task.when) result.run.when = task.when;
  return result;
}

export function generateLagoonYml(project: LagoonProject): string {
  const config: any = {
    'docker-compose-yaml': 'docker-compose.yml',
    project: project.projectName,
  };

  if (project.tasks && (project.tasks.preRollout.length > 0 || project.tasks.postRollout.length > 0)) {
    config.tasks = {};
    if (project.tasks.preRollout.length > 0) {
      config.tasks['pre-rollout'] = project.tasks.preRollout.map(formatTask);
    }
    if (project.tasks.postRollout.length > 0) {
      config.tasks['post-rollout'] = project.tasks.postRollout.map(formatTask);
    }
  }

  if (project.environments && project.environments.length > 0) {
    config.environments = {};
    project.environments.forEach(env => {
      const envConfig: any = {};
      
      if (env.cronjobs && env.cronjobs.length > 0) {
        envConfig.cronjobs = env.cronjobs.map(cron => ({
          name: cron.name,
          schedule: cron.schedule,
          command: cron.command,
          service: cron.service,
        }));
      }

      if (env.routes && env.routes.length > 0) {
        envConfig.routes = env.routes.map(route => ({
          [route.service]: route.hosts.map(host => ({ hosts: [host] }))
        }));
      }

      if (Object.keys(envConfig).length > 0) {
        config.environments[env.name] = envConfig;
      }
    });
  }

  // Use YAML.stringify with options to control spacing if needed, 
  // but for strict spacing between sections we might still need some manual adjustment
  let output = YAML.stringify(config, { blockQuote: 'literal' });
  
  // Add spacing between top-level sections
  output = output.replace(/\n([a-z].*):/g, '\n\n$1:');
  
  return output.trim();
}

export function generateDockerCompose(project: LagoonProject): string {
  const services: any = {};
  const volumes: any = {};

  // Add default volumes if needed
  const hasPersistent = project.services.some(s => s.persistent);
  if (hasPersistent) {
    volumes['files'] = {};
  }

  project.services.forEach(service => {
    const serviceConfig: any = {
      labels: {
        'lagoon.type': service.type,
      },
    };

    if (service.persistent) {
      serviceConfig.labels['lagoon.persistent'] = service.persistent;
      if (service.persistentName) {
        serviceConfig.labels['lagoon.persistent.name'] = service.persistentName;
      }
    }

    // Determine if it needs a build or just an image
    const needsBuild = ['cli', 'cli-persistent', 'nginx', 'php', 'node', 'python'].includes(service.type);

    if (needsBuild) {
      serviceConfig.build = {
        context: '.',
        dockerfile: `.lagoon/${service.name}.Dockerfile`,
      };
      if (service.type === 'nginx' || service.type === 'php') {
        serviceConfig.build.args = {
          CLI_IMAGE: `\${COMPOSE_PROJECT_NAME:-${project.projectName}}-cli`,
        };
      }
      serviceConfig.image = `\${COMPOSE_PROJECT_NAME:-${project.projectName}}-${service.name}`;
    } else {
      serviceConfig.image = service.image || 'uselagoon/placeholder:latest';
    }

    // Common environment
    serviceConfig.environment = {
      LAGOON_PROJECT: project.projectName,
      LAGOON_ROUTE: `http://\${COMPOSE_PROJECT_NAME:-${project.projectName}}.docker.amazee.io`,
    };

    services[service.name] = serviceConfig;
  });

  const config = {
    version: '3.7',
    services,
    volumes,
    networks: {
      amazeeio_network: {
        external: true,
      },
      default: {
        driver: 'bridge',
      },
    },
  };

  return `# docker-compose.yml\n${YAML.stringify(config)}`;
}

export function generateDockerfile(service: any): string {
  const baseImage = service.image || 'uselagoon/php-8.3-cli-drupal:latest';
  
  let content = `FROM ${baseImage}\n\n`;
  
  if (service.buildSteps && service.buildSteps.length > 0) {
    content += `RUN ${service.buildSteps.join(' && ')}\n\n`;
  }

  content += `COPY . /app\n`;
  
  return content;
}

export function generateAllFiles(project: LagoonProject): GeneratedFile[] {
  const files: GeneratedFile[] = [
    {
      name: '.lagoon.yml',
      path: '.lagoon.yml',
      content: generateLagoonYml(project),
    },
    {
      name: 'docker-compose.yml',
      path: 'docker-compose.yml',
      content: generateDockerCompose(project),
    },
  ];

  project.services.forEach(service => {
    const needsDockerfile = ['cli', 'cli-persistent', 'nginx', 'php', 'node', 'python'].includes(service.type);
    if (needsDockerfile) {
      files.push({
        name: `${service.name}.Dockerfile`,
        path: `.lagoon/${service.name}.Dockerfile`,
        content: generateDockerfile(service),
      });
    }

    if (service.customFiles && service.customFiles.length > 0) {
      service.customFiles.forEach(file => {
        files.push({
          name: file.name,
          path: `.lagoon/${service.name}/${file.name}`,
          content: file.content,
        });
      });
    }
  });

  return files;
}
