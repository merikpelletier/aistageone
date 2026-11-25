export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const id=req.query?.id;
  if(req.method!=='GET'||typeof id!=='string'||!/^MOB-[A-F0-9]+$/.test(id))return res.status(400).end();
  const url=process.env.VITE_SUPABASE_URL;
  const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return res.status(503).end();
  try {
    const endpoint=new URL('/rest/v1/dossier',url);
    endpoint.searchParams.set('select','title,mobile_app_name,mobile_icon_192,mobile_icon_512,default_language');
    endpoint.searchParams.set('mobile_public_id','eq.'+id);
    endpoint.searchParams.set('mobile_enabled','eq.true');
    endpoint.searchParams.set('status','eq.published');
    endpoint.searchParams.set('or','(publish_until.is.null,publish_until.gt.'+new Date().toISOString()+')');
    const result=await fetch(endpoint,{headers:{apikey:key}});
    if(!result.ok)return res.status(503).end();
    const [dossier]=await result.json();
    if(!dossier)return res.status(404).end();
    const path='/mobile/'+id;
    const name=dossier.mobile_app_name?.trim()||dossier.title;
    const icon=(src,size)=>({src,sizes:size+'x'+size,type:'image/png',purpose:'any'});
    res.setHeader('Content-Type','application/manifest+json; charset=utf-8');
    return res.status(200).send(JSON.stringify({id:path,name,short_name:name,start_url:path,scope:path,display:'standalone',orientation:'any',background_color:'#000000',theme_color:'#000000',icons:[icon(dossier.mobile_icon_192||'/icons/icon-192.png?v=6',192),icon(dossier.mobile_icon_512||'/icons/icon-512.png?v=6',512)]}));
  }catch{return res.status(503).end();}
}
