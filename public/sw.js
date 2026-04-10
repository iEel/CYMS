const CACHE_NAME = 'cyms-v2';

// Precache เฉพาะ static assets สาธารณะ — ห้าม cache page ที่ต้องการ auth
const PRECACHE_URLS = [
  '/manifest.json',
];

// Install — precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — Strategy แยกตามประเภท request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET (POST, PUT, DELETE ฯลฯ)
  if (request.method !== 'GET') return;

  // [สำคัญ] ข้าม API calls ทั้งหมด — ห้าม cache เด็ดขาด
  // เพราะ API response มี auth context และ state ที่เปลี่ยนตลอดเวลา
  if (url.pathname.startsWith('/api/')) return;

  // [สำคัญ] ข้าม page navigations (HTML) ทั้งหมด — ให้ browser/middleware จัดการ auth เอง
  // ถ้า SW เสิร์ฟ cached redirect → login ผู้ใช้จะถูก logout ทุกครั้ง
  if (request.destination === 'document') return;

  // Static assets เท่านั้น (js, css, images, fonts) — Cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          // Cache เฉพาะ response ที่ OK เท่านั้น
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ทุกอย่างอื่น — Network first (ไม่ cache)
  // รวมถึง /_next/ chunks ที่ไม่ใช่ static assets รูปแบบธรรมดา
});

