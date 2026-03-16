import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Plus, 
  Trash2, 
  Download, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Github, 
  ExternalLink,
  Check,
  Copy,
  Layout,
  Settings,
  Zap,
  Clock,
  Globe,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  LagoonProject, 
  LagoonProjectSchema, 
  LagoonService, 
  ServiceType, 
  GeneratedFile,
  LagoonExample,
  LagoonTask,
  LagoonCronjob,
  LagoonEnvironment
} from './types';
import { SERVICE_DEFAULTS, LAGOON_EXAMPLES_ORG } from './constants';
import { generateAllFiles } from './generator';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [examples, setExamples] = useState<LagoonExample[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LagoonProject>({
    resolver: zodResolver(LagoonProjectSchema),
    defaultValues: {
      projectName: 'my-lagoon-project',
      services: [
        { name: 'cli', type: 'cli', image: SERVICE_DEFAULTS.cli.image, buildSteps: SERVICE_DEFAULTS.cli.buildSteps, customConfig: {}, customFiles: [] },
        { name: 'nginx', type: 'nginx', image: SERVICE_DEFAULTS.nginx.image, buildSteps: SERVICE_DEFAULTS.nginx.buildSteps, customConfig: {}, customFiles: [] },
        { name: 'php', type: 'php', image: SERVICE_DEFAULTS.php.image, buildSteps: SERVICE_DEFAULTS.php.buildSteps, customConfig: {}, customFiles: [] },
      ],
      tasks: {
        preRollout: [
          { name: 'drush status', command: 'drush status || echo "Drush Status did not complete successfully"', service: 'cli' }
        ],
        postRollout: [
          { name: 'drush updb', command: 'if [[ $(drush status --field=Database) == "Connected" ]]; then drush -y updb; fi', service: 'cli', shell: 'bash' },
          { name: 'drush cr', command: 'if [[ $(drush status --field=Database) == "Connected" ]]; then drush -y cr; fi', service: 'cli', shell: 'bash' }
        ]
      },
      environments: [
        { 
          name: 'main', 
          cronjobs: [
            { name: 'drush hourly cron', schedule: 'M * * * *', command: 'drush cron', service: 'cli' }
          ],
          routes: []
        }
      ]
    },
  });

  const services = useWatch({ control, name: 'services' });
  const serviceNames = services.map(s => s.name);

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({ control, name: 'services' });
  const { fields: preRolloutFields, append: appendPreRollout, remove: removePreRollout } = useFieldArray({ control, name: 'tasks.preRollout' });
  const { fields: postRolloutFields, append: appendPostRollout, remove: removePostRollout } = useFieldArray({ control, name: 'tasks.postRollout' });
  const { fields: environmentFields, append: appendEnvironment, remove: removeEnvironment } = useFieldArray({ control, name: 'environments' });

  useEffect(() => {
    async function fetchExamples() {
      setIsLoadingExamples(true);
      try {
        const response = await fetch(`https://api.github.com/orgs/${LAGOON_EXAMPLES_ORG}/repos?sort=stars&direction=desc`);
        if (response.ok) {
          const data = await response.json();
          setExamples(data.map((repo: any) => ({
            name: repo.name,
            description: repo.description,
            html_url: repo.html_url
          })));
        }
      } catch (error) {
        console.error('Failed to fetch examples:', error);
      } finally {
        setIsLoadingExamples(false);
      }
    }
    fetchExamples();
  }, []);

  const onSubmit = (data: LagoonProject) => {
    const files = generateAllFiles(data);
    setGeneratedFiles(files);
    setActiveTab(files[0].path);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    generatedFiles.forEach(file => {
      zip.file(file.path, file.content);
    });
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
    if (defaults) {
      setValue(`services.${index}.image`, defaults.image);
      setValue(`services.${index}.buildSteps`, defaults.buildSteps);
      if (defaults.persistent) {
        setValue(`services.${index}.persistent`, defaults.persistent);
      }
    }
  };

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
            <Github size={16} /> EXAMPLES
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#141414]/10 pb-4">
              <Settings size={18} className="opacity-50" />
              <h2 className="font-serif italic text-lg">Project Core</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-1 opacity-50">Project Name</label>
                <input {...register('projectName')} className="w-full bg-[#f5f5f5] border border-[#141414] p-3 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10" placeholder="e.g. my-awesome-app" />
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-6 border-b border-[#141414]/10 pb-4">
              <div className="flex items-center gap-2">
                <Layout size={18} className="opacity-50" />
                <h2 className="font-serif italic text-lg">Services</h2>
              </div>
              <button type="button" onClick={() => appendService({ name: 'new-service', type: 'cli', image: SERVICE_DEFAULTS.cli.image, buildSteps: [], customConfig: {}, customFiles: [] })} className="flex items-center gap-1 text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
                <Plus size={12} /> ADD SERVICE
              </button>
            </div>
            <div className="space-y-4">
              {serviceFields.map((field, index) => (
                <div key={field.id} className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] relative group">
                  <button type="button" onClick={() => removeService(index)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 size={12} /></button>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Name</label>
                      <input {...register(`services.${index}.name`)} className="w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Type</label>
                      <select {...register(`services.${index}.type`)} onChange={(e) => handleServiceTypeChange(index, e.target.value as ServiceType)} className="w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none">
                        {Object.keys(SERVICE_DEFAULTS).map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#141414]/10 pb-4">
              <Activity size={18} className="opacity-50" />
              <h2 className="font-serif italic text-lg">Rollout Tasks</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase opacity-50">Pre-Rollout</label>
                  <button type="button" onClick={() => appendPreRollout({ name: '', command: '', service: 'cli' })} className="text-[10px] font-mono flex items-center gap-1 opacity-50 hover:opacity-100"><Plus size={10} /> ADD</button>
                </div>
                <div className="space-y-2">
                  {preRolloutFields.map((field, index) => (
                    <div key={field.id} className="p-3 border border-[#141414]/10 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <input {...register(`tasks.preRollout.${index}.name`)} placeholder="Name" className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono" />
                        <select {...register(`tasks.preRollout.${index}.service`)} className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono">
                          {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button type="button" onClick={() => removePreRollout(index)} className="p-2 text-red-500"><Trash2 size={12} /></button>
                      </div>
                      <textarea {...register(`tasks.preRollout.${index}.command`)} placeholder="Command" className="w-full bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono resize-none" rows={2} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-mono uppercase opacity-50">Post-Rollout</label>
                  <button type="button" onClick={() => appendPostRollout({ name: '', command: '', service: 'cli' })} className="text-[10px] font-mono flex items-center gap-1 opacity-50 hover:opacity-100"><Plus size={10} /> ADD</button>
                </div>
                <div className="space-y-2">
                  {postRolloutFields.map((field, index) => (
                    <div key={field.id} className="p-3 border border-[#141414]/10 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <input {...register(`tasks.postRollout.${index}.name`)} placeholder="Name" className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono" />
                        <select {...register(`tasks.postRollout.${index}.service`)} className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono">
                          {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button type="button" onClick={() => removePostRollout(index)} className="p-2 text-red-500"><Trash2 size={12} /></button>
                      </div>
                      <textarea {...register(`tasks.postRollout.${index}.command`)} placeholder="Command" className="w-full bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono resize-none" rows={2} />
                      <div className="flex gap-2">
                        <input {...register(`tasks.postRollout.${index}.shell`)} placeholder="Shell (e.g. bash)" className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono" />
                        <input {...register(`tasks.postRollout.${index}.when`)} placeholder="When (e.g. branch==main)" className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-6 border-b border-[#141414]/10 pb-4">
              <div className="flex items-center gap-2">
                <Globe size={18} className="opacity-50" />
                <h2 className="font-serif italic text-lg">Environments</h2>
              </div>
              <button type="button" onClick={() => appendEnvironment({ name: 'new-env', cronjobs: [], routes: [] })} className="flex items-center gap-1 text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
                <Plus size={12} /> ADD ENV
              </button>
            </div>
            <div className="space-y-6">
              {environmentFields.map((field, envIndex) => (
                <div key={field.id} className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] space-y-4">
                  <div className="flex justify-between items-center">
                    <input {...register(`environments.${envIndex}.name`)} className="bg-transparent border-b border-[#141414] font-bold font-serif italic focus:outline-none" />
                    <button type="button" onClick={() => removeEnvironment(envIndex)} className="text-red-500"><Trash2 size={14} /></button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-mono uppercase opacity-50">Cronjobs</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const envs = watch('environments');
                          const newCronjobs = [...(envs[envIndex].cronjobs || []), { name: '', schedule: '', command: '', service: 'cli' }];
                          setValue(`environments.${envIndex}.cronjobs`, newCronjobs);
                        }} 
                        className="text-[10px] font-mono flex items-center gap-1 opacity-50 hover:opacity-100"
                      >
                        <Plus size={10} /> ADD CRON
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(watch(`environments.${envIndex}.cronjobs`) || []).map((cron, cronIndex) => (
                        <div key={cronIndex} className="p-2 border border-[#141414]/5 rounded space-y-2 bg-white">
                          <div className="flex gap-2">
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.name`)} placeholder="Name" className="flex-1 text-[10px] font-mono border-b" />
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.schedule`)} placeholder="Schedule" className="flex-1 text-[10px] font-mono border-b" />
                            <button 
                              type="button" 
                              onClick={() => {
                                const cronjobs = watch(`environments.${envIndex}.cronjobs`).filter((_, i) => i !== cronIndex);
                                setValue(`environments.${envIndex}.cronjobs`, cronjobs);
                              }} 
                              className="text-red-500"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input {...register(`environments.${envIndex}.cronjobs.${cronIndex}.command`)} placeholder="Command" className="flex-[2] text-[10px] font-mono border-b" />
                            <select {...register(`environments.${envIndex}.cronjobs.${cronIndex}.service`)} className="flex-1 text-[10px] font-mono border-b bg-transparent">
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

          <form onSubmit={handleSubmit(onSubmit)}>
            <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-bold tracking-widest uppercase hover:bg-[#333] transition-colors flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
              <FileCode size={20} /> GENERATE CONFIGURATION
            </button>
          </form>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-[#141414] rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)] min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {generatedFiles.length > 0 ? (
                  generatedFiles.map(file => (
                    <button key={file.path} onClick={() => setActiveTab(file.path)} className={cn("px-4 py-1.5 rounded-full text-[10px] font-mono transition-all whitespace-nowrap", activeTab === file.path ? "bg-[#E4E3E0] text-[#141414]" : "text-white/50 hover:text-white hover:bg-white/10")}>
                      {file.path}
                    </button>
                  ))
                ) : (
                  <div className="text-white/30 text-[10px] font-mono py-1.5 italic">No files generated yet...</div>
                )}
              </div>
              {generatedFiles.length > 0 && (
                <button onClick={downloadZip} className="flex items-center gap-2 bg-[#E4E3E0] text-[#141414] px-4 py-1.5 rounded-full text-[10px] font-bold hover:scale-105 transition-transform">
                  <Download size={14} /> DOWNLOAD ALL (.ZIP)
                </button>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {generatedFiles.length > 0 ? (
                  <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0 p-6 overflow-auto font-mono text-sm text-emerald-400/90 leading-relaxed custom-scrollbar">
                    <div className="absolute top-4 right-4 z-10">
                      <button onClick={() => copyToClipboard(generatedFiles.find(f => f.path === activeTab)?.content || '', activeTab)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white" title="Copy to clipboard">
                        {copySuccess === activeTab ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap">{generatedFiles.find(f => f.path === activeTab)?.content}</pre>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 p-12 text-center">
                    <FileCode size={64} className="mb-4 opacity-10" />
                    <h3 className="font-serif italic text-xl mb-2">Ready to Build</h3>
                    <p className="text-sm max-w-xs">Configure your services on the left and click generate to see your Lagoon configuration files.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Docs Quick Links */}
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
      </main>

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
