from pathlib import Path
p=Path('src/components/studio/VaultPickerModal.jsx')
t=p.read_text()
t=t.replace("export default function VaultPickerModal({ userEmail, onSelect, onClose, allowUpload = false, embedded = false }) {", "export default function VaultPickerModal({ userEmail, onSelect, onClose, allowUpload = false, embedded = false, mediaType = 'image' }) {")
t=t.replace("  const images = vaultAssets.filter(a => a.media_type === 'image');\n  const unfiledImages = images.filter(a => !a.folder_id);", "  const assets = vaultAssets.filter(a => a.media_type === mediaType);\n  const unfiledAssets = assets.filter(a => !a.folder_id);")
t=t.replace("{unfiledImages.length > 0 && (", "{unfiledAssets.length > 0 && (")
t=t.replace("Unfiled ({unfiledImages.length})", "Unfiled ({unfiledAssets.length})")
t=t.replace("{unfiledImages.map(asset => (", "{unfiledAssets.map(asset => (")
t=t.replace("onClick={() => onSelect(asset.url)}", "onClick={() => onSelect(asset.url, asset.name)}")
t=t.replace("<img src={asset.url} alt={asset.name} className=\"w-full h-full object-cover\" />", "{mediaType === 'audio' ? <div className=\"flex h-full w-full items-center justify-center px-3 text-center text-xs font-bold text-white\">{asset.name || 'Audio'}</div> : <img src={asset.url} alt={asset.name} className=\"w-full h-full object-cover\" />}")
t=t.replace("const folderImages = images.filter(a => a.folder_id === folder.id);", "const folderImages = assets.filter(a => a.folder_id === folder.id);")
p.write_text(t)

p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""    if (target.type === 'shot-reference') {\n      setShotPlan((items) => items.map((shot) => {\n        if (shot.id !== target.shotId) return shot;\n        const currentRefs = Array.isArray(shot.shot_references) ? shot.shot_references : [];\n        const baseReferenceCount = (setReference.url ? 1 : 0) + shotCast(shot).filter((member) => member.reference_url).length;\n        if (baseReferenceCount + currentRefs.length >= 7) return shot;\n        return { ...shot, shot_references: [...currentRefs, { id: crypto.randomUUID(), name: name || `Shot reference ${currentRefs.length + 1}`, url }] };\n      }));\n    }\n"""
new=old+"    if (target.type === 'music') setEditMusic((value) => ({ ...value, url, name: name || 'Vault music' }));\n"
if old not in t: raise SystemExit('apply target block not found')
t=t.replace(old,new,1)
old="""<label className=\"cursor-pointer bg-white/10 px-3 py-2 text-xs font-bold\"><Upload size={12} className=\"mr-1 inline\" /> Add Music<input type=\"file\" accept=\"audio/*\" className=\"hidden\" onChange={(event) => uploadEditorMusic(event.target.files?.[0])} /></label>"""
new=old+"<button type=\"button\" onClick={() => { setPickerTarget({ type: 'music' }); setShowVaultPicker(true); }} className=\"bg-white/10 px-3 py-2 text-xs font-bold\"><Folder size={12} className=\"mr-1 inline\" /> Vault</button>"
if old not in t: raise SystemExit('music button block not found')
t=t.replace(old,new,1)
old="""{showVaultPicker && userEmail && <VaultPickerModal userEmail={userEmail} onSelect={(url) => applyPickedImage(url, 'Vault reference')} onClose={() => { setShowVaultPicker(false); setPickerTarget(null); }} embedded={embedded} />}"""
new="""{showVaultPicker && userEmail && <VaultPickerModal userEmail={userEmail} mediaType={pickerTarget?.type === 'music' ? 'audio' : 'image'} onSelect={(url, name) => applyPickedImage(url, name || (pickerTarget?.type === 'music' ? 'Vault music' : 'Vault reference'))} onClose={() => { setShowVaultPicker(false); setPickerTarget(null); }} embedded={embedded} />}"""
if old not in t: raise SystemExit('picker render not found')
t=t.replace(old,new,1)
p.write_text(t)
