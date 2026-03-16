import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  Zap
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
  LagoonExample
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
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'services',
  });

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
      {/* Header */}
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
          <a 
            href="https://github.com/lagoon-examples" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-mono hover:underline"
          >
            <Github size={16} />
            EXAMPLES
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-2 mb-6 border-b border-[#141414]/10 pb-4">
              <Settings size={18} className="opacity-50" />
              <h2 className="font-serif italic text-lg">Project Core</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-1 opacity-50">Project Name</label>
                <input 
                  {...register('projectName')}
                  className="w-full bg-[#f5f5f5] border border-[#141414] p-3 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10"
                  placeholder="e.g. my-awesome-app"
                />
                {errors.projectName && <p className="text-red-500 text-[10px] mt-1 font-mono">{errors.projectName.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider mb-2 opacity-50">Quick Start Templates</label>
                <div className="grid grid-cols-1 gap-2">
                  {isLoadingExamples ? (
                    <div className="animate-pulse h-10 bg-[#f5f5f5] rounded-lg" />
                  ) : (
                    examples.slice(0, 4).map(example => (
                      <button
                        key={example.name}
                        type="button"
                        onClick={() => {
                          // Simple template application logic
                          if (example.name.includes('drupal')) {
                            setValue('projectName', example.name);
                            // Could add more complex template logic here
                          }
                        }}
                        className="text-left p-3 rounded-lg border border-[#141414]/10 hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold font-mono">{example.name}</span>
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[10px] opacity-60 line-clamp-1 mt-1">{example.description}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-6 border-b border-[#141414]/10 pb-4">
              <div className="flex items-center gap-2">
                <Layout size={18} className="opacity-50" />
                <h2 className="font-serif italic text-lg">Services</h2>
              </div>
              <button 
                type="button"
                onClick={() => append({ name: 'new-service', type: 'cli', image: SERVICE_DEFAULTS.cli.image, buildSteps: [], customConfig: {}, customFiles: [] })}
                className="flex items-center gap-1 text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded-full hover:scale-105 transition-transform"
              >
                <Plus size={12} /> ADD SERVICE
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={field.id} 
                    className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] relative group"
                  >
                    <button 
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Trash2 size={12} />
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Name</label>
                        <input 
                          {...register(`services.${index}.name`)}
                          className="w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Type</label>
                        <select 
                          {...register(`services.${index}.type`)}
                          onChange={(e) => handleServiceTypeChange(index, e.target.value as ServiceType)}
                          className="w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none"
                        >
                          {Object.keys(SERVICE_DEFAULTS).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Docker Image</label>
                      <input 
                        {...register(`services.${index}.image`)}
                        className="w-full bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono focus:border-[#141414] outline-none"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Build Steps (One per line)</label>
                      <textarea 
                        rows={2}
                        placeholder="e.g. composer install"
                        className="w-full bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono focus:border-[#141414] outline-none resize-none"
                        onChange={(e) => {
                          const steps = e.target.value.split('\n').filter(s => s.trim());
                          setValue(`services.${index}.buildSteps`, steps);
                        }}
                        defaultValue={field.buildSteps.join('\n')}
                      />
                    </div>

                    <div className="mt-3">
                      <label className="block text-[10px] font-mono uppercase opacity-50 mb-1">Custom Config Files (e.g. redirects-map.conf)</label>
                      <div className="space-y-2">
                        {(field.customFiles || []).map((file, fileIndex) => (
                          <div key={fileIndex} className="flex gap-2 items-start">
                            <input 
                              placeholder="Filename"
                              className="flex-1 bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono focus:border-[#141414] outline-none"
                              defaultValue={file.name}
                              onChange={(e) => {
                                const newFiles = [...(field.customFiles || [])];
                                newFiles[fileIndex].name = e.target.value;
                                setValue(`services.${index}.customFiles`, newFiles);
                              }}
                            />
                            <textarea 
                              placeholder="Content"
                              rows={1}
                              className="flex-[2] bg-white border border-[#141414]/20 p-2 rounded text-[10px] font-mono focus:border-[#141414] outline-none resize-none"
                              defaultValue={file.content}
                              onChange={(e) => {
                                const newFiles = [...(field.customFiles || [])];
                                newFiles[fileIndex].content = e.target.value;
                                setValue(`services.${index}.customFiles`, newFiles);
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const newFiles = (field.customFiles || []).filter((_, i) => i !== fileIndex);
                                setValue(`services.${index}.customFiles`, newFiles);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          type="button"
                          onClick={() => {
                            const newFiles = [...(field.customFiles || []), { name: '', content: '' }];
                            setValue(`services.${index}.customFiles`, newFiles);
                          }}
                          className="text-[10px] font-mono text-[#141414] opacity-50 hover:opacity-100 flex items-center gap-1"
                        >
                          <Plus size={10} /> ADD CONFIG FILE
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <button 
                type="submit"
                className="w-full bg-[#141414] text-[#E4E3E0] py-4 rounded-xl font-bold tracking-widest uppercase hover:bg-[#333] transition-colors flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
              >
                <FileCode size={20} /> GENERATE CONFIGURATION
              </button>
            </form>
          </section>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-7">
          <div className="bg-[#141414] rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)] min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {generatedFiles.length > 0 ? (
                  generatedFiles.map(file => (
                    <button
                      key={file.path}
                      onClick={() => setActiveTab(file.path)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[10px] font-mono transition-all whitespace-nowrap",
                        activeTab === file.path 
                          ? "bg-[#E4E3E0] text-[#141414]" 
                          : "text-white/50 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {file.path}
                    </button>
                  ))
                ) : (
                  <div className="text-white/30 text-[10px] font-mono py-1.5 italic">No files generated yet...</div>
                )}
              </div>
              
              {generatedFiles.length > 0 && (
                <button 
                  onClick={downloadZip}
                  className="flex items-center gap-2 bg-[#E4E3E0] text-[#141414] px-4 py-1.5 rounded-full text-[10px] font-bold hover:scale-105 transition-transform"
                >
                  <Download size={14} /> DOWNLOAD ALL (.ZIP)
                </button>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {generatedFiles.length > 0 ? (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 p-6 overflow-auto font-mono text-sm text-emerald-400/90 leading-relaxed custom-scrollbar"
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        onClick={() => copyToClipboard(generatedFiles.find(f => f.path === activeTab)?.content || '', activeTab)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        title="Copy to clipboard"
                      >
                        {copySuccess === activeTab ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap">
                      {generatedFiles.find(f => f.path === activeTab)?.content}
                    </pre>
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

            {/* Terminal-like Footer */}
            <div className="p-3 bg-black/40 border-t border-white/5 font-mono text-[10px] text-white/40 flex justify-between">
              <div className="flex gap-4">
                <span>STATUS: {generatedFiles.length > 0 ? 'READY' : 'IDLE'}</span>
                <span>FILES: {generatedFiles.length}</span>
              </div>
              <div className="flex gap-4">
                <span>UTF-8</span>
                <span>YAML/DOCKER</span>
              </div>
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
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
