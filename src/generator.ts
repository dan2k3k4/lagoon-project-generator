import { LagoonProject, GeneratedFile } from './types';
import YAML from 'yaml';

export function generateLagoonYml(project: LagoonProject): string {
  const config = {
    dockerComposeYaml: 'docker-compose.yml',
    project: project.projectName,
    environments: {
      master: {
        routes: project.services
          .filter(s => s.type.includes('nginx') || s.type === 'node')
          .map(s => ({
            [s.name]: [
              {
                annotations: {
                  'nginx.ingress.kubernetes.io/proxy-body-size': '20M',
                },
                hosts: [`${project.projectName}.example.com`],
              },
            ],
          })),
      },
    },
  };

  return `# .lagoon.yml\n${YAML.stringify(config)}`;
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
