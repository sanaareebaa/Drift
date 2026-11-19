import { supabase } from './supabaseClient'
import { USE_MOCK } from './ideaStore'

// Takes an array of File objects and returns an array of stored image paths.
// Mock mode keeps temporary browser URLs; Supabase mode uploads to the private "idea-images" bucket.
export async function uploadImages(files) {
  if (USE_MOCK) return files.map((f) => URL.createObjectURL(f))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const paths = []
  for (const [i, file] of files.entries()) {
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${user.id}/${Date.now()}-${i}-${safeName}`
    const { error } = await supabase.storage.from('idea-images').upload(path, file)
    if (error) throw error
    paths.push(path)
  }
  return paths
}

const isDirectUrl = (p) => /^(blob:|https?:)/.test(p)

// Turns stored paths into links the browser can show. The bucket is private, so the links
// are signed and expire after an hour. Returns [{ path, url }]; images that fail are left out.
export async function getImageUrls(paths = []) {
  if (!paths.length) return []
  if (USE_MOCK) return paths.map((p) => ({ path: p, url: p }))

  const direct = paths.filter(isDirectUrl).map((p) => ({ path: p, url: p }))
  const stored = paths.filter((p) => !isDirectUrl(p))
  if (!stored.length) return direct

  const { data, error } = await supabase.storage.from('idea-images').createSignedUrls(stored, 3600)
  if (error) throw error
  return [...direct, ...data.filter((d) => d.signedUrl).map((d) => ({ path: d.path, url: d.signedUrl }))]
}

// Removes the stored files for an idea that is being deleted
export async function deleteImages(paths = []) {
  if (USE_MOCK) return
  const stored = paths.filter((p) => !isDirectUrl(p))
  if (!stored.length) return
  const { error } = await supabase.storage.from('idea-images').remove(stored)
  if (error) throw error
}