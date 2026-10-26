from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""<button type=\"button\" onClick={() => saveScene().then(() => toast.success('Shoot scene saved')).catch((error) => toast.error(error.message))} className=\"flex items-center gap-2 border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold\"><Save size={14} /> Save</button>"""
new="""<button type=\"button\" onClick={() => (step === 'edit' ? saveEditor() : saveScene().then(() => toast.success('Shoot scene saved')).catch((error) => toast.error(error.message)))} className=\"flex items-center gap-2 border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold\"><Save size={14} /> Save</button>"""
if old not in t: raise SystemExit('top Save button not found')
t=t.replace(old,new,1)
old2="""<button type=\"button\" onClick={saveEditor} className=\"bg-white/10 px-4 py-2 text-xs font-black\"><Save size={14} className=\"mr-1 inline\" /> Save Edit</button>"""
if old2 not in t: raise SystemExit('Save Edit button not found')
t=t.replace(old2,'',1)
p.write_text(t)
