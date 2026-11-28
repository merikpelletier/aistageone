// Marketing-only audiovisual renderer. Existing Slide remains unchanged.
const timeout=(p,ms)=>{let id;return Promise.race([p,new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error('Media operation timed out')),ms)})]).finally(()=>clearTimeout(id));};
const loaded=(el,event)=>timeout(new Promise((resolve,reject)=>{el.addEventListener(event,resolve,{once:true});el.addEventListener('error',()=>reject(new Error('Media could not be decoded')),{once:true});}),30000);
export async function renderMarketingVideo({scenes,narration,music,vertical,onProgress=()=>{}}){
 if(!scenes.length)throw Error('No visual media selected');
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('Browser does not support video recording');
 const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 if(!mime)throw Error('No supported video format');
 const canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;
 const ctx=canvas.getContext('2d');const audio=new AudioContext();const dest=audio.createMediaStreamDestination();
 const elements=[];let stream,recorder;let failure;const urls=[];
 const source=async(blob,type)=>{
  const url=URL.createObjectURL(blob);urls.push(url);
  const el=type==='image'?new Image():document.createElement(type==='video'?'video':'audio');
  elements.push(el);if(type!=='image'){el.preload='auto';el.playsInline=true;}
  const ready=loaded(el,type==='image'?'load':'loadeddata');el.src=url;await ready;return el;
 };
 const connect=(el,volume)=>{const node=audio.createMediaElementSource(el),gain=audio.createGain();gain.gain.value=volume;node.connect(gain).connect(dest);return gain;};
 try{
  await audio.resume();if(audio.state!=='running')throw Error('Audio playback blocked by browser');
  const prepared=[];for(const s of scenes){const el=await source(s.blob,s.type);const gain=s.type==='video'?connect(el,1):null;prepared.push({...s,el,gain});}
  const voice=narration?await source(narration,'audio'):null;
  const song=music?await source(music,'audio'):null;
  if(voice)connect(voice,1);if(song){connect(song,0.13);song.loop=true;}
  const images=prepared.filter(s=>s.type==='image');const voiceSeconds=voice?.duration||0;
  if(voice&&!images.length)throw Error('Narration requires at least one image scene');
  const imageSeconds=Math.max(3,voiceSeconds/Math.max(1,images.length));
  for(const s of prepared){s.seconds=s.type==='video'?s.el.duration:imageSeconds;if(!Number.isFinite(s.seconds)||s.seconds<=0)throw Error('Invalid media duration');}
  const total=prepared.reduce((n,s)=>n+s.seconds,0);
  stream=canvas.captureStream(30);for(const t of dest.stream.getAudioTracks())stream.addTrack(t);
  const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});
  const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||Error('Recording failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime.split(';')[0]}));});done.catch(e=>{failure=e;});
  const draw=(s,p)=>{const el=s.el,w=el.videoWidth||el.naturalWidth,h=el.videoHeight||el.naturalHeight;const z=s.type==='image'?1+0.12*p:1;const scale=Math.max(canvas.width/w,canvas.height/h)*z;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(el,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);};
  draw(prepared[0],0);recorder.start(1000);if(song)await song.play();
  let elapsed=0,voiceStarted=false;
  for(const s of prepared){
   if(s.type==='video'){voice?.pause();await s.el.play();}else if(voice&&!voice.ended){await voice.play();voiceStarted=true;}
   const start=performance.now();await new Promise((resolve,reject)=>{const tick=()=>{try{if(failure||recorder.state!=='recording')throw failure||Error('Recording interrupted');if(document.hidden)throw Error('Keep the production tab visible');const p=Math.min(1,(performance.now()-start)/1000/s.seconds);draw(s,p);onProgress(Math.floor((elapsed+p*s.seconds)/total*100));if(p===1)resolve();else setTimeout(tick,1000/30);}catch(e){reject(e);}};tick();});
   if(s.type==='video')s.el.pause();elapsed+=s.seconds;
  }
  if(voiceStarted&&!voice.ended&&voice.duration-voice.currentTime>0.5)throw Error('Narration was not fully rendered');
  recorder.stop();const blob=await timeout(done,30000);if(!blob.size)throw Error('Empty video');return blob;
 }finally{if(recorder?.state==='recording')recorder.stop();for(const el of elements)el.pause?.();stream?.getTracks().forEach(t=>t.stop());dest.stream.getTracks().forEach(t=>t.stop());await audio.close().catch(()=>{});urls.forEach(u=>URL.revokeObjectURL(u));}
}
