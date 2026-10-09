import { supabase } from '@/api/supabaseClient';

const imageUrl = path => supabase.storage.from('set-designer-options').getPublicUrl(path).data.publicUrl;

const SET_DESIGNER_IMAGES = {
  Direction: {
    Cinematic: imageUrl('direction/cinematic'),
    'Fashion Editorial': imageUrl('direction/fashion_editorial'),
    'Gritty Realism': imageUrl('direction/gritty_realism'),
    Theatrical: imageUrl('direction/theatrical'),
    Retro: imageUrl('direction/retro'),
    Minimalist: imageUrl('direction/minimalist'),
    Luxury: imageUrl('direction/luxury'),
    Futuristic: imageUrl('direction/futuristic'),
  },
  Era: {
    Contemporary: imageUrl('era/contemporary'),
    '1940s': imageUrl('era/1940s'),
    '1960s': imageUrl('era/1960s'),
    '1980s': imageUrl('era/1980s'),
    'Near Future': imageUrl('era/near_future'),
    Timeless: imageUrl('era/timeless'),
  },
  Lighting: {
    Natural: imageUrl('lighting/natural'),
    'Soft Studio': imageUrl('lighting/soft_studio'),
    'High Contrast': imageUrl('lighting/high_contrast'),
    Neon: imageUrl('lighting/neon'),
    Moonlight: imageUrl('lighting/moonlight'),
    Overcast: imageUrl('lighting/overcast'),
  },
  'Time of day': {
    Dawn: imageUrl('time_of_day/dawn'),
    Day: imageUrl('time_of_day/day'),
    'Golden Hour': imageUrl('time_of_day/golden_hour'),
    Dusk: imageUrl('time_of_day/dusk'),
    Night: imageUrl('time_of_day/night'),
  },
  'Weather / Atmosphere': {
    Clear: imageUrl('weather_atmosphere/clear'),
    Cloudy: imageUrl('weather_atmosphere/cloudy'),
    Rain: imageUrl('weather_atmosphere/rain'),
    Snow: imageUrl('weather_atmosphere/snow'),
    Fog: imageUrl('weather_atmosphere/fog'),
    Storm: imageUrl('weather_atmosphere/storm'),
  },
  'Image treatment': {
    Photoreal: imageUrl('image_treatment/photoreal'),
    Cinematic: imageUrl('image_treatment/cinematic'),
    Stylized: imageUrl('image_treatment/stylized'),
    Theatrical: imageUrl('image_treatment/theatrical'),
  },
};

export default SET_DESIGNER_IMAGES;
