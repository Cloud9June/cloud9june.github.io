const CACHE_NAME = "sungilnow-cache-v13";
const urlsToCache = [
  "/stu/",
  "/stu/index.html",
  "/stu/manifest.json",
  "/stu/icons/icon-192.png",
  "/stu/icons/icon-512.png"
];

// 설치 단계
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 요청 가로채기
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// 캐시 업데이트
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});
