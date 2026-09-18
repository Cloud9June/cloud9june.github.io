/*
==========================================
 성일정보고 링크 허브 - 저장소 추상화 계층
------------------------------------------
 ⦿ 제작자 : 성일정보고등학교 교육정보부장 김형준
 ⦿ 최초 작성 : 2026-09-18
------------------------------------------
 목적
 -----
 지금은 localStorage, 나중에는 Firestore.
 화면 로직(main.js)이 저장 위치를 몰라도 되도록 한 겹 감쌌습니다.

 설계
 -----
 · Store.init()        → 비동기. 시작 시 한 번만. 저장소 전체를 메모리로 로드.
 · Store.get(k, def)   → 동기. 메모리 캐시에서 즉시 반환.
 · Store.set(k, v)     → 동기 반영 + 비동기 저장(write-through). Promise 반환.
 · Store.remove(k)     → 삭제.

 읽기를 동기로 유지한 이유
 -----------------------
 Firestore로 바꿔도 init() 한 번에 사용자 문서를 통째로 받아오면
 이후 읽기는 그대로 동기로 쓸 수 있습니다.
 즉, 개편 시 고칠 곳은 아래 backends.firestore 뿐이고
 main.js는 손대지 않아도 됩니다.

 Firestore 전환 체크리스트
 ------------------------
 1. CONFIG.firebase 채우기
 2. backends.firestore 의 load/save/remove 구현
 3. 로그인 성공 후  await Store.use('firestore', uid)  호출
 4. 최초 1회  await Store.migrateLocalToRemote()  로 기존 개인 설정 이전
 ※ 테마(theme)는 화면 깜빡임 방지를 위해 index.html <head>에서 먼저 읽으므로
    localStorage에도 항상 함께 남겨 둡니다.
==========================================
*/

const Store = (function () {
    'use strict';

    const PREFIX = 'eduinfo.';

    // 예전 버전에서 쓰던 키 (접두어 없음 / 사용 중단)
    const LEGACY_KEYS = ['todayMealCache', 'eduinfo.memo'];

    // 항상 localStorage에도 함께 저장할 키 (렌더링 전에 필요한 값)
    const LOCAL_ALWAYS = ['theme'];

    const cache = new Map();
    let backendName = 'local';
    let scopeId = null;   // Firestore 전환 시 uid
    let ready = false;

    /* ---------- 내부 유틸 ---------- */
    function rawKey(key) {
        return PREFIX + key;
    }

    function parse(text) {
        if (text === null) return undefined;
        try {
            return JSON.parse(text);
        } catch (e) {
            return text; // 예전에 문자열 그대로 저장한 값 호환 (theme, search.default 등)
        }
    }

    function clone(v) {
        if (v === null || typeof v !== 'object') return v;
        try {
            return JSON.parse(JSON.stringify(v));
        } catch (e) {
            return v;
        }
    }

    function writeLocal(key, value) {
        try {
            localStorage.setItem(rawKey(key), JSON.stringify(value));
        } catch (e) {
            console.warn('[Store] 로컬 저장 실패:', key, e);
        }
    }

    /* ---------- 백엔드 ---------- */
    const backends = {

        local: {
            async load() {
                for (let i = 0; i < localStorage.length; i++) {
                    const raw = localStorage.key(i);
                    if (!raw || raw.indexOf(PREFIX) !== 0) continue;
                    cache.set(raw.slice(PREFIX.length), parse(localStorage.getItem(raw)));
                }
            },
            async save(key, value) {
                writeLocal(key, value);
            },
            async remove(key) {
                try { localStorage.removeItem(rawKey(key)); } catch (e) { /* noop */ }
            }
        },

        // ------------------------------------------------------------------
        // TODO(Firestore 개편): 아래 세 함수만 구현하면 됩니다.
        //
        //   컬렉션 구조 제안
        //     users/{uid}                        … 프로필(이름, 부서, 권한)
        //     users/{uid}/settings/hub           … 이 Store가 쓰는 개인 설정 문서
        //
        //   load()   : getDoc(users/{uid}/settings/hub) → 필드를 cache에 set
        //   save()   : setDoc(..., { [key]: value }, { merge: true })
        //              (호출이 잦으므로 300ms 정도 디바운스 권장)
        //   remove() : updateDoc(..., { [key]: deleteField() })
        //
        //   ※ key에 점(.)이 들어가면 Firestore가 중첩 경로로 해석하므로
        //     저장 시 key.replace(/\./g, '__') 로 치환하세요.
        // ------------------------------------------------------------------
        firestore: {
            async load() {
                throw new Error('[Store] firestore 백엔드가 아직 구현되지 않았습니다.');
            },
            async save() {
                throw new Error('[Store] firestore 백엔드가 아직 구현되지 않았습니다.');
            },
            async remove() {
                throw new Error('[Store] firestore 백엔드가 아직 구현되지 않았습니다.');
            }
        }
    };

    /* ---------- 공개 API ---------- */

    // 시작 시 1회
    async function init() {
        if (ready) return;

        // 예전 키 정리
        LEGACY_KEYS.forEach(k => {
            try { localStorage.removeItem(k); } catch (e) { /* noop */ }
        });

        await backends[backendName].load();
        ready = true;
    }

    function get(key, fallback) {
        if (!cache.has(key)) return fallback;
        const v = cache.get(key);
        return (v === undefined || v === null) ? fallback : clone(v);
    }

    function set(key, value) {
        cache.set(key, clone(value));

        // 테마 등은 백엔드와 무관하게 로컬에도 유지
        if (LOCAL_ALWAYS.indexOf(key) !== -1 && backendName !== 'local') {
            writeLocal(key, value);
        }

        return backends[backendName].save(key, value).catch(e => {
            console.warn('[Store] 저장 실패:', key, e);
        });
    }

    function remove(key) {
        cache.delete(key);
        return backends[backendName].remove(key).catch(e => {
            console.warn('[Store] 삭제 실패:', key, e);
        });
    }

    function keys() {
        return [...cache.keys()];
    }

    // 로그인 후 백엔드 교체 (개편 시 사용)
    async function use(name, id) {
        if (!backends[name]) throw new Error('[Store] 알 수 없는 백엔드: ' + name);
        backendName = name;
        scopeId = id || null;
        cache.clear();
        ready = false;
        await init();
    }

    // 로컬 → 원격 1회 이전 (개편 시 사용)
    async function migrateLocalToRemote() {
        if (backendName === 'local') return;
        const snapshot = {};
        for (let i = 0; i < localStorage.length; i++) {
            const raw = localStorage.key(i);
            if (!raw || raw.indexOf(PREFIX) !== 0) continue;
            snapshot[raw.slice(PREFIX.length)] = parse(localStorage.getItem(raw));
        }
        for (const k of Object.keys(snapshot)) {
            if (cache.has(k)) continue;      // 원격 값이 우선
            await set(k, snapshot[k]);
        }
    }

    return {
        init, get, set, remove, keys, use, migrateLocalToRemote,
        get backend() { return backendName; },
        get scope() { return scopeId; },
        get isReady() { return ready; }
    };
})();