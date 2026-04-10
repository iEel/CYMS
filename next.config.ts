import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-cron'],
  // อนุญาต origin อื่นๆ ใน LAN เพื่อ dev (เช่น tablet/phone ที่เข้า 192.168.x.x)
  // ใช้ * เพื่อรองรับทุก IP ใน network เดียวกัน
  allowedDevOrigins: ['192.168.101.26', '192.168.101.*'],
};

export default nextConfig;

