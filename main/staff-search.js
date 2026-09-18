/*
==========================================
 성일정보고 링크 허브 - 교직원 내선번호 검색
------------------------------------------
 ⦿ 기존 파일명 : tel.js  →  staff-search.js 로 변경
 ⦿ 데이터 : staff-data.js (STAFF, STAFF_LOCATIONS, STAFF_DEPT_ORDER)
------------------------------------------
 2026-09-18 정리 내역
 ---------------------
 [버그]
  · 카드가 없는 페이지에서 로드되면 스크립트 전체가 죽던 문제
    (resultTable.insertAdjacentElement 에 null 가드가 없었음)
  · 한글 조합 중(IME) input 값을 덮어써서 글자가 깨지던 문제
    → composition 이벤트로 조합이 끝난 뒤에만 정리
  · 계산만 하고 화면에는 쓰지 않던 person.location 죽은 코드
    → 데이터를 staff-data.js 로 옮기고 부서 아래 실제로 표시
  · 진로진학부 / 취업전략부 / 교장이 위치 규칙에서 빠져 있던 문제
 [보안]
  · innerHTML 문자열 조립 → DOM + textContent 로 변경
    (지금은 내부 데이터라 안전하지만, Firestore로 옮기면 XSS 경로가 됩니다)
 [개선]
  · 결과 없음 안내, 결과 개수 표시
  · 부서 순서 → 부장 우선 → 이름순 정렬
  · 인라인 onkeyup / onclick 제거, 인라인 스타일 → CSS 이동
  · 전역 오염 제거 (StaffSearch 하나만 노출)
------------------------------------------
 본 소스는 성일정보고 내부 업무 지원용으로 작성되었으며
 무단 사용 및 외부 배포를 금합니다.
==========================================
*/

