import { supabase } from './supabase'

const BUCKET = 'urangapart-images'

export async function uploadImage(file: File, folder = 'products'): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(url: string): Promise<void> {
  const urlObj  = new URL(url)
  const parts   = urlObj.pathname.split(`/${BUCKET}/`)
  if (parts.length < 2) return
  const path = parts[1]
  await supabase.storage.from(BUCKET).remove([path])
}
