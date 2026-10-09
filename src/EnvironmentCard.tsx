import { Control, UseFormRegister, useFieldArray } from 'react-hook-form';
import { LagoonProject, LagoonProjectInput, SERVICE_TYPES } from './types';
import { cn, inputCls, labelCls, hintCls, SmallAdd, RemoveButton, ServiceSelect } from './ui';

type Form = { control: Control<LagoonProjectInput, any, LagoonProject>; register: UseFormRegister<LagoonProjectInput> };
const small = cn(inputCls, 'text-[10px]');
const rowCls = 'p-2 border border-[#141414]/5 rounded space-y-2 bg-white';

function PathRoutes({ control, register, envIndex, routeIndex, serviceNames }: Form & { envIndex: number; routeIndex: number; serviceNames: string[] }) {
  const { fields, append, remove } = useFieldArray({ control, name: `environments.${envIndex}.routes.${routeIndex}.pathRoutes` });
  return (
    <div>
      <div className="flex justify-between items-center">
        <label className={labelCls}>Path Routes (send a path to another service)</label>
        <SmallAdd label="ADD PATH" onClick={() => append({ toService: serviceNames[0] ?? '', path: '/' })} />
      </div>
      {fields.map((field, i) => (
        <div key={field.id} className="flex gap-2 mt-1">
          <input {...register(`environments.${envIndex}.routes.${routeIndex}.pathRoutes.${i}.path`)} placeholder="/api" className={cn(small, 'flex-1')} />
          <ServiceSelect names={serviceNames} {...register(`environments.${envIndex}.routes.${routeIndex}.pathRoutes.${i}.toService`)} />
          <RemoveButton onClick={() => remove(i)} />
        </div>
      ))}
    </div>
  );
}

