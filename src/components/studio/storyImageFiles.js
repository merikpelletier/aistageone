export async function saveStoryImage(api, { url, userEmail, name, ratio }) {
  if (!url || !userEmail) throw new Error('Sign in to save this image to your Vault.');
  const existing = await api.filter({ user_email: userEmail, url }, '-created_date', 1);
  if (existing.length) return existing[0];
  const saved = await api.create({
    user_email: userEmail, url, name, media_type: 'image', asset_category: 'reference',
    tags: ['story-blocks', 'image'], aspect_ratio: ratio,
  });
  if (!saved?.id) throw new Error('The image could not be saved to your Vault.');
  return saved;
}

export function storyImageFilename(name, mimeType) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }[mimeType.split(';')[0]] || 'png';
  const stem = String(name || 'Story-Blocks-image').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().replace(/[. ]+$/, '').slice(0, 140) || 'Story-Blocks-image';
  return `${stem}.${extension}`;
}
