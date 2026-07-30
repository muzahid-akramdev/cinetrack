/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Required: TMDb images are hotlinked directly, never re-hosted.
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }],
  },
}

export default nextConfig
