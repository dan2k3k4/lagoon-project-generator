import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const inputCls = 'w-full bg-white border border-[#141414]/20 p-2 rounded text-xs font-mono focus:border-[#141414] outline-none';
export const labelCls = 'block text-[10px] font-mono uppercase tracking-wider opacity-50 mb-1';
export const addBtnCls = 'text-[10px] font-mono flex items-center gap-1 opacity-50 hover:opacity-100';
export const cardCls = 'bg-white border border-[#141414] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]';
export const hintCls = 'text-[10px] font-mono opacity-50 leading-relaxed';

export function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
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

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-3 py-1.5 rounded-full hover:scale-105 transition-transform">
      <Plus size={12} /> {label}
    </button>
  );
}

export function SmallAdd({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={addBtnCls}>
      <Plus size={10} /> {label}
    </button>
  );
}

export function RemoveButton({ onClick, size = 10 }: { onClick: () => void; size?: number }) {
  return (
    <button type="button" onClick={onClick} className="p-1 text-red-500" title="Remove">
      <Trash2 size={size} />
    </button>
  );
}

export function ServiceSelect({ names, ...props }: { names: string[] } & React.ComponentProps<'select'>) {
  return (
    <select {...props} className={cn(inputCls, 'flex-1 text-[10px]', props.className)}>
      {names.map(name => <option key={name} value={name}>{name}</option>)}
    </select>
  );
}