const StaffSearch = (function () {
    'use strict';

    const CHOSUNG = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ',
        'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];

    // 한글 / 숫자 / 공백만 허용
    const ALLOWED = /[^가-힣ㄱ-ㅎㅏ-ㅣ0-9\s]/g;
    const DEPT_TITLE_MIN = 4;   // 부서명으로 검색하려면 4글자 이상

    let roster = [];            // 전처리된 명단
    let composing = false;
    let msgTimer = null;

    let elInput, elBody, elTable, elMsg, elCount, elResult;

    /* ---------- 초성 추출 ---------- */
    function chosungOf(str) {
        return String(str).split('').map(ch => {
            const code = ch.charCodeAt(0) - 0xAC00;
            if (code < 0 || code > 11171) return ch;   // 한글 음절이 아니면 그대로
            return CHOSUNG[Math.floor(code / 588)];
        }).join('');
    }

    /* ---------- title → 부서 / 직위 ---------- */
    const ADMIN_TITLES = {
        '교장': { dept: '교장', role: '교장', rank: 0 },
        '교감': { dept: '교감', role: '교감', rank: 0 },
        '행정실장': { dept: '행정실', role: '실장', rank: 0 },
        '행정부장': { dept: '행정실', role: '부장', rank: 1 },
        '주무관': { dept: '행정실', role: '주무관', rank: 2 },
        '행정실무사': { dept: '행정실', role: '실무사', rank: 3 }
    };

    function parseTitle(title) {
        if (ADMIN_TITLES[title]) return ADMIN_TITLES[title];
        // '교육정보부장' → 부서 '교육정보부' + 직위 '부장'
        if (title.length > 2 && title.endsWith('부장')) {
            return { dept: title.slice(0, -1), role: '부장', rank: 0 };
        }
        return { dept: title, role: '', rank: 1 };
    }

    /* ---------- 명단 전처리 (초성·부서·위치 미리 계산) ---------- */
    function buildRoster() {
        if (typeof STAFF === 'undefined') {
            console.warn('[StaffSearch] staff-data.js 를 불러오지 못했습니다.');
            return [];
        }
        const order = (typeof STAFF_DEPT_ORDER !== 'undefined') ? STAFF_DEPT_ORDER : [];
        const locations = (typeof STAFF_LOCATIONS !== 'undefined') ? STAFF_LOCATIONS : {};

        return STAFF.map(p => {
            const meta = parseTitle(p.title);
            const deptIdx = order.indexOf(meta.dept);
            return {
                title: p.title,
                name: p.name,
                ext: String(p.ext || ''),
                dept: meta.dept,
                role: meta.role,
                rank: meta.rank,
                location: locations[meta.dept] || '',
                nameChosung: chosungOf(p.name),
                titleChosung: chosungOf(p.title),
                sortDept: deptIdx === -1 ? 999 : deptIdx
            };
        }).sort((a, b) =>
            a.sortDept - b.sortDept ||
            a.rank - b.rank ||
            a.name.localeCompare(b.name, 'ko')
        );
    }

    /* ---------- 검색 ---------- */
    function search(rawInput) {
        const input = String(rawInput || '').trim();
        if (!input) return [];

        // 1~3 단독 입력 → 학년부 검색 (내선번호는 3자리라 충돌하지 않습니다)
        if (/^[1-3]$/.test(input)) {
            return roster.filter(p => p.title.startsWith(input + '학년부'));
        }
        // 숫자만 → 내선번호 검색
        if (/^[0-9]+$/.test(input)) {
            return roster.filter(p => p.ext.includes(input));
        }
        // 초성만 → 초성 검색
        if (/^[ㄱ-ㅎ]+$/.test(input)) {
            return roster.filter(p =>
                p.nameChosung.includes(input) ||
                (input.length >= DEPT_TITLE_MIN && p.titleChosung.includes(input))
            );
        }
        // 그 외 → 이름 / (4글자 이상이면) 부서명
        return roster.filter(p =>
            p.name.includes(input) ||
            (input.length >= DEPT_TITLE_MIN && p.title.includes(input))
        );
    }

    /* ---------- 렌더링 (innerHTML 미사용) ---------- */
    function render(list, keyword) {
        if (!elBody || !elTable) return;
        elBody.replaceChildren();

        if (!keyword) {
            elTable.hidden = true;
            setCount('');
            return;
        }
        if (list.length === 0) {
            elTable.hidden = true;
            setCount('');
            showMsg(`'${keyword}' 검색 결과가 없습니다.`, false);
            return;
        }

        const frag = document.createDocumentFragment();
        list.forEach(p => {
            const tr = document.createElement('tr');

            // 부서 (+ 위치)
            const tdDept = document.createElement('td');
            tdDept.append(document.createTextNode(p.title));
            if (p.location) {
                const loc = document.createElement('span');
                loc.className = 'staff-loc';
                loc.textContent = p.location;
                tdDept.appendChild(loc);
            }

            const tdName = document.createElement('td');
            tdName.textContent = p.name;

            // 내선번호는 모바일에서 바로 걸 수 있게 tel: 링크
            const tdExt = document.createElement('td');
            const tel = document.createElement('a');
            tel.className = 'staff-ext';
            tel.href = 'tel:' + p.ext;
            tel.textContent = p.ext;
            tdExt.appendChild(tel);

            tr.append(tdDept, tdName, tdExt);
            frag.appendChild(tr);
        });

        elBody.appendChild(frag);
        elTable.hidden = false;
        if (elResult) elResult.scrollTop = 0;   // 새 검색이면 결과 목록 맨 위로
        setCount(`${list.length}명`);
    }

    function setCount(text) {
        if (elCount) elCount.textContent = text;
    }

    function showMsg(text, isWarning) {
        if (!elMsg) return;
        elMsg.textContent = text;
        elMsg.classList.toggle('is-warning', !!isWarning);
        elMsg.classList.add('is-open');

        if (msgTimer) clearTimeout(msgTimer);
        msgTimer = setTimeout(() => elMsg.classList.remove('is-open'), 3000);
    }

    function hideMsg() {
        if (msgTimer) clearTimeout(msgTimer);
        elMsg?.classList.remove('is-open');
    }

    /* ---------- 입력 처리 ---------- */
    function handleInput() {
        if (!elInput) return;

        // ⚠️ 한글 조합 중에는 value를 건드리지 않습니다 (글자 깨짐 방지)
        if (!composing) {
            const before = elInput.value;
            const after = before.replace(ALLOWED, '');
            if (before !== after) {
                elInput.value = after;
                showMsg('⚠️ 한글 또는 숫자로만 검색할 수 있습니다.', true);
            }
        }

        const keyword = elInput.value.trim();
        if (!keyword) {
            hideMsg();
            render([], '');
            return;
        }
        render(search(keyword), keyword);
    }

    function reset() {
        if (!elInput) return;
        elInput.value = '';
        hideMsg();
        render([], '');
        elInput.focus();
    }

    /* ---------- 초기화 ---------- */
    function init() {
        elInput = document.getElementById('searchBox');
        elBody = document.getElementById('resultBody');
        elTable = document.getElementById('resultTable');
        elMsg = document.getElementById('staffMsg');
        elCount = document.getElementById('staffCount');
        elResult = document.getElementById('staffResult');

        // 카드를 숨기거나 삭제했더라도 조용히 넘어갑니다
        if (!elInput || !elBody || !elTable) return;

        roster = buildRoster();
        elTable.hidden = true;

        elInput.addEventListener('compositionstart', () => { composing = true; });
        elInput.addEventListener('compositionend', () => {
            composing = false;
            handleInput();
        });
        elInput.addEventListener('input', handleInput);
        elInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') reset();
        });

        document.getElementById('resetButton')?.addEventListener('click', reset);
    }

    return { init, search, reset, get roster() { return roster; } };
})();