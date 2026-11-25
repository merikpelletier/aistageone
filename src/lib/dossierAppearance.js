export const THEMES = {
  children: {label:'Children',background:'#FFF2E4',secondary:'#CDEEE6',text:'#263E45',accent:'#A83E35',titleFont:'rounded',bodyFont:'rounded',indexStyle:'cards',radius:24},
  story: {label:'Illustrated story',background:'#F4E9DC',secondary:'#FFF9F1',text:'#45352D',accent:'#8B4B3B',titleFont:'serif',bodyFont:'serif',indexStyle:'cards',radius:14},
  magazine: {label:'Premium magazine',background:'#F5F4EF',secondary:'#E9E4DA',text:'#272727',accent:'#555045',titleFont:'serif',bodyFont:'sans',indexStyle:'mosaic',radius:4},
  cinema: {label:'Cinema',background:'#10151C',secondary:'#222B38',text:'#F5F6F8',accent:'#D5E8F5',titleFont:'sans',bodyFont:'sans',indexStyle:'cards',radius:8},
  scifi: {label:'Science fiction',background:'#081B23',secondary:'#15343F',text:'#DEF8FA',accent:'#64D6D4',titleFont:'mono',bodyFont:'sans',indexStyle:'mosaic',radius:6},
  minimal: {label:'Minimal',background:'#FFFFFF',secondary:'#F0F2F3',text:'#202326',accent:'#354D60',titleFont:'sans',bodyFont:'sans',indexStyle:'list',radius:8}
};
export const FONTS={rounded:{label:'Rounded',family:'"Trebuchet MS", "Arial Rounded MT Bold", system-ui, sans-serif'},sans:{label:'Sans serif',family:'Arial, Helvetica, sans-serif'},serif:{label:'Serif',family:'Georgia, "Times New Roman", serif'},mono:{label:'Monospace',family:'"Courier New", monospace'}};
export const INDEX_STYLES={cards:'Illustrated cards',mosaic:'Mosaic',list:'Classic list'};
const hex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
export function resolveAppearance(value){
  if(!value || !Object.hasOwn(THEMES,value.preset))return null;
  const base=THEMES[value.preset];
  return {...base,preset:value.preset,background:hex(value.background,base.background),secondary:hex(value.secondary,base.secondary),text:hex(value.text,base.text),accent:hex(value.accent,base.accent),titleFont:Object.hasOwn(FONTS,value.titleFont)?value.titleFont:base.titleFont,bodyFont:Object.hasOwn(FONTS,value.bodyFont)?value.bodyFont:base.bodyFont,indexStyle:Object.hasOwn(INDEX_STYLES,value.indexStyle)?value.indexStyle:base.indexStyle,backgroundImage:typeof value.backgroundImage==='string' && /^https:\/\//i.test(value.backgroundImage)?value.backgroundImage:''};
}
export function appearanceStyle(a){
  if(!a)return {};
  return {'--dossier-bg':a.background,'--dossier-secondary':a.secondary,'--dossier-text':a.text,'--dossier-accent':a.accent,'--dossier-accent-text':contrastText(a.accent),'--dossier-radius':a.radius+'px','--dossier-title-font':FONTS[a.titleFont].family,'--dossier-body-font':FONTS[a.bodyFont].family,backgroundColor:a.background,color:a.text,fontFamily:FONTS[a.bodyFont].family,...(a.backgroundImage?{backgroundImage:'url('+JSON.stringify(a.backgroundImage)+')',backgroundSize:'cover',backgroundPosition:'center'}:{})};
}
function contrastText(hex){
  const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
  return (0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2])>0.179?'#111111':'#FFFFFF';
}
