/*
==========================================
 성일정보고 링크 허브 스크립트
------------------------------------------
 ⦿ 제작자 : 성일정보고등학교 교육정보부장 김형준
 ⦿ 최초 작성 : 2025-09-15
 ⦿ 수정 내역 :
    - 2025-09-22 카드 숨김/복원 기능 추가
    - 2025-09-22 메모장 모달 CRUD 기능 구현
    - 2025-10-15 오늘일정 기능 구현
    - 2026-08-27 관리자 일정(근태) 기능 제거, 성일일정 바로가기 버튼으로 대체
    - 2026-08-27 오늘일정 기능 제거
    - 2026-09-18 전면 정리 (아래 참고)
------------------------------------------
 2026-09-18 변경 요약
 ---------------------
 [기능]
  · 급식 카드(card11) 제거 → 상단 급식 위젯에 통합
  · 급식 위젯: '급식 신청·조회' 버튼 / 클릭 시 주간 식단 모달
  · 오후 1시 이후 자동으로 '내일 급식' 표시, 주말은 다음 평일로 건너뜀
  · 카드가 하나도 없는 카테고리 필터 버튼은 자동 숨김
  · 모달 ESC 키 / 배경 클릭 닫기 통합
 [버그]
  · showCard(): 삭제된 카드 key가 숨김 목록에 영구히 남던 문제
  · 시작 시 존재하지 않는 카드 key 자동 정리 (숨김/순서)
  · 카테고리 필터가 data-cat="external service" 처럼 복수 값일 때 동작 안 하던 문제
  · 날씨: 기온/습도가 현재 시각이 아닌 첫 예보값을 쓰던 문제
  · 날씨: 발표시각 보정으로 base_date가 어제가 되면 어제 날씨를 보여주던 문제
  · 복원 시 현재 검색/필터 상태를 무시하고 카드가 튀어나오던 문제
 [구조]
  · 설정 → config.js / 저장 → store.js 로 분리 (Firestore 전환 대비)
  · 모든 이벤트 바인딩에 null 가드 적용 (요소 하나 지워도 스크립트가 멈추지 않음)
  · 인라인 onclick 제거 (내선번호 카드의 tel.js 연동분은 유지)
------------------------------------------
 본 소스는 성일정보고 내부 업무 지원용으로 작성되었으며
 무단 사용 및 외부 배포를 금합니다.
==========================================
*/

