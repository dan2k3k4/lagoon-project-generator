import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import hljs from 'highlight.js/lib/core';
import yamlLang from 'highlight.js/lib/languages/yaml';
import dockerfileLang from 'highlight.js/lib/languages/dockerfile';
import {
  Plus,
  Trash2,
  Download,
  FileCode,
  ExternalLink,
  Check,
  Copy,
  Layout,
  Settings,
  Zap,
  Globe,
  Activity,
  Route,
  Archive,
  KeyRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { LagoonProject, LagoonProjectInput, LagoonProjectSchema, ServiceType, GeneratedFile, SERVICE_TYPES } from './types';
import { SERVICE_DEFAULTS, PRESETS } from './constants';
import { generateAllFiles } from './generator';
import { parseImport } from './importer';
import LAGOON_IMAGES from './lagoon-images.json';

// validate uselagoon/* images against the Docker Hub snapshot (npm run update-images)
function imageStatus(image?: string): 'ok' | 'unknown' | null {
  const m = (image ?? '').match(/^(?:docker\.io\/)?uselagoon\/([^:@/]+)/);
  if (!m) return null;
  return LAGOON_IMAGES.images.includes(m[1]) ? 'ok' : 'unknown';
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

hljs.registerLanguage('yaml', yamlLang);
hljs.registerLanguage('dockerfile', dockerfileLang);

function CodeView({ path, content }: { path: string; content: string }) {
  const language = path.endsWith('.dockerfile') || path.endsWith('Dockerfile') ? 'dockerfile' : 'yaml';
  const html = hljs.highlight(content, { language }).value;
  return <pre className="whitespace-pre-wrap hljs" dangerouslySetInnerHTML={{ __html: html }} />;
}

const inputCls = 'w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none';
const labelCls = 'block text-[10px] font-mono uppercase tracking-wider opacity-50 mb-1';
const addBtnCls = 'text-[10px] font-mono flex items-center gap-1 opacity-50 hover:opacity-100';
const cardCls = 'bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]';

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-6 border-b border-[#141414]/10 pb-4">
      <div className="flex items-center gap-2">
        <span className="opacity-50">{icon}</span>
        <h2 className="font-serif italic text-lg">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
      <Plus size={12} /> {label}
    </button>
  );
}

export default function App() {
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>('Drupal');
  const [isStale, setIsStale] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LagoonProjectInput, any, LagoonProject>({
    resolver: zodResolver(LagoonProjectSchema),
    defaultValues: PRESETS.Drupal,
    mode: 'onChange',
  });

  const services = useWatch({ control, name: 'services' }) ?? [];
  const serviceNames = services.map(s => s.name);
  const backupsEnabled = useWatch({ control, name: 'backupsEnabled' });
  const autogenerateEnabled = useWatch({ control, name: 'autogenerateEnabled' });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({ control, name: 'services' });
  const { fields: preRolloutFields, append: appendPreRollout, remove: removePreRollout } = useFieldArray({ control, name: 'tasks.preRollout' });
  const { fields: postRolloutFields, append: appendPostRollout, remove: removePostRollout } = useFieldArray({ control, name: 'tasks.postRollout' });
  const { fields: environmentFields, append: appendEnvironment, remove: removeEnvironment } = useFieldArray({ control, name: 'environments' });
  const { fields: registryFields, append: appendRegistry, remove: removeRegistry } = useFieldArray({ control, name: 'containerRegistries' });

  const loadPreset = (name: string) => {
    setPreset(name);
    setImportMsg(null);
    reset(PRESETS[name]);
  };

  // live regeneration: any form change re-renders the files on the right
  useEffect(() => {
    const regenerate = (values: unknown) => {
      const parsed = LagoonProjectSchema.safeParse(values);
      if (parsed.success) {
        const files = generateAllFiles(parsed.data);
        setGeneratedFiles(files);
        setActiveTab(prev => (files.some(f => f.path === prev) ? prev : files[0].path));
      }
      setIsStale(!parsed.success);
    };
    regenerate(watch());
    const subscription = watch(values => regenerate(values));
    return () => subscription.unsubscribe();
  }, [watch]);

  const doImport = () => {
    try {
      const { kind, project, warnings } = parseImport(importText);
      reset({ ...watch(), ...project });
      setImportMsg({ ok: true, text: `Imported ${kind}.${warnings.length ? ' ' + warnings.join(' · ') : ''}` });
    } catch (e: any) {
      setImportMsg({ ok: false, text: e.message });
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    generatedFiles.forEach(file => zip.file(file.path, file.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${watch('projectName')}-lagoon-config.zip`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleServiceTypeChange = (index: number, type: ServiceType) => {
    const defaults = SERVICE_DEFAULTS[type];
    setValue(`services.${index}.type`, type);
    setValue(`services.${index}.image`, defaults.image);
    setValue(`services.${index}.persistent`, defaults.persistent ?? '');
    setValue(`services.${index}.persistentName`, defaults.persistentName ?? '');
    setValue(`services.${index}.buildSteps`, defaults.buildSteps);
  };

  const taskFields = (kind: 'preRollout' | 'postRollout', fields: typeof preRolloutFields, remove: (i: number) => void) =>
    fields.map((field, index) => (
      <div key={field.id} className="p-3 border border-[#141414]/10 rounded-lg space-y-2">
        <div className="flex gap-2">
          <input {...register(`tasks.${kind}.${index}.name`)} placeholder="Name" className={cn(inputCls, 'flex-1 text-[10px]')} />
          <select {...register(`tasks.${kind}.${index}.service`)} className={cn(inputCls, 'flex-1 text-[10px]')}>
            {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" onClick={() => remove(index)} className="p-2 text-red-500"><Trash2 size={12} /></button>
        </div>
        <textarea {...register(`tasks.${kind}.${index}.command`)} placeholder="Command" className={cn(inputCls, 'text-[10px] resize-none')} rows={2} />
        <div className="flex gap-2">
          <input {...register(`tasks.${kind}.${index}.shell`)} placeholder="Shell (e.g. bash)" className={cn(inputCls, 'flex-1 text-[10px]')} />
          <input {...register(`tasks.${kind}.${index}.when`)} placeholder='When (e.g. LAGOON_ENVIRONMENT_TYPE == "production")' className={cn(inputCls, 'flex-[2] text-[10px]')} />
          <input {...register(`tasks.${kind}.${index}.container`)} placeholder="Container" className={cn(inputCls, 'flex-1 text-[10px]')} />
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-full flex items-center justify-center text-[#E4E3E0]">
            <Zap size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase italic font-serif">Lagoon Project Generator</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">Amazee.io Infrastructure Tool</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/lagoon-examples" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono hover:underline">
            <ExternalLink size={16} /> EXAMPLES
          </a>
        </div>
      </header>

      <datalist id="uselagoon-images">
        {LAGOON_IMAGES.images.map(name => <option key={name} value={`uselagoon/${name}:latest`} />)}
      </datalist>

      <main className="max-w-[96rem] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">

          {/* Presets */}
          <div className="flex gap-2">
            {Object.keys(PRESETS).map(name => (
              <button
                key={name}
                type="button"
                onClick={() => loadPreset(name)}
                className={cn(
                  'flex-1 py-2 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[#141414] transition-colors',
                  preset === name ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white hover:bg-[#141414]/5'
                )}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Import existing config */}
          <section className={cardCls}>
            <details>
              <summary className="flex items-center gap-2 cursor-pointer select-none">
                <FileCode size={18} className="opacity-50" />
                <h2 className="font-serif italic text-lg">Import Existing Config</h2>
              </summary>
              <div className="mt-4 space-y-3">
                <p className="text-[10px] font-mono opacity-50 leading-relaxed">
                  Paste an existing .lagoon.yml (tasks, environments, routes, backups, …) or a Lagoon
                  docker-compose.yml (services) and the form updates to match.
                </p>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  placeholder={'docker-compose-yaml: docker-compose.yml\n\ntasks:\n  post-rollout:\n    - run: ...'}
                  className={cn(inputCls, 'resize-y bg-[#f5f5f5]')}
                />
                <button type="button" onClick={doImport} disabled={!importText.trim()} className="w-full bg-[#141414] text-[#E4E3E0] py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-[#333] transition-colors disabled:opacity-30">
                  IMPORT
                </button>
                {importMsg && (
                  <p className={cn('text-[10px] font-mono leading-relaxed', importMsg.ok ? 'text-emerald-600' : 'text-red-500')}>
                    {importMsg.text}
                  </p>
                )}
              </div>
            </details>
          </section>

          {/* Project Core */}
          <section className={cardCls}>
            <SectionHeader icon={<Settings size={18} />} title="Project Core" />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Project Name</label>
                <input {...register('projectName')} className={cn(inputCls, 'p-3 text-sm bg-[#f5f5f5]')} placeholder="e.g. my-awesome-app" />
                {errors.projectName && <p className="text-red-500 text-[10px] font-mono mt-1">{errors.projectName.message}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input type="checkbox" {...register('gitSha')} className="accent-[#141414]" />
                Inject Git SHA (<span className="opacity-50">environment_variables.git_sha</span>)
              </label>
            </div>
          </section>

          {/* Autogenerated Routes */}
          <section className={cardCls}>
            <SectionHeader icon={<Route size={18} />} title="Autogenerated Routes" />
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input type="checkbox" {...register('autogenerateEnabled')} className="accent-[#141414]" />
                Enable autogenerated routes
              </label>
              {!autogenerateEnabled && (
                <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                  <input type="checkbox" {...register('autogenerateAllowPullrequests')} className="accent-[#141414]" />
                  Still allow for pull request environments
                </label>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Insecure Traffic</label>
                  <select {...register('autogenerateInsecure')} className={inputCls}>
                    <option value="Redirect">Redirect</option>
                    <option value="Allow">Allow</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prefixes (comma separated)</label>
                  <input {...register('autogeneratePrefixes')} placeholder="www, de, fr" className={inputCls} />
                </div>
              </div>
            </div>
          </section>

          {/* Backups */}
          <section className={cardCls}>
            <SectionHeader icon={<Archive size={18} />} title="Backups (Production)" />
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input type="checkbox" {...register('backupsEnabled')} className="accent-[#141414]" />
                Customize backup schedule &amp; retention
              </label>
              {backupsEnabled && (
                <>
                  <div>
                    <label className={labelCls}>Schedule (cron, M = random minute)</label>
                    <input {...register('backupSchedule')} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['hourly', 'daily', 'weekly', 'monthly'] as const).map(period => (
                      <div key={period}>
                        <label className={labelCls}>{period}</label>
                        <input type="number" min={0} {...register(`backupRetention.${period}`)} className={inputCls} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Container Registries */}
          <section className={cardCls}>
            <SectionHeader
              icon={<KeyRound size={18} />}
              title="Container Registries"
              action={<AddButton label="ADD REGISTRY" onClick={() => appendRegistry({ name: 'my-registry', url: '', username: '' })} />}
            />
            <div className="space-y-2">
              {registryFields.length === 0 && <p className="text-[10px] font-mono opacity-40">None — public images only.</p>}
              {registryFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <input {...register(`containerRegistries.${index}.name`)} placeholder="Name" className={cn(inputCls, 'flex-1 text-[10px]')} />
                  <input {...register(`containerRegistries.${index}.url`)} placeholder="URL (empty = Docker Hub)" className={cn(inputCls, 'flex-[2] text-[10px]')} />
                  <input {...register(`containerRegistries.${index}.username`)} placeholder="Username" className={cn(inputCls, 'flex-1 text-[10px]')} />
                  <button type="button" onClick={() => removeRegistry(index)} className="p-2 text-red-500"><Trash2 size={12} /></button>
                </div>
              ))}
              {registryFields.length > 0 && (
                <p className="text-[10px] font-mono opacity-40">
                  Set passwords as Lagoon variables: REGISTRY_&lt;NAME&gt;_PASSWORD (scope: container_registry).
                </p>
              )}
            </div>
          </section>

          {/* Services */}
          <section className={cardCls}>
            <SectionHeader
              icon={<Layout size={18} />}
              title="Services"
              action={<AddButton label="ADD SERVICE" onClick={() => appendService({ name: 'new-service', type: 'basic', image: SERVICE_DEFAULTS.basic.image, persistent: '', persistentName: '', persistentSize: '', lagoonName: '', autogeneratedRoute: '', port: '', buildSteps: '' })} />}
            />
            <div className="space-y-4">
              {serviceFields.map((field, index) => (
                <div key={field.id} className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] relative group space-y-3">
                  <button type="button" onClick={() => removeService(index)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={12} /></button>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Name</label>
                      <input {...register(`services.${index}.name`)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Lagoon Type</label>
                      <select
                        value={services[index]?.type}
                        onChange={(e) => handleServiceTypeChange(index, e.target.value as ServiceType)}
                        className={inputCls}
                      >
                        {SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Image</label>
                    <input list="uselagoon-images" {...register(`services.${index}.image`)} className={inputCls} />
                    {imageStatus(services[index]?.image) === 'ok' && (
                      <p className="text-emerald-600 text-[10px] font-mono mt-1 flex items-center gap-1"><Check size={10} /> found on Docker Hub (uselagoon)</p>
                    )}
                    {imageStatus(services[index]?.image) === 'unknown' && (
                      <p className="text-red-500 text-[10px] font-mono mt-1">not found in uselagoon org (snapshot {LAGOON_IMAGES.updated})</p>
                    )}
                  </div>
                  <details>
                    <summary className="text-[10px] font-mono uppercase opacity-50 cursor-pointer select-none">Advanced (optional)</summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-[10px] font-mono opacity-50 leading-relaxed">
                        Empty fields fall back to Lagoon's defaults, which work well for most
                        projects — you usually don't need to change anything here. Increasing
                        storage sizes or persistence can affect hosting costs.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Persistent Path</label>
                          <input {...register(`services.${index}.persistent`)} placeholder="/app/files/" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Persistent Name (share volume of)</label>
                          <input {...register(`services.${index}.persistentName`)} placeholder="nginx" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Persistent Size</label>
                          <input {...register(`services.${index}.persistentSize`)} placeholder="5Gi" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Pod Group (lagoon.name)</label>
                          <input {...register(`services.${index}.lagoonName`)} placeholder="nginx" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Autogenerated Route</label>
                          <select {...register(`services.${index}.autogeneratedRoute`)} className={inputCls}>
                            <option value="">Default</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Port (lagoon.service.port)</label>
                          <input {...register(`services.${index}.port`)} placeholder="3000" className={inputCls} />
                        </div>
                      </div>
                      {SERVICE_DEFAULTS[services[index]?.type ?? 'basic'].build && (
                        <div>
                          <label className={labelCls}>Dockerfile Build Steps (one per line)</label>
                          <textarea {...register(`services.${index}.buildSteps`)} rows={2} className={cn(inputCls, 'resize-none')} />
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>

          {/* Rollout Tasks */}
          <section className={cardCls}>
            <SectionHeader icon={<Activity size={18} />} title="Rollout Tasks" />
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase opacity-50">Pre-Rollout</label>
                  <button type="button" onClick={() => appendPreRollout({ name: '', command: '', service: serviceNames[0] ?? 'cli', container: '', shell: '', when: '' })} className={addBtnCls}><Plus size={10} /> ADD</button>
                </div>
                <div className="space-y-2">{taskFields('preRollout', preRolloutFields, removePreRollout)}</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase opacity-50">Post-Rollout</label>
                  <button type="button" onClick={() => appendPostRollout({ name: '', command: '', service: serviceNames[0] ?? 'cli', container: '', shell: '', when: '' })} className={addBtnCls}><Plus size={10} /> ADD</button>
                </div>
                <div className="space-y-2">{taskFields('postRollout', postRolloutFields, removePostRollout)}</div>
              </div>
            </div>
          </section>

          {/* Environments */}
          <section className={cardCls}>
            <SectionHeader
              icon={<Globe size={18} />}
              title="Environments"
              action={<AddButton label="ADD ENV" onClick={() => appendEnvironment({ name: 'new-env', autogenerateRoutes: '', cronjobs: [], routes: [] })} />}
            />
            <div className="space-y-6">
              {environmentFields.map((field, envIndex) => (
                <div key={field.id} className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <input {...register(`environments.${envIndex}.name`)} className="bg-transparent border-b border-[#141414] font-bold font-serif italic focus:outline-none flex-1" />
                    <select {...register(`environments.${envIndex}.autogenerateRoutes`)} className={cn(inputCls, 'w-auto text-[10px]')} title="autogenerateRoutes override">
                      <option value="">auto-routes: inherit</option>
                      <option value="true">auto-routes: true</option>
                      <option value="false">auto-routes: false</option>
                    </select>
                    <button type="button" onClick={() => removeEnvironment(envIndex)} className="text-red-500"><Trash2 size={14} /></button>
                  </div>

                  {/* Routes */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-mono uppercase opacity-50">Custom Routes</label>
                      <button
                        type="button"
                        onClick={() => setValue(`environments.${envIndex}.routes`, [
                          ...(watch(`environments.${envIndex}.routes`) || []),
                          { service: serviceNames[0] ?? 'nginx', domain: '', tlsAcme: true, insecure: 'Redirect', hstsEnabled: false, hstsMaxAge: 31536000, monitoringPath: '', annotations: '' },
                        ])}
                        className={addBtnCls}
                      >
                        <Plus size={10} /> ADD ROUTE
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(watch(`environments.${envIndex}.routes`) || []).map((_route, routeIndex) => (
                        <div key={routeIndex} className="p-2 border border-[#141414]/5 rounded space-y-2 bg-white">
                          <div className="flex gap-2">
                            <select {...register(`environments.${envIndex}.routes.${routeIndex}.service`)} className={cn(inputCls, 'flex-1 text-[10px]')}>
                              {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <input {...register(`environments.${envIndex}.routes.${routeIndex}.domain`)} placeholder="www.example.com" className={cn(inputCls, 'flex-[2] text-[10px]')} />
                            <button
                              type="button"
                              onClick={() => setValue(`environments.${envIndex}.routes`, (watch(`environments.${envIndex}.routes`) || []).filter((_, i) => i !== routeIndex))}
                              className="text-red-500"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                          <details>
                            <summary className="text-[10px] font-mono uppercase opacity-40 cursor-pointer select-none">Route options (optional)</summary>
                            <div className="mt-2 space-y-2">
                              <p className="text-[10px] font-mono opacity-50 leading-relaxed">
                                The defaults (TLS via Let's Encrypt, HTTP redirected to HTTPS) are right for most sites.
                              </p>
                              <div className="flex gap-4 items-center">
                                <label className="flex items-center gap-1 text-[10px] font-mono cursor-pointer">
                                  <input type="checkbox" {...register(`environments.${envIndex}.routes.${routeIndex}.tlsAcme`)} className="accent-[#141414]" /> TLS (Let's Encrypt)
                                </label>
                                <label className="flex items-center gap-1 text-[10px] font-mono cursor-pointer">
                                  <input type="checkbox" {...register(`environments.${envIndex}.routes.${routeIndex}.hstsEnabled`)} className="accent-[#141414]" /> HSTS
                                </label>
                                <select {...register(`environments.${envIndex}.routes.${routeIndex}.insecure`)} className={cn(inputCls, 'w-auto text-[10px]')}>
                                  <option value="Redirect">HTTP: Redirect</option>
                                  <option value="Allow">HTTP: Allow</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={labelCls}>HSTS Max Age</label>
                                  <input type="number" {...register(`environments.${envIndex}.routes.${routeIndex}.hstsMaxAge`)} className={cn(inputCls, 'text-[10px]')} />
                                </div>
                                <div>
                                  <label className={labelCls}>Monitoring Path</label>
                                  <input {...register(`environments.${envIndex}.routes.${routeIndex}.monitoringPath`)} placeholder="/health" className={cn(inputCls, 'text-[10px]')} />
                                </div>
                              </div>
                              <div>
                                <label className={labelCls}>Ingress Annotations (key: value, one per line)</label>
                                <textarea {...register(`environments.${envIndex}.routes.${routeIndex}.annotations`)} rows={2} placeholder={'nginx.ingress.kubernetes.io/permanent-redirect: https://www.example.com$request_uri'} className={cn(inputCls, 'text-[10px] resize-none')} />
                              </div>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cronjobs */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-mono uppercase opacity-50">Cronjobs</label>
                      <button
                        type="button"
                        onClick={() => setValue(`environments.${envIndex}.cronjobs`, [
                          ...(watch(`environments.${envIndex}.cronjobs`) || []),
                          { name: '', schedule: 'M * * * *', command: '', service: serviceNames[0] ?? 'cli' },
                        ])}
                        className={addBtnCls}
                      >
                        <Plus size={10} /> ADD CRON
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(watch(`environments.${envIndex}.cronjobs`) || []).map((_cron, cronIndex) => (
                        <div key={cronIndex} className="p-2 border border-[#141414]/5 rounded space-y-2 bg-white">
                          <div className="flex gap-2">
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.name`)} placeholder="Name" className={cn(inputCls, 'flex-1 text-[10px]')} />
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.schedule`)} placeholder="M * * * * (M = random minute)" className={cn(inputCls, 'flex-1 text-[10px]')} />
                            <button
                              type="button"
                              onClick={() => setValue(`environments.${envIndex}.cronjobs`, (watch(`environments.${envIndex}.cronjobs`) || []).filter((_, i) => i !== cronIndex))}
                              className="text-red-500"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.command`)} placeholder="Command" className={cn(inputCls, 'flex-[2] text-[10px]')} />
                            <select {...register(`environments.${envIndex}.cronjobs.${cronIndex}.service`)} className={cn(inputCls, 'flex-1 text-[10px]')}>
                              {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-28">
          <div className="bg-[#282c34] rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)] min-h-[600px] h-[calc(100vh-13rem)] flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {generatedFiles.length > 0 ? (
                  generatedFiles.map(file => (
                    <button key={file.path} onClick={() => setActiveTab(file.path)} className={cn('px-4 py-1.5 rounded-full text-[10px] font-mono transition-all whitespace-nowrap', activeTab === file.path ? 'bg-[#E4E3E0] text-[#141414]' : 'text-white/50 hover:text-white hover:bg-white/10')}>
                      {file.path}
                    </button>
                  ))
                ) : (
                  <div className="text-white/30 text-[10px] font-mono py-1.5 italic">No files generated yet...</div>
                )}
              </div>
              {isStale && (
                <span className="text-amber-400/80 text-[10px] font-mono whitespace-nowrap px-3" title="The form has validation errors; showing the last valid output.">
                  ⚠ fix form errors
                </span>
              )}
              {generatedFiles.length > 0 && (
                <button onClick={downloadZip} className="flex items-center gap-2 bg-[#E4E3E0] text-[#141414] px-4 py-1.5 rounded-full text-[10px] font-bold hover:scale-105 transition-transform whitespace-nowrap">
                  <Download size={14} /> DOWNLOAD ALL (.ZIP)
                </button>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {generatedFiles.length > 0 ? (
                  <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0 p-6 overflow-auto font-mono text-sm text-[#abb2bf] leading-relaxed custom-scrollbar">
                    <div className="absolute top-4 right-4 z-10">
                      <button onClick={() => copyToClipboard(generatedFiles.find(f => f.path === activeTab)?.content || '', activeTab)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white" title="Copy to clipboard">
                        {copySuccess === activeTab ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <CodeView path={activeTab} content={generatedFiles.find(f => f.path === activeTab)?.content || ''} />
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 p-12 text-center">
                    <FileCode size={64} className="mb-4 opacity-10" />
                    <h3 className="font-serif italic text-xl mb-2">Ready to Build</h3>
                    <p className="text-sm max-w-xs">Pick a preset or import an existing config — the generated files update here in real time as you edit.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            <a href="https://docs.lagoon.sh/" target="_blank" rel="noopener noreferrer" className="bg-white/50 p-4 rounded-xl border border-[#141414]/10 hover:border-[#141414] transition-all group">
              <h4 className="text-[10px] font-mono uppercase opacity-50 mb-1">Documentation</h4>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold">Lagoon Docs</span>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
            <a href="https://github.com/uselagoon/lagoon" target="_blank" rel="noopener noreferrer" className="bg-white/50 p-4 rounded-xl border border-[#141414]/10 hover:border-[#141414] transition-all group">
              <h4 className="text-[10px] font-mono uppercase opacity-50 mb-1">Open Source</h4>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold">Lagoon Core</span>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
            <a href="https://www.amazee.io/" target="_blank" rel="noopener noreferrer" className="bg-white/50 p-4 rounded-xl border border-[#141414]/10 hover:border-[#141414] transition-all group">
              <h4 className="text-[10px] font-mono uppercase opacity-50 mb-1">Hosting</h4>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold">Amazee.io</span>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#141414] px-6 py-3 bg-white/50 backdrop-blur-sm sticky bottom-0 z-50">
        <p className="text-xs font-mono opacity-70 leading-relaxed text-center max-w-[96rem] mx-auto">
          Always review the generated files before deploying — this tool can make mistakes, and
          some option combinations may be incompatible with your project or Lagoon cluster.
        </p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}
