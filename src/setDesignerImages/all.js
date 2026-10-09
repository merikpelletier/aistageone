const svg = (a, b, c, motif = 'room') => {
  const motifs = {
    room: `<path d="M0 145 L90 86 L230 86 L320 145 V180 H0Z" fill="${c}"/><rect x="116" y="70" width="88" height="74" fill="${b}"/><rect x="129" y="82" width="62" height="50" fill="${a}" opacity=".72"/>`,
    city: `<rect x="0" y="116" width="320" height="64" fill="${c}"/><rect x="22" y="62" width="55" height="90" fill="${b}"/><rect x="92" y="84" width="62" height="68" fill="${a}" opacity=".75"/><rect x="170" y="50" width="58" height="102" fill="${b}"/><rect x="242" y="74" width="48" height="78" fill="${a}" opacity=".65"/>`,
    stage: `<rect x="0" y="132" width="320" height="48" fill="${c}"/><path d="M52 0 L125 132 H0 V0Z" fill="${a}" opacity=".5"/><path d="M268 0 L195 132 H320 V0Z" fill="${b}" opacity=".5"/><ellipse cx="160" cy="130" rx="68" ry="20" fill="white" opacity=".18"/>`,
    horizon: `<rect x="0" y="112" width="320" height="68" fill="${c}"/><circle cx="236" cy="56" r="26" fill="${a}" opacity=".85"/><path d="M0 126 L70 92 L132 118 L205 82 L320 126 V180 H0Z" fill="${b}" opacity=".9"/>`,
    weather: `<rect x="0" y="122" width="320" height="58" fill="${c}"/><path d="M0 120 C55 78 102 98 145 66 C194 28 250 64 320 44 V0 H0Z" fill="${b}" opacity=".86"/><path d="M18 32 L4 92 M58 20 L44 82 M98 34 L82 102 M142 22 L128 88 M188 30 L174 100 M232 18 L218 84 M278 28 L264 98" stroke="${a}" stroke-width="5" opacity=".55"/>`,
  };
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="#080b0e"/><rect width="320" height="180" fill="url(#g)" opacity=".45"/>${motifs[motif] || motifs.room}<rect x="0" y="0" width="320" height="180" fill="none" stroke="white" stroke-opacity=".08"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
};

const SET_DESIGNER_IMAGES = {
  Direction: {
    Cinematic: svg('#1b6f78','#111b25','#05080b','city'),
    'Fashion Editorial': svg('#d7d7d7','#3d444b','#101214','stage'),
    'Gritty Realism': svg('#52616a','#1d252b','#090c0f','city'),
    Theatrical: svg('#a62635','#270b10','#050505','stage'),
    Retro: svg('#5a6d78','#23313a','#101214','room'),
    Minimalist: svg('#c8d0d3','#3a4044','#111315','room'),
    Luxury: svg('#7a6c5e','#25211e','#090909','room'),
    Futuristic: svg('#1dc8bd','#16333a','#05080a','city'),
  },
  Era: {
    Contemporary: svg('#6f8f99','#2e3e45','#101417','room'),
    '1940s': svg('#8d8a83','#3f403f','#111111','room'),
    '1960s': svg('#c7cbc4','#536167','#1a1c1d','stage'),
    '1980s': svg('#2e78a8','#7d2d48','#080b12','city'),
    'Near Future': svg('#6daeb1','#2c4c55','#0c1115','city'),
    Timeless: svg('#a8b0b4','#4a5054','#111315','room'),
  },
  Lighting: {
    Natural: svg('#7da29b','#425c55','#151a18','horizon'),
    'Soft Studio': svg('#d9e3e5','#4b5155','#111315','stage'),
    'High Contrast': svg('#f0f0f0','#303030','#030303','stage'),
    Neon: svg('#18d7cb','#4a235f','#05080c','city'),
    Moonlight: svg('#9ec0cf','#213647','#050811','horizon'),
    Overcast: svg('#7f8b91','#40494e','#13181c','weather'),
  },
  'Time of day': {
    Dawn: svg('#b76b5f','#4b4f68','#10141b','horizon'),
    Day: svg('#9bcbd3','#5b7780','#162027','horizon'),
    'Golden Hour': svg('#c36c54','#7f3e45','#15171b','horizon'),
    Dusk: svg('#6e5571','#2f344b','#0b0e14','horizon'),
    Night: svg('#31506b','#101c2b','#03060b','city'),
  },
  'Weather / Atmosphere': {
    Clear: svg('#7fb9c7','#305867','#132027','horizon'),
    Cloudy: svg('#7b858a','#3d4549','#111518','weather'),
    Rain: svg('#5aa6b8','#203d49','#081017','weather'),
    Snow: svg('#d7e0e3','#71868d','#1a2227','weather'),
    Fog: svg('#a7afb0','#5d6668','#171a1c','weather'),
    Storm: svg('#748796','#1b2732','#06090d','weather'),
  },
  'Image treatment': {
    Photoreal: svg('#8f9ba0','#465158','#111417','room'),
    Cinematic: svg('#277f87','#172833','#080b0e','city'),
    Stylized: svg('#2db9b0','#8a3f57','#0b1015','stage'),
    Theatrical: svg('#a62b3c','#2b0c14','#060606','stage'),
  },
};

export default SET_DESIGNER_IMAGES;
