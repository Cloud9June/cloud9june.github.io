/* ============================================================
   service-worker.js — v2.0.1

   전략
     HTML · CSS · JS  → 네트워크 우선, 실패하면 캐시
                        (배포하면 새로고침 한 번에 반영됩니다)
     이미지 · 폰트 등  → 캐시 우선
     그 외            → 건드리지 않습니다 (Firestore, 구글 폰트, QR)

   ⚠ 2.0.0 의 실수: 정적 자원 조회에 { ignoreSearch: true } 를 써서
     app.css?v=... 의 버전 쿼리가 무시됐습니다. 파일을 고쳐도 옛 CSS 가
     계속 나왔습니다. ignoreSearch 는 index.html 대체용으로만 씁니다.
   ============================================================ */
const VERSION = "2.0.2";
const SHELL = `snow-shell-${VERSION}`;
const ASSETS = `snow-assets-${VERSION}`;

/* index.html 이 실제로 요청하는 주소와 똑같이 적어야 합니다 (쿼리 포함). */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  `./css/app.css?v=${VERSION}`,
  `./js/app.js?v=${VERSION}`,
  "./js/config.js",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/render.js",
  "./js/ui.js",
];

const isCode = (url) => /\.(?:html|css|js|json)$/.test(url.pathname) || url.pathname.endsWith("/");

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      // 하나라도 실패하면 설치 전체가 실패하므로 개별로 담습니다
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 페이지에서 보내는 명령 (개발 중 캐시 비우기) */
self.addEventListener("message", (e) => {
  if (e.data === "purge") {
    e.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 외부 요청은 통과

  /* 1) 문서 — 네트워크 우선, 오프라인이면 캐시된 index.html */
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  /* 2) CSS · JS · JSON — 네트워크 우선.
        고친 파일이 바로 반영되는 쪽이 학교 운영에 훨씬 낫습니다. */
  if (isCode(url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))   // 오프라인일 때만 캐시
    );
    return;
  }

  /* 3) 이미지 · 폰트 · 영상 — 캐시 우선, 뒤에서 조용히 갱신 */
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
