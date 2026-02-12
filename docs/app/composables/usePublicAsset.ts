export function usePublicAsset(path: string) {
  const config = useRuntimeConfig()
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${config.app.baseURL}/${cleanPath}`
}