(function () {
    'use strict';

    /* ======================================================================
       공통 유틸
    ====================================================================== */
    const $ = (id) => document.getElementById(id);
    const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

    // 요소가 없어도 조용히 넘어가는 안전 바인딩
    const on = (el, evt, fn, opts) => {
        if (el && typeof el.addEventListener === 'function') el.addEventListener(evt, fn, opts);
    };

    const two = (n) => String(n).padStart(2, '0');
    const DOW = ['일', '월', '화', '수', '목', '금', '토'];

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 브라우저 지역과 무관하게 한국시간
    function nowKST() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    }

    function ymd(d) {
        return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}`;
    }

    function dateOnly(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function addDays(d, n) {
        const x = new Date(d);
        x.setDate(x.getDate() + n);
        return x;
    }

    /* ======================================================================
       모달 공통 (ESC / 배경 클릭 / [data-close-modal] 통합)
    ====================================================================== */
    const Modal = {
        open(el) {
            if (!el) return;
            el.classList.add('is-open');
            el.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        },
        close(el) {
            if (!el) return;
            el.classList.remove('is-open');
            el.setAttribute('aria-hidden', 'true');
            if (!document.querySelector('.modal.is-open')) {
                document.body.classList.remove('modal-open');
            }
        },
        closeAll() {
            $$('.modal.is-open').forEach(m => Modal.close(m));
        },
        init() {
            // 여는 버튼 : data-open-modal="모달id"
            // (별도 처리가 필요 없는 단순 모달은 이 속성만 붙이면 됩니다)
            $$('[data-open-modal]').forEach(btn => {
                on(btn, 'click', () => Modal.open($(btn.dataset.openModal)));
            });

            // 배경(오버레이) 클릭
            $$('.modal').forEach(m => {
                on(m, 'click', (e) => { if (e.target === m) Modal.close(m); });
            });
            // 닫기 버튼 (× / 닫기)
            $$('[data-close-modal]').forEach(btn => {
                on(btn, 'click', () => Modal.close(btn.closest('.modal')));
                on(btn, 'keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        Modal.close(btn.closest('.modal'));
                    }
                });
            });
            // ESC
            on(document, 'keydown', (e) => {
                if (e.key === 'Escape') Modal.closeAll();
            });
        }
    };

    /* ======================================================================
       테마 (다크 / 라이트)
       ※ 첫 페인트 전 적용은 index.html <head> 인라인 스크립트가 담당
    ====================================================================== */
    const Theme = {
        init() {
            const btn = $('themeToggleBtn');
            let theme = Store.get('theme', 'dark');
            if (theme !== 'light' && theme !== 'dark') theme = 'dark';

            const apply = () => {
                document.documentElement.setAttribute('data-theme', theme);
                if (btn) btn.textContent = (theme === 'light') ? '🌙 다크모드' : '☀️ 라이트모드';
            };
            apply();

            on(btn, 'click', () => {
                theme = (theme === 'light') ? 'dark' : 'light';
                Store.set('theme', theme);
                apply();
            });
        }
    };

    /* ======================================================================
       카드 : 검색 · 카테고리 필터 · 숨김/복원
    ====================================================================== */
    const Cards = {
        hidden: [],
        activeCat: 'all',
        keyword: '',

        existingKeys() {
            return new Set($$('#grid .card').map(c => c.dataset.key).filter(Boolean));
        },

        // 삭제된 카드(예: 급식 card11)의 key가 저장소에 남아 있으면 정리
        prune() {
            const exists = this.existingKeys();

            const cleanedHidden = this.hidden.filter(k => exists.has(k));
            if (cleanedHidden.length !== this.hidden.length) {
                this.hidden = cleanedHidden;
                Store.set('hiddenCards', this.hidden);
            }

            const order = Store.get('cardOrder', []);
            const cleanedOrder = order.filter(k => exists.has(k));
            if (cleanedOrder.length !== order.length) {
                Store.set('cardOrder', cleanedOrder);
            }
        },

        apply() {
            const kw = this.keyword;
            $$('#grid .card').forEach(c => {
                const key = c.dataset.key;
                const cats = (c.dataset.cat || '').trim().split(/\s+/);
                const tags = (c.dataset.tags || '').toLowerCase();
                const title = (c.querySelector('h3')?.textContent || '').toLowerCase();

                const inCat = (this.activeCat === 'all') || cats.indexOf(this.activeCat) !== -1;
                const hit = !kw || tags.includes(kw) || title.includes(kw);
                const isHidden = this.hidden.indexOf(key) !== -1;

                c.style.display = (!isHidden && inCat && hit) ? '' : 'none';
            });
        },

        hide(key) {
            if (!key) return;
            if (this.hidden.indexOf(key) === -1) {
                this.hidden.push(key);
                Store.set('hiddenCards', this.hidden);
            }
            this.apply();
            this.renderHiddenList();
        },

        show(key) {
            // ⚠️ 카드 엘리먼트 존재 여부와 무관하게 목록에서 먼저 제거할 것
            this.hidden = this.hidden.filter(k => k !== key);
            Store.set('hiddenCards', this.hidden);
            this.apply();           // 현재 검색어·필터 상태를 반영해 표시
            this.renderHiddenList();
        },

        cardTitle(key) {
            const el = document.querySelector(`#grid .card[data-key="${key}"]`);
            return el?.querySelector('h3')?.textContent.trim() || key;
        },

        renderHiddenList() {
            const box = $('hiddenList');
            if (!box) return;
            box.innerHTML = '';

            if (this.hidden.length === 0) {
                box.textContent = '숨긴 카드 없음';
                return;
            }
            this.hidden.forEach(key => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = `복원: ${this.cardTitle(key)}`;
                btn.addEventListener('click', () => this.show(key));
                box.appendChild(btn);
            });
        },

        initPills() {
            const pills = $$('.pill');
            const counts = {};
            $$('#grid .card').forEach(c => {
                (c.dataset.cat || '').trim().split(/\s+/).forEach(cat => {
                    if (cat) counts[cat] = (counts[cat] || 0) + 1;
                });
            });

            pills.forEach(p => {
                const cat = p.dataset.filter;
                // 해당 카테고리 카드가 하나도 없으면 버튼 자체를 숨김 (예: 성과/홍보)
                if (cat !== 'all' && !counts[cat]) {
                    p.style.display = 'none';
                    return;
                }
                on(p, 'click', () => {
                    this.activeCat = cat;
                    pills.forEach(x => x.classList.remove('is-active'));
                    p.classList.add('is-active');
                    this.apply();
                });
            });

            pills[0]?.classList.add('is-active');
        },

        init() {
            this.hidden = Store.get('hiddenCards', []);
            if (!Array.isArray(this.hidden)) this.hidden = [];
            this.prune();

            // 카드 숨김 버튼 (이벤트 위임 — 카드가 추가/삭제되어도 그대로 동작)
            on($('grid'), 'click', (e) => {
                const btn = e.target.closest('.hide-btn');
                if (!btn) return;
                e.preventDefault();
                const key = btn.dataset.hide || btn.closest('.card')?.dataset.key;
                this.hide(key);
            });

            const q = $('q');
            on(q, 'input', () => {
                this.keyword = (q.value || '').trim().toLowerCase();
                this.apply();
            });

            // 숨김 목록 토글
            on($('hiddenListBtn'), 'click', () => {
                $('hiddenList')?.classList.toggle('is-open');
            });

            this.initPills();
            this.apply();
            this.renderHiddenList();
        }
    };

    /* ======================================================================
       카드 순서 (Sortable)
    ====================================================================== */
    const Order = {
        sortable: null,

        save() {
            const keys = $$('#grid .card').map(c => c.dataset.key).filter(Boolean);
            Store.set('cardOrder', keys);
        },

        load() {
            const grid = $('grid');
            if (!grid) return;

            const saved = Store.get('cardOrder', []);
            if (!Array.isArray(saved) || saved.length === 0) return;   // 저장값 없으면 HTML 순서 그대로

            const html = $$('#grid .card').map(c => c.dataset.key).filter(Boolean);
            const known = new Set(saved);

            // 저장값에서 사라진 카드 제거
            const order = saved.filter(k => html.includes(k));

            // 새로 추가된 카드는 HTML에서 바로 앞에 있던 기존 카드 뒤에 끼워 넣습니다.
            // (맨 뒤로 보내면 새 카드를 못 찾고, 맨 앞에 두면 기존 배치를 헤집게 됩니다)
            html.forEach((key, i) => {
                if (known.has(key)) return;
                let at = 0;
                for (let j = i - 1; j >= 0; j--) {
                    const idx = order.indexOf(html[j]);
                    if (idx !== -1) { at = idx + 1; break; }
                }
                order.splice(at, 0, key);
                known.add(key);
            });

            order.forEach(key => {
                const el = document.querySelector(`#grid .card[data-key="${key}"]`);
                if (el) grid.appendChild(el);
            });
        },

        updateLockLabel(locked) {
            const btn = $('lockBtn');
            if (btn) btn.textContent = locked ? '🔒 고정 중' : '🔓 이동 가능';
        },

        init() {
            const grid = $('grid');
            if (!grid) return;

            this.load();

            if (typeof Sortable === 'undefined') {
                console.warn('[Order] Sortable 라이브러리를 불러오지 못했습니다.');
                return;
            }

            this.sortable = new Sortable(grid, {
                animation: 200,
                ghostClass: 'ghost',
                chosenClass: 'chosen',
                delay: 150,                 // 150ms 이상 눌러야 드래그 시작
                delayOnTouchOnly: true,     // 모바일 터치에서만 지연 적용
                filter: 'a, button, input, textarea, select',  // 링크·버튼에서는 드래그 시작 안 함
                preventOnFilter: false,
                onEnd: () => this.save()
            });

            let locked = Store.get('locked', false) === true;
            this.sortable.option('disabled', locked);
            this.updateLockLabel(locked);

            on($('lockBtn'), 'click', () => {
                locked = !locked;
                this.sortable.option('disabled', locked);
                Store.set('locked', locked);
                this.updateLockLabel(locked);
            });
        }
    };

    /* ======================================================================
       개인화 즐겨찾기
    ====================================================================== */
    const Personal = {
        links: [],

        render() {
            const box = $('personalLinks');
            if (!box) return;
            box.innerHTML = '';

            if (this.links.length === 0) {
                const p = document.createElement('p');
                p.className = 'empty-msg';   // 스타일은 style.css 에서
                p.textContent = '아직 추가한 링크가 없습니다.';
                box.appendChild(p);
                return;
            }
            this.links.forEach(link => {
                const a = document.createElement('a');
                a.className = 'btn';
                a.href = link.url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = link.name;
                box.appendChild(a);
            });
        },

        add() {
            const max = CONFIG.limits.personalLinks;
            if (this.links.length >= max) {
                alert(`즐겨찾기는 최대 ${max}개까지 추가할 수 있습니다.`);
                return;
            }

            const maxLen = CONFIG.limits.personalLinkNameLength;
            let name = prompt(`링크 이름을 입력하세요 (최대 ${maxLen}자):`);
            if (name === null) return;
            name = name.trim().slice(0, maxLen);
            if (!name) {
                alert('이름을 입력하세요.');
                return;
            }

            const url = (prompt('URL을 입력하세요 (http:// 또는 https:// 포함):') || '').trim();
            if (!url) return;

            // http/https 만 허용 (javascript: 등 위험한 스킴 차단)
            if (!/^https?:\/\//i.test(url)) {
                alert('http:// 또는 https:// 로 시작하는 URL만 입력할 수 있습니다.');
                return;
            }

            this.links.push({ name, url });
            Store.set('personalLinks', this.links);
            this.render();
        },

        toggleDeleteMode() {
            const box = $('deleteMode');
            if (!box) return;

            if (box.style.display === 'none' || !box.style.display) {
                box.style.display = 'block';
                box.innerHTML = "<p style='font-size:13px;color:var(--muted)'>삭제할 링크를 선택하세요:</p>";

                this.links.forEach((link, i) => {
                    const row = document.createElement('div');
                    row.className = 'personal-del-row';

                    const label = document.createElement('span');
                    label.textContent = link.name;

                    const del = document.createElement('button');
                    del.type = 'button';
                    del.className = 'btn';
                    del.textContent = '❌ 삭제';
                    del.addEventListener('click', () => {
                        this.links.splice(i, 1);
                        Store.set('personalLinks', this.links);
                        this.render();
                        box.style.display = 'none';
                        this.toggleDeleteMode();   // 목록 갱신
                    });

                    row.appendChild(label);
                    row.appendChild(del);
                    box.appendChild(row);
                });
            } else {
                box.style.display = 'none';
                box.innerHTML = '';
            }
        },

        init() {
            this.links = Store.get('personalLinks', []);
            if (!Array.isArray(this.links)) this.links = [];
            on($('addLinkBtn'), 'click', () => this.add());
            on($('manageLinkBtn'), 'click', () => this.toggleDeleteMode());
            this.render();
        }
    };

    /* ======================================================================
       메모장
    ====================================================================== */
    const Memo = {
        items: [],
        editingIndex: null,

        render() {
            const list = $('memoList');
            if (!list) return;
            list.innerHTML = '';
            this.items.forEach((memo, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn';
                btn.textContent = memo.title;
                btn.addEventListener('click', () => this.open(idx));
                list.appendChild(btn);
            });
        },

        open(index) {
            const modal = $('memoModal');
            const title = $('memoTitle');
            const content = $('memoContent');
            const saveBtn = $('saveMemoBtn');
            const delBtn = $('deleteMemoBtn');
            if (!modal || !title || !content) return;

            this.editingIndex = (index === undefined) ? null : index;

            if (this.editingIndex === null) {
                title.value = '';
                content.value = '';
                if (saveBtn) saveBtn.textContent = '저장';
                if (delBtn) delBtn.style.display = 'none';
            } else {
                title.value = this.items[this.editingIndex].title;
                content.value = this.items[this.editingIndex].content;
                if (saveBtn) saveBtn.textContent = '수정';
                if (delBtn) delBtn.style.display = 'inline-block';
            }
            Modal.open(modal);
            title.focus();
        },

        save() {
            const title = ($('memoTitle')?.value || '').trim();
            const content = ($('memoContent')?.value || '').trim();
            if (!title || !content) {
                alert('제목과 내용을 입력하세요.');
                return;
            }

            if (this.editingIndex === null) {
                if (this.items.length >= CONFIG.limits.memos) {
                    alert(`메모는 최대 ${CONFIG.limits.memos}개까지만 저장할 수 있습니다.`);
                    return;
                }
                this.items.push({ title, content });
            } else {
                this.items[this.editingIndex] = { title, content };
            }

            Store.set('memoCard', this.items);
            this.render();
            Modal.close($('memoModal'));
            this.editingIndex = null;
        },

        remove() {
            if (this.editingIndex === null) return;
            if (!confirm('이 메모를 삭제하시겠습니까?')) return;
            this.items.splice(this.editingIndex, 1);
            Store.set('memoCard', this.items);
            this.render();
            Modal.close($('memoModal'));
            this.editingIndex = null;
        },

        init() {
            this.items = Store.get('memoCard', []);
            if (!Array.isArray(this.items)) this.items = [];
            on($('addMemoBtn'), 'click', () => this.open(null));
            on($('saveMemoBtn'), 'click', () => this.save());
            on($('deleteMemoBtn'), 'click', () => this.remove());
            this.render();
        }
    };

    /* ======================================================================
       급식 (NEIS) — 상단 위젯 + 주간 식단 모달
    ====================================================================== */
    const Meal = {
        weekMeals: {},   // { 'YYYYMMDD': '메뉴 · 메뉴 · …' }
        range: null,     // { mon: Date, fri: Date }

        // 메뉴 텍스트 정리 (알레르기 번호, 괄호 제거)
        format(s) {
            if (!s) return '';
            return String(s)
                .replace(/<br\s*\/?>/gi, ' · ')
                .replace(/\([^)]*\)/g, '')
                .replace(/[0-9.]+(?=\s|$)/g, '')
                .replace(/\s*·\s*/g, ' · ')
                .replace(/\s{2,}/g, ' ')
                .replace(/^\s*·\s*|\s*·\s*$/g, '')
                .trim();
        },

        // 1단계 : 후보 날짜 — 기본은 오늘, 설정 시각 이후면 내일, 주말이면 다음 평일
        firstCandidate() {
            const now = nowKST();
            let d = dateOnly(now);
            if (now.getHours() >= CONFIG.meal.switchToTomorrowHour) d = addDays(d, 1);
            while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
            return d;
        },

        // 2단계 : 후보부터 훑어서 '실제로 급식이 등록된' 첫 날을 찾음
        // (공휴일·재량휴업일·시험 단축수업 등으로 비어 있는 평일을 건너뜁니다)
        // 기간 안에 하나도 없으면 후보를 그대로 돌려줘서 안내 문구가 뜨게 합니다.
        pickTarget(from, meals) {
            for (let i = 0; i <= CONFIG.meal.lookAheadDays; i++) {
                const d = addDays(from, i);
                if (d.getDay() === 0 || d.getDay() === 6) continue;
                if (meals[ymd(d)]) return d;
            }
            return from;
        },

        labelFor(target) {
            const today = dateOnly(nowKST());
            const diff = Math.round((target - today) / 86400000);
            if (diff === 0) return '오늘 급식';
            if (diff === 1) return '내일 급식';
            return `${target.getMonth() + 1}/${target.getDate()}(${DOW[target.getDay()]}) 급식`;
        },

        // target 이 속한 주의 월~금
        weekRange(target) {
            const day = target.getDay();
            const mon = addDays(target, day === 0 ? -6 : 1 - day);
            return { mon, fri: addDays(mon, 4) };
        },

        async fetchRange(fromYmd, toYmd) {
            const c = CONFIG.neis;
            const url = `${c.endpoint}?KEY=${c.key}&Type=json&pIndex=1&pSize=100` +
                `&ATPT_OFCDC_SC_CODE=${CONFIG.school.officeCode}` +
                `&SD_SCHUL_CODE=${CONFIG.school.schoolCode}` +
                `&MLSV_FROM_YMD=${fromYmd}&MLSV_TO_YMD=${toYmd}`;

            const res = await fetch(url);
            const data = await res.json();

            // 데이터 없음(INFO-200)도 정상 응답입니다
            if (data.RESULT && data.RESULT.CODE !== 'INFO-000') {
                if (data.RESULT.CODE !== 'INFO-200') {
                    console.warn('[Meal] NEIS 메시지:', data.RESULT.MESSAGE);
                }
                return {};
            }

            const out = {};
            const rowData = (data.mealServiceDietInfo || []).find(item => item.row);
            (rowData?.row || []).forEach(r => {
                const date = r.MLSV_YMD;
                const isLunch = (r.MMEAL_SC_NM || '').includes('중식');
                if (!date) return;
                if (out[date] && !isLunch) return;   // 중식 우선
                out[date] = this.format(r.DDISH_NM);
            });
            return out;
        },

        async load() {
            const textEl = $('todayMealText');
            const titleEl = $('todayMealTitle');
            if (!textEl) return;

            const first = this.firstCandidate();
            const todayYmd = ymd(nowKST());

            // 조회 범위 : 후보가 속한 주의 월요일 ~ 그로부터 lookAheadDays + 4일
            // (후보가 금요일이어도 탐색 마지막 날의 그 주 금요일까지 덮도록 +4)
            const scanFrom = this.weekRange(first).mon;
            const scanTo = addDays(scanFrom, CONFIG.meal.lookAheadDays + 4);
            const fromYmd = ymd(scanFrom);
            const toYmd = ymd(scanTo);

            // 불러오는 동안 임시 제목 (데이터가 와야 최종 대상이 정해집니다)
            if (titleEl) titleEl.textContent = this.labelFor(first);

            // 1) 캐시 (같은 날 + 같은 조회 범위일 때만 재사용)
            const cache = Store.get('meal.cache', null);
            if (cache && cache.savedAt === todayYmd && cache.from === fromYmd && cache.to === toYmd) {
                this.weekMeals = cache.meals || {};
            } else {
                textEl.textContent = '🍚 오늘은 어떤 반찬이 기다릴까요? 로딩 중…';

                // 2) API 호출 (한 번에 받아 위젯·주간 모달이 함께 사용)
                try {
                    this.weekMeals = await this.fetchRange(fromYmd, toYmd);
                    Store.set('meal.cache', {
                        savedAt: todayYmd, from: fromYmd, to: toYmd, meals: this.weekMeals
                    });
                } catch (e) {
                    console.error('[Meal] 급식 정보를 불러오지 못했습니다:', e);
                    this.weekMeals = {};
                    Store.remove('meal.cache');
                }
            }

            // 3) 급식이 실제로 있는 날로 대상 확정
            const target = this.pickTarget(first, this.weekMeals);
            this.range = this.weekRange(target);
            if (titleEl) titleEl.textContent = this.labelFor(target);
            this.renderWidget(ymd(target));
        },

        renderWidget(targetYmd) {
            const textEl = $('todayMealText');
            if (!textEl) return;
            const menu = this.weekMeals[targetYmd];
            textEl.textContent = menu
                ? menu
                : '당분간 등록된 급식이 없습니다. (방학 중이거나 NEIS 점검 중일 수 있어요)';
        },

        renderWeekModal() {
            const body = $('mealWeekBody');
            const rangeEl = $('mealWeekRange');
            if (!body || !this.range) return;

            const { mon, fri } = this.range;
            if (rangeEl) {
                rangeEl.textContent =
                    `${mon.getMonth() + 1}/${mon.getDate()} ~ ${fri.getMonth() + 1}/${fri.getDate()}`;
            }

            const todayYmd = ymd(dateOnly(nowKST()));
            const rows = [];
            for (let i = 0; i < 5; i++) {
                const d = addDays(mon, i);
                const key = ymd(d);
                const menu = this.weekMeals[key];
                rows.push(`
                    <tr class="${key === todayYmd ? 'is-today' : ''}">
                        <th scope="row">${d.getMonth() + 1}/${d.getDate()}<span>(${DOW[d.getDay()]})</span></th>
                        <td>${menu ? escapeHtml(menu) : '<span class="meal-week-none">정보 없음</span>'}</td>
                    </tr>`);
            }

            body.innerHTML = `<table class="meal-week-table"><tbody>${rows.join('')}</tbody></table>`;
        },

        init() {
            // 설정의 급식 시스템 주소 반영
            const appUrl = CONFIG.meal.appUrl;
            const link = $('mealAppLink');
            const modalLink = $('mealModalLink');
            if (link) link.href = appUrl;
            if (modalLink) modalLink.href = appUrl;

            on($('mealWeekBtn'), 'click', () => {
                this.renderWeekModal();
                Modal.open($('mealModal'));
            });

            this.load();
        }
    };

    /* ======================================================================
       날씨 (기상청 단기예보)
    ====================================================================== */
    const Weather = {
        // 현재 시각 기준 최근 발표시각부터 과거로 count개
        recentBases(now, count) {
            const HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
            const ref = new Date(now.getTime() - 15 * 60 * 1000); // 발표 직후 지연 고려
            let day = dateOnly(ref);
            let idx = -1;
            HOURS.forEach((h, i) => { if (ref.getHours() >= h) idx = i; });

            const out = [];
            while (out.length < count) {
                if (idx < 0) {
                    day = addDays(day, -1);
                    idx = HOURS.length - 1;
                }
                out.push({ date: ymd(day), time: two(HOURS[idx]) + '00' });
                idx--;
            }
            return out;
        },

        icon(sky, pty) {
            if (pty == 1) return '<i class="fa-solid fa-cloud-rain"></i>';           // 비
            if (pty == 2) return '<i class="fa-solid fa-cloud-showers-heavy"></i>';  // 비/눈
            if (pty == 3) return '<i class="fa-solid fa-snowflake"></i>';            // 눈
            if (pty == 4) return '<i class="fa-solid fa-cloud-sun-rain"></i>';       // 소나기
            if (sky == 1) return '<i class="fa-solid fa-sun"></i>';                  // 맑음
            if (sky == 3) return '<i class="fa-solid fa-cloud-sun"></i>';            // 구름많음
            if (sky == 4) return '<i class="fa-solid fa-cloud"></i>';                // 흐림
            return '<i class="fa-solid fa-temperature-half"></i>';
        },

        async fetchItems(base) {
            const c = CONFIG.weather;
            const url = `${c.endpoint}?serviceKey=${c.serviceKey}` +
                `&numOfRows=1000&pageNo=1&dataType=JSON` +
                `&base_date=${base.date}&base_time=${base.time}&nx=${c.nx}&ny=${c.ny}`;
            const res = await fetch(url);
            const data = await res.json();
            return data?.response?.body?.items?.item || [];
        },

        async load() {
            const todayEl = $('todayWeather');
            const tomorrowEl = $('tomorrowWeather');
            if (!todayEl) return;

            const now = nowKST();
            // ⚠️ 오늘 날짜는 발표시각 보정과 무관하게 따로 계산해야 합니다
            const todayStr = ymd(now);
            const tomorrowStr = ymd(addDays(now, 1));
            const hhNow = two(now.getHours()) + '00';

            let items = [];
            for (const base of this.recentBases(now, 3)) {
                try {
                    items = await this.fetchItems(base);
                    if (items.length) break;
                } catch (e) {
                    // 다음 발표시각으로 재시도
                }
            }

            if (!items.length) {
                todayEl.innerHTML = '<i class="fa-solid fa-temperature-half"></i> --℃ · --%';
                if (tomorrowEl) tomorrowEl.textContent = '';
                return;
            }

            // 오늘: 현재 시각 이후 예보를 우선 사용 (없으면 오늘 전체에서)
            const todayAll = items.filter(i => i.fcstDate === todayStr);
            const ahead = todayAll.filter(i => i.fcstTime >= hhNow);
            const src = ahead.length ? ahead : todayAll;
            const pick = (cat) => src.find(i => i.category === cat)?.fcstValue;

            todayEl.innerHTML =
                `${this.icon(pick('SKY'), pick('PTY'))} ${pick('TMP') ?? '-'}℃ · ${pick('REH') ?? '-'}%`;

            // 내일: 최저 / 최고
            if (tomorrowEl) {
                const temps = items
                    .filter(i => i.fcstDate === tomorrowStr && i.category === 'TMP')
                    .map(i => Number(i.fcstValue))
                    .filter(n => !Number.isNaN(n));
                tomorrowEl.textContent = temps.length
                    ? `내일 ${Math.min(...temps)}℃ / ${Math.max(...temps)}℃`
                    : '';
            }
        },

        init() {
            this.load();
            setInterval(() => this.load(), CONFIG.weather.refreshMinutes * 60 * 1000);
        }
    };

    /* ======================================================================
       실시간 시계 (KST)
    ====================================================================== */
    const Clock = {
        init() {
            const elDate = $('nowDate');
            const elTime = $('nowTime');
            if (!elDate || !elTime) return;

            const render = () => {
                const d = nowKST();
                elDate.textContent =
                    `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} (${DOW[d.getDay()]})`;
                elTime.textContent = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
            };

            render();
            // 초 경계에 맞춰 부드럽게
            setTimeout(() => {
                render();
                setInterval(render, 1000);
            }, 1000 - nowKST().getMilliseconds());
        }
    };

    /* ======================================================================
       일일근무 (구글 시트 CSV)
    ====================================================================== */
    const Duty = {
        loaded: false,

        // 따옴표로 감싼 콤마(,)를 포함한 셀도 안전하게 나누는 간단한 CSV 파서
        parseCsv(text) {
            const rows = [];
            let row = [], field = '', inQuotes = false;

            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (inQuotes) {
                    if (ch === '"') {
                        if (text[i + 1] === '"') { field += '"'; i++; }
                        else inQuotes = false;
                    } else field += ch;
                } else if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    row.push(field); field = '';
                } else if (ch === '\n') {
                    row.push(field); rows.push(row); row = []; field = '';
                } else if (ch === '\r') {
                    // \r\n 대응 : 무시
                } else field += ch;
            }
            if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
            return rows;
        },

        async load() {
            const box = $('modal-duty');
            if (!box) return;

            try {
                const res = await fetch(CONFIG.duty.csvUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const rows = this.parseCsv((await res.text()).trim());
                if (rows.length < 19) throw new Error('시트 데이터가 예상보다 짧습니다.');

                const cell = (r, c) => (rows[r] && rows[r][c] !== undefined) ? rows[r][c] : '';
                const join = (...v) => v.filter(Boolean).join(', ');
                const pair = (a, b) => (a === b) ? a : join(a, b);

                // [오늘 / 내일] 데이터 — 시트 구조가 바뀌면 이 인덱스만 수정하세요
                const d = {
                    today: cell(0, 0),
                    tomorrow: cell(11, 0),
                    rows: [
                        ['주번/교통', pair(cell(3, 4), cell(3, 4)), pair(cell(14, 4), cell(14, 4))],
                        ['급식A', join(cell(3, 7), cell(4, 7)), join(cell(14, 7), cell(15, 7))],
                        ['급식B', join(cell(6, 7), cell(7, 7)), join(cell(17, 7), cell(18, 7))],
                        ['야자[일반]', cell(3, 1), cell(14, 1)],
                        ['야자[NCS]', cell(4, 1), cell(15, 1)],
                        ['야자[부사관1]', cell(5, 1), cell(16, 1)],
                        ['야자[부사관2]', cell(6, 1), cell(17, 1)],
                        ['야자[공무원]', cell(7, 1), cell(18, 1)]
                    ]
                };

                box.innerHTML = `
                    <table class="duty-table">
                        <thead>
                            <tr><th></th><th>${escapeHtml(d.today)}</th><th>${escapeHtml(d.tomorrow)}</th></tr>
                        </thead>
                        <tbody>
                            ${d.rows.map(r => `
                            <tr>
                                <td>${escapeHtml(r[0])}</td>
                                <td>${escapeHtml(r[1])}</td>
                                <td>${escapeHtml(r[2])}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
                this.loaded = true;
            } catch (e) {
                console.error('[Duty] 근무자 정보 불러오기 실패:', e);
                box.innerHTML =
                    "<p style='color:var(--warning);text-align:center;'>근무자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>";
            }
        },

        init() {
            const sheetLink = $('dutySheetLink');
            if (sheetLink) sheetLink.href = CONFIG.duty.sheetUrl;

            on($('dutyBtn'), 'click', () => {
                Modal.open($('dutyModal'));
                if (!this.loaded) this.load();   // 처음 열 때만 호출
            });
        }
    };

    /* ======================================================================
       복무 결재선 조회 (approval-data.js)
    ====================================================================== */
    const Approval = {
        built: false,

        render(item, idx) {
            const box = $('approvalResult');
            if (!box) return;
            const line = item.lines[idx];
            const note = [item.note, line.note].filter(Boolean).join('\n\n');

            box.innerHTML = `
                <div class="approval-line">
                    <div class="line-path">${escapeHtml(line.line)}</div>
                    ${note ? `<div class="line-note">${escapeHtml(note)}</div>` : ''}
                </div>`;
        },

        build() {
            if (this.built) return;
            if (typeof approvalData === 'undefined') {
                console.warn('[Approval] approval-data.js 를 불러오지 못했습니다.');
                return;
            }
            const sit = $('situationSelect');
            const pos = $('positionSelect');
            const box = $('approvalResult');
            if (!sit || !pos) return;

            approvalData.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.label;
                sit.appendChild(opt);
            });

            on(sit, 'change', () => {
                const selected = approvalData.find(d => d.id === sit.value);
                pos.innerHTML = '<option value="">직급을 선택하세요</option>';
                if (box) box.innerHTML = '<div class="approval-placeholder">근무상황과 직급을 선택하면 결재선이 표시됩니다.</div>';

                if (!selected) { pos.disabled = true; return; }

                selected.lines.forEach((l, i) => {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = l.position;
                    pos.appendChild(opt);
                });
                pos.disabled = false;

                if (selected.lines.length === 1) {
                    pos.value = '0';
                    this.render(selected, 0);
                }
            });

            on(pos, 'change', () => {
                const selected = approvalData.find(d => d.id === sit.value);
                if (!selected || pos.value === '') return;
                this.render(selected, Number(pos.value));
            });

            this.built = true;
        },

        init() {
            on($('approvalBtn'), 'click', () => {
                this.build();
                Modal.open($('approvalModal'));
            });
        }
    };

    /* ======================================================================
       전광판
    ====================================================================== */
    const Ticker = {
        render() {
            const track = $('ledTrack');
            if (!track) return;
            track.innerHTML = '';

            const sep = () => {
                const s = document.createElement('span');
                s.className = 'led-sep';
                return s;
            };

            track.appendChild(sep());
            CONFIG.ticker.forEach(msg => {
                const span = document.createElement('span');
                span.textContent = ' ' + msg + ' ';
                track.appendChild(span);
                track.appendChild(sep());
            });

            const chars = CONFIG.ticker.join('  ').length;
            const speed = Math.max(20, Math.min(45, Math.round(chars / 6)));
            track.style.animation = `ledScroll ${speed}s linear infinite`;
        },

        init() {
            const ticker = $('ledTicker');
            const btn = $('tickerToggle');
            const track = $('ledTrack');
            if (!ticker || !btn) return;

            on(btn, 'click', () => {
                const open = ticker.classList.toggle('is-open');
                ticker.setAttribute('aria-hidden', String(!open));
                btn.textContent = open ? '📢 학교 알림 전광판 닫기' : '📢 학교 알림 전광판 열기';
                if (open) this.render();
                else if (track) track.style.animation = 'none';
            });

            on(ticker, 'mouseenter', () => { if (track) track.style.animationPlayState = 'paused'; });
            on(ticker, 'mouseleave', () => { if (track) track.style.animationPlayState = 'running'; });
        }
    };

    /* ======================================================================
       상단 빠른 검색바
    ====================================================================== */
    const QuickSearch = {
        engine: 'google',
        lastOpenAt: 0,
        LOCK_MS: 600,

        highlight() {
            $('qsGoogle')?.classList.toggle('is-active', this.engine === 'google');
            $('qsNaver')?.classList.toggle('is-active', this.engine === 'naver');
        },

        open(engine, keyword) {
            const input = $('qsInput');
            if (!input) return;
            if (!keyword) { input.focus(); return; }

            const now = Date.now();
            if (now - this.lastOpenAt < this.LOCK_MS) return;   // 엔터 중복 방지
            this.lastOpenAt = now;

            const enc = encodeURIComponent(keyword.trim());
            const url = (engine === 'naver')
                ? `https://search.naver.com/search.naver?query=${enc}`
                : `https://www.google.com/search?q=${enc}`;

            window.open(url, '_blank', 'noopener');
            this.engine = engine;
            Store.set('search.default', engine);
            this.highlight();
            input.value = '';
        },

        smart() {
            const input = $('qsInput');
            const val = (input?.value || '').trim();
            if (!val) { input?.focus(); return; }

            // 'g 검색어' / 'ㄴ 검색어' 형태의 접두어 처리
            const m = val.match(/^([gnGNㄱㄴㅎㅜ])\s+(.*)$/);
            if (m) {
                const k = m[1].toLowerCase();
                const eng = (k === 'g' || k === 'ㄱ' || k === 'ㅎ') ? 'google'
                    : (k === 'n' || k === 'ㄴ' || k === 'ㅜ') ? 'naver'
                        : this.engine;
                this.open(eng, m[2]);
            } else {
                this.open(this.engine, val);
            }
        },

        init() {
            const input = $('qsInput');
            const saved = Store.get('search.default', 'google');
            this.engine = (saved === 'naver') ? 'naver' : 'google';

            on(input, 'keydown', (e) => {
                if (e.key !== 'Enter' || e.isComposing) return;
                e.preventDefault();
                e.stopPropagation();
                this.smart();
            }, { passive: false });

            on($('qsGoogle'), 'click', () => this.open('google', input?.value));
            on($('qsNaver'), 'click', () => this.open('naver', input?.value));

            // 검색바 아무 곳이나 클릭하면 입력창 포커스
            on(document.querySelector('.quick-search'), 'click', (e) => {
                if (e.target.tagName.toLowerCase() !== 'button') input?.focus();
            });

            this.highlight();
        }
    };

    /* ======================================================================
       아코디언
    ====================================================================== */
    const Accordion = {
        init() {
            $$('.accordion-toggle').forEach(btn => {
                on(btn, 'click', () => {
                    btn.classList.toggle('active');
                    const content = btn.nextElementSibling;
                    if (!content) return;
                    content.style.maxHeight = btn.classList.contains('active')
                        ? content.scrollHeight + 'px'
                        : null;
                });
            });
        }
    };

    /* ======================================================================
       로그인 상태 (Firestore 개편 대비 자리만 잡아둠)
    ------------------------------------------------------------------------
       <html data-auth="guest"> → 'member' 로 바꾸면
       [data-requires-auth] 요소가 화면에 나타납니다. (style.css 참고)

       TODO(Firestore 개편):
         onAuthStateChanged(auth, async (user) => {
             Auth.set(user ? 'member' : 'guest');
             if (user) {
                 await Store.use('firestore', user.uid);
                 await Store.migrateLocalToRemote();
                 boot();                       // 개인 설정 다시 그리기
             }
         });
    ====================================================================== */
    const Auth = {
        set(state) {
            document.documentElement.setAttribute('data-auth', state);
        },
        get() {
            return document.documentElement.getAttribute('data-auth') || 'guest';
        }
    };

    /* ======================================================================
       시작
    ====================================================================== */
    async function boot() {
        const yy = $('yy');
        if (yy) yy.textContent = new Date().getFullYear();

        try {
            await Store.init();
        } catch (e) {
            console.warn('[boot] 저장소 초기화 실패 — 기본값으로 진행합니다.', e);
        }

        Modal.init();
        Theme.init();
        Cards.init();
        Order.init();
        Personal.init();
        Memo.init();
        Accordion.init();
        QuickSearch.init();
        Ticker.init();
        Duty.init();
        Approval.init();
        Meal.init();
        Weather.init();
        Clock.init();

        // 교직원 내선번호 검색 (staff-search.js)
        if (typeof StaffSearch !== 'undefined') StaffSearch.init();
        else console.warn('[boot] staff-search.js 를 불러오지 못했습니다.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // 디버깅 편의 (콘솔에서 Hub.Cards.show('card11') 등으로 확인 가능)
    window.Hub = {
        Cards, Order, Personal, Memo, Meal, Weather, Duty, Approval, Auth, Modal,
        get Staff() { return (typeof StaffSearch !== 'undefined') ? StaffSearch : null; }
    };
})();