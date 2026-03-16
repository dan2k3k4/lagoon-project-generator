import { ServiceType } from './types';

export const SERVICE_DEFAULTS: Record<ServiceType, {
  image: string;
  persistent?: string;
  buildSteps: string[];
}> = {
  cli: {
    image: 'uselagoon/php-8.3-cli-drupal:latest',
    buildSteps: ['composer install --no-dev'],
  },
  'cli-persistent': {
    image: 'uselagoon/php-8.3-cli-drupal:latest',
    persistent: '/app/web/sites/default/files',
    buildSteps: ['composer install --no-dev'],
  },
  nginx: {
    image: 'uselagoon/nginx-drupal:latest',
    buildSteps: [],
  },
  'nginx-php-persistent': {
    image: 'uselagoon/nginx-drupal:latest',
    persistent: '/app/web/sites/default/files',
    buildSteps: [],
  },
  php: {
    image: 'uselagoon/php-8.3-fpm:latest',
    buildSteps: [],
  },
  mariadb: {
    image: 'uselagoon/mariadb-10.11-drupal:latest',
    buildSteps: [],
  },
  postgres: {
    image: 'uselagoon/postgres-15-drupal:latest',
    buildSteps: [],
  },
  opensearch: {
    image: 'uselagoon/opensearch-2:latest',
    buildSteps: [],
  },
  redis: {
    image: 'uselagoon/redis-7:latest',
    buildSteps: [],
  },
  solr: {
    image: 'uselagoon/solr-9-drupal:latest',
    buildSteps: [],
  },
  varnish: {
    image: 'uselagoon/varnish-7:latest',
    buildSteps: [],
  },
  node: {
    image: 'uselagoon/node-20:latest',
    buildSteps: ['npm install'],
  },
  python: {
    image: 'uselagoon/python-3.11:latest',
    buildSteps: ['pip install -r requirements.txt'],
  },
};

export const LAGOON_EXAMPLES_ORG = 'lagoon-examples';
