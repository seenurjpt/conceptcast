import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Exemplars moved out of /admin, which is now the admin panel.
      { source: "/admin/exemplars", destination: "/exemplars", permanent: true },
    ];
  },
};

export default nextConfig;