export function EnvironmentCard({ control, register, envIndex, serviceNames, onRemove }: Form & { envIndex: number; serviceNames: string[]; onRemove: () => void }) {
  const env = `environments.${envIndex}` as const;
  const routes = useFieldArray({ control, name: `${env}.routes` });
  const cronjobs = useFieldArray({ control, name: `${env}.cronjobs` });
  const types = useFieldArray({ control, name: `${env}.types` });
  const overrides = useFieldArray({ control, name: `${env}.overrides` });
  const firstService = serviceNames[0] ?? '';

  return (
    <div className="p-4 border border-[#141414] rounded-xl bg-[#fcfcfc] space-y-4">
      <div className="flex justify-between items-center gap-4">
        <input {...register(`${env}.name`)} className="bg-transparent border-b border-[#141414] font-bold font-serif italic focus:outline-none flex-1" />
        <select {...register(`${env}.autogenerateRoutes`)} className={cn(inputCls, 'w-auto text-[10px]')} title="autogenerateRoutes override">
          <option value="">auto-routes: inherit</option>
          <option value="true">auto-routes: true</option>
          <option value="false">auto-routes: false</option>
        </select>
        <RemoveButton onClick={onRemove} size={14} />
      </div>

      {/* Routes */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-mono uppercase opacity-50">Custom Routes</label>
          <SmallAdd
            label="ADD ROUTE"
            onClick={() => routes.append({
              service: firstService, domain: '', tlsAcme: true, insecure: 'Redirect', hstsEnabled: false, hstsMaxAge: 31536000,
              monitoringPath: '', annotations: '', alternativeNames: '', wildcard: false, ingressClass: '', pathRoutes: [],
            })}
          />
        </div>
        <div className="space-y-2">
          {routes.fields.map((field, r) => {
            const route = `${env}.routes.${r}` as const;
            return (
              <div key={field.id} className={rowCls}>
                <div className="flex gap-2">
                  <ServiceSelect names={serviceNames} {...register(`${route}.service`)} />
                  <input {...register(`${route}.domain`)} placeholder="www.example.com" className={cn(small, 'flex-[2]')} />
                  <RemoveButton onClick={() => routes.remove(r)} />
                </div>
                <details>
                  <summary className="text-[10px] font-mono uppercase opacity-40 cursor-pointer select-none">Route options (optional)</summary>
                  <div className="mt-2 space-y-2">
                    <p className={hintCls}>The defaults (TLS via Let's Encrypt, HTTP redirected to HTTPS) are right for most sites.</p>
                    <div className="flex flex-wrap gap-4 items-center">
                      <label className="flex items-center gap-1 text-[10px] font-mono cursor-pointer">
                        <input type="checkbox" {...register(`${route}.tlsAcme`)} className="accent-[#141414]" /> TLS (Let's Encrypt)
                      </label>
                      <label className="flex items-center gap-1 text-[10px] font-mono cursor-pointer">
                        <input type="checkbox" {...register(`${route}.hstsEnabled`)} className="accent-[#141414]" /> HSTS
                      </label>
                      <label className="flex items-center gap-1 text-[10px] font-mono cursor-pointer" title="*.domain — needs your own certificate (TLS off), no alternative names">
                        <input type="checkbox" {...register(`${route}.wildcard`)} className="accent-[#141414]" /> Wildcard
                      </label>
                      <select {...register(`${route}.insecure`)} className={cn(inputCls, 'w-auto text-[10px]')}>
                        <option value="Redirect">HTTP: Redirect</option>
                        <option value="Allow">HTTP: Allow</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>HSTS Max Age</label>
                        <input type="number" {...register(`${route}.hstsMaxAge`)} className={small} />
                      </div>
                      <div>
                        <label className={labelCls}>Monitoring Path</label>
                        <input {...register(`${route}.monitoringPath`)} placeholder="/health" className={small} />
                      </div>
                      <div>
                        <label className={labelCls}>Alternative Names (comma separated)</label>
                        <input {...register(`${route}.alternativeNames`)} placeholder="example.com, www.example.org" className={small} />
                      </div>
                      <div>
                        <label className={labelCls}>Ingress Class</label>
                        <input {...register(`${route}.ingressClass`)} placeholder="cluster default" className={small} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Ingress Annotations (key: value, one per line)</label>
                      <textarea {...register(`${route}.annotations`)} rows={2} placeholder={'nginx.ingress.kubernetes.io/permanent-redirect: https://www.example.com$request_uri'} className={cn(small, 'resize-none')} />
                    </div>
                    <PathRoutes control={control} register={register} envIndex={envIndex} routeIndex={r} serviceNames={serviceNames} />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cronjobs */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-mono uppercase opacity-50">Cronjobs</label>
          <SmallAdd label="ADD CRON" onClick={() => cronjobs.append({ name: '', schedule: 'M * * * *', command: '', service: firstService, inPod: '', timeout: '' })} />
        </div>
        <div className="space-y-2">
          {cronjobs.fields.map((field, c) => {
            const cron = `${env}.cronjobs.${c}` as const;
            return (
              <div key={field.id} className={rowCls}>
                <div className="flex gap-2">
                  <input {...register(`${cron}.name`)} placeholder="Name" className={cn(small, 'flex-1')} />
                  <input {...register(`${cron}.schedule`)} placeholder="M * * * * (M = random minute)" className={cn(small, 'flex-1')} />
                  <RemoveButton onClick={() => cronjobs.remove(c)} />
                </div>
                <div className="flex gap-2">
                  <input {...register(`${cron}.command`)} placeholder="Command" className={cn(small, 'flex-[2]')} />
                  <ServiceSelect names={serviceNames} {...register(`${cron}.service`)} />
                </div>
                <div className="flex gap-2">
                  <select {...register(`${cron}.inPod`)} className={cn(small, 'flex-1')} title="In-pod crons run inside the service container; native crons get their own pod">
                    <option value="">mode: auto (in-pod if every ≤30m)</option>
                    <option value="true">mode: in-pod</option>
                    <option value="false">mode: native CronJob</option>
                  </select>
                  <input {...register(`${cron}.timeout`)} placeholder="Timeout (default 4h, max 24h)" className={cn(small, 'flex-1')} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-environment overrides */}
      <details>
        <summary className="text-[10px] font-mono uppercase opacity-50 cursor-pointer select-none">Service overrides for this environment (optional)</summary>
        <div className="mt-3 space-y-3">
          <div>
            <div className="flex justify-between items-center">
              <label className={labelCls}>Type overrides</label>
              <SmallAdd label="ADD TYPE" onClick={() => types.append({ service: firstService, type: 'none' })} />
            </div>
            {types.fields.map((field, t) => (
              <div key={field.id} className="flex gap-2 mt-1">
                <ServiceSelect names={serviceNames} {...register(`${env}.types.${t}.service`)} />
                <select {...register(`${env}.types.${t}.type`)} className={cn(small, 'flex-1')}>
                  {SERVICE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <RemoveButton onClick={() => types.remove(t)} />
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between items-center">
              <label className={labelCls}>Image / Dockerfile overrides</label>
              <SmallAdd label="ADD OVERRIDE" onClick={() => overrides.append({ service: firstService, image: '', dockerfile: '' })} />
            </div>
            {overrides.fields.map((field, o) => (
              <div key={field.id} className="flex gap-2 mt-1">
                <ServiceSelect names={serviceNames} {...register(`${env}.overrides.${o}.service`)} />
                <input {...register(`${env}.overrides.${o}.image`)} placeholder="image" className={cn(small, 'flex-1')} />
                <input {...register(`${env}.overrides.${o}.dockerfile`)} placeholder="or dockerfile" className={cn(small, 'flex-1')} />
                <RemoveButton onClick={() => overrides.remove(o)} />
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
