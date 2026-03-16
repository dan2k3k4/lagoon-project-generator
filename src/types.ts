import { z } from 'zod';

export const ServiceTypeSchema = z.enum([
  'cli',
  'cli-persistent',
  'nginx',
  'nginx-php-persistent',
  'php',
  'mariadb',
  'postgres',
  'opensearch',
  'redis',
  'solr',
  'varnish',
  'node',
  'python',
]);

export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const LagoonTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  command: z.string().min(1, 'Command is required'),
  service: z.string().min(1, 'Service is required'),
  shell: z.string().optional(),
  when: z.string().optional(),
});

export type LagoonTask = z.infer<typeof LagoonTaskSchema>;

export const LagoonCronjobSchema = z.object({
  name: z.string().min(1, 'Cronjob name is required'),
  schedule: z.string().min(1, 'Schedule is required'),
  command: z.string().min(1, 'Command is required'),
  service: z.string().min(1, 'Service is required'),
});

export type LagoonCronjob = z.infer<typeof LagoonCronjobSchema>;

export const LagoonEnvironmentSchema = z.object({
  name: z.string().min(1, 'Environment name is required'),
  cronjobs: z.array(LagoonCronjobSchema).default([]),
  routes: z.array(z.object({
    service: z.string(),
    hosts: z.array(z.string()),
  })).default([]),
});

export type LagoonEnvironment = z.infer<typeof LagoonEnvironmentSchema>;

export const LagoonServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  type: ServiceTypeSchema,
  image: z.string().optional(),
  persistent: z.string().optional(),
  persistentName: z.string().optional(),
  buildSteps: z.array(z.string()),
  customConfig: z.record(z.string(), z.string()),
  customFiles: z.array(z.object({
    name: z.string(),
    content: z.string(),
  })),
});

export type LagoonService = z.infer<typeof LagoonServiceSchema>;

export const LagoonProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  services: z.array(LagoonServiceSchema).min(1, 'At least one service is required'),
  tasks: z.object({
    preRollout: z.array(LagoonTaskSchema).default([]),
    postRollout: z.array(LagoonTaskSchema).default([]),
  }).default({ preRollout: [], postRollout: [] }),
  environments: z.array(LagoonEnvironmentSchema).default([]),
});

export type LagoonProject = z.infer<typeof LagoonProjectSchema>;

export interface GeneratedFile {
  name: string;
  content: string;
  path: string;
}

export interface LagoonExample {
  name: string;
  description: string;
  html_url: string;
}
