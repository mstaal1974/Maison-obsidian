import { Activity, AlertTriangle, BarChart3, Boxes, Download, FlaskConical, LayoutDashboard, Moon, Package, Search, Sparkles, Tags, Upload, Users } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  ['Intelligence', [['Dashboard', LayoutDashboard], ['Search', Search], ['Analytics', BarChart3]]],
  ['Library', [['Brands', Tags], ['Fragrances', FlaskConical], ['Notes & accords', Sparkles], ['Products', Package], ['Clone relationships', Boxes]]],
  ['Operations', [['Imports', Upload], ['Validation', AlertTriangle]]],
] as const;
const fragrances = [
  ['Midnight Archive', 'Maison Obsidian', 'Woody Amber', '0.94', 'Verified'],
  ['Salted Iris', 'Atelier North', 'Floral Marine', '0.89', 'Verified'],
  ['Black Fig No. 7', 'Vesper House', 'Fruity Woody', '0.86', 'Review'],
  ['Cedar Static', 'Studio Sillage', 'Woody Aromatic', '0.83', 'Verified'],
];

export function App() {
  const [active, setActive] = useState('Dashboard');
  return <div className="min-h-screen bg-[#090b0e] text-stone-200">
    <aside className="fixed inset-y-0 w-64 border-r border-white/8 bg-[#0d1014] p-5">
      <div className="mb-9 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-amber-300/30 bg-amber-200/8 text-amber-200">MO</div><div><b className="font-serif tracking-wide text-white">Maison Obsidian</b><p className="text-[10px] uppercase tracking-[.24em] text-stone-500">Intelligence</p></div></div>
      {navigation.map(([section, links]) => <div className="mb-7" key={section}><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-stone-600">{section}</p>{links.map(([label, Icon]) => <button onClick={()=>setActive(label)} key={label} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active===label?'bg-amber-200/10 text-amber-100':'text-stone-400 hover:bg-white/5 hover:text-white'}`}><Icon size={16}/>{label}</button>)}</div>)}
      <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs text-stone-500"><div className="mb-1 flex items-center gap-2 text-emerald-400"><Activity size={13}/> API operational</div>Model mofip-v1 · PostgreSQL</div>
    </aside>
    <main className="ml-64 min-h-screen">
      <header className="flex h-20 items-center justify-between border-b border-white/8 px-9"><div><h1 className="font-serif text-2xl text-white">{active}</h1><p className="text-xs text-stone-500">Fragrance knowledge operations</p></div><div className="flex items-center gap-3"><button className="icon"><Moon size={17}/></button><button className="flex items-center gap-2 rounded-lg bg-amber-200 px-4 py-2 text-sm font-semibold text-stone-950"><Upload size={16}/> Import data</button><div className="grid size-9 place-items-center rounded-full bg-stone-700 text-xs">AM</div></div></header>
      <section className="p-9">
        <div className="mb-8 grid grid-cols-4 gap-4">{[['Fragrances','12,842','+184 this month'],['Brands','684','92% verified'],['Scentprints','38,109','+12.4%'],['Data quality','96.8%','14 open issues']].map(([a,b,c],i)=><div className="card" key={a}><div className="flex justify-between"><span className="text-xs uppercase tracking-wider text-stone-500">{a}</span><span className={`size-2 rounded-full ${i===3?'bg-amber-300':'bg-emerald-400'}`}/></div><p className="mt-5 font-serif text-3xl text-white">{b}</p><p className="mt-1 text-xs text-stone-500">{c}</p></div>)}</div>
        <div className="grid grid-cols-[1.6fr_1fr] gap-5">
          <div className="card"><div className="mb-6 flex items-center justify-between"><div><h2>Vector coverage</h2><p>Knowledge base completion by dimension</p></div><button className="icon"><Download size={16}/></button></div><div className="flex h-48 items-end gap-3 border-b border-white/10">{[58,72,45,83,68,91,54,78,64,87,70,82].map((x,i)=><div key={i} className="group flex-1 rounded-t bg-gradient-to-t from-amber-500/20 to-amber-200/80" style={{height:`${x}%`}} title={`${x}%`}/>)}</div><div className="mt-3 flex justify-between text-[10px] uppercase text-stone-600"><span>Warm</span><span>Marine</span><span>Floral</span><span>Longevity</span></div></div>
          <div className="card"><h2>Intelligence status</h2><p>Pipeline health across platform services</p>{[['Vector engine','12,610 / 12,842',98],['Clone graph','4,219 relationships',76],['Taxonomy','2,804 mapped terms',89],['Product links','18,401 active',93]].map(([a,b,c])=><div className="mt-5" key={a as string}><div className="mb-2 flex justify-between text-xs"><span>{a}</span><span className="text-stone-500">{b}</span></div><div className="h-1 rounded bg-white/5"><div className="h-full rounded bg-amber-200" style={{width:`${c}%`}}/></div></div>)}</div>
        </div>
        <div className="card mt-5"><div className="mb-5 flex justify-between"><div><h2>Recently enriched fragrances</h2><p>Latest records processed by the intelligence pipeline</p></div><div className="relative"><Search className="absolute left-3 top-2.5 text-stone-600" size={15}/><input placeholder="Search library" className="rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-200/40"/></div></div><table className="w-full text-left text-sm"><thead className="border-b border-white/8 text-[10px] uppercase tracking-widest text-stone-600"><tr>{['Fragrance','Brand','Family','Vector match','Status'].map(x=><th className="pb-3 font-medium" key={x}>{x}</th>)}</tr></thead><tbody>{fragrances.map(r=><tr className="border-b border-white/[.04]" key={r[0]}>{r.map((x,i)=><td className={`py-4 ${i===0?'font-medium text-white':''}`} key={x}>{i===4?<span className={`rounded-full px-2 py-1 text-xs ${x==='Review'?'bg-amber-300/10 text-amber-200':'bg-emerald-400/10 text-emerald-300'}`}>{x}</span>:x}</td>)}</tr>)}</tbody></table></div>
      </section>
    </main>
  </div>
}
