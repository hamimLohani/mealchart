import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* No rewrites, let public folder handle it */
  serverExternalPackages: ["firebase-admin", "nodemailer"],
};

export default nextConfig;
