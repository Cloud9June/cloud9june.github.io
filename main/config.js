/*
==========================================
 성일정보고 링크 허브 - 환경 설정
------------------------------------------
 ⦿ 제작자 : 성일정보고등학교 교육정보부장 김형준
 ⦿ 최초 작성 : 2026-09-18
------------------------------------------
 바뀔 수 있는 값(API 키, 학교 코드, 시트 주소 등)을 한 곳에 모았습니다.
 로직은 main.js, 저장은 store.js, 설정은 이 파일입니다.

 ⚠️ 주의
 이 파일의 키는 브라우저 소스에 그대로 노출됩니다. (기존과 동일)
 Firestore 개편 시 NEIS/기상청 호출을 Cloud Functions로 옮기고
 아래 endpoint 주소만 교체하면 키를 감출 수 있습니다.
==========================================
*/

const CONFIG = {
    // ===== 저장소 접두어 =====
    // localStorage 는 '출처(도메인)' 단위로 공유됩니다.
    // 베타를 같은 도메인의 다른 경로(/beta 등)에 두면 운영본과 저장소가 겹치므로,
    // 베타 빌드에서는 이 값을 'eduinfo.beta.' 로 바꿔 서로 침범하지 않게 하세요.
    //   운영본 : 'eduinfo.'        (비워두면 이 값이 쓰입니다)
    //   베타   : 'eduinfo.beta.'
    storagePrefix: 'eduinfo.',

    // ===== 학교 기본 정보 =====
    school: {
        name: '성일정보고등학교',
        officeCode: 'J10',      // 경기도교육청
        schoolCode: '7530167'   // 성일정보고
    },

    // ===== NEIS 급식 API =====
    // TODO(Firestore 개편): endpoint 를 Cloud Functions 프록시 주소로 교체하고 key 제거
    neis: {
        endpoint: 'https://open.neis.go.kr/hub/mealServiceDietInfo',
        key: 'bdcd0ca692e6441a8522db4496c56216'
    },

    // ===== 기상청 단기예보 API =====
    // TODO(Firestore 개편): 동일하게 프록시로 이전
    weather: {
        endpoint: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
        serviceKey: 'ed175a454d98c792477c333a80a7305d1f49e0ef31e8a3d75110c111023879bd',
        nx: 62,                     // 성남 좌표
        ny: 124,
        refreshMinutes: 30
    },

    // ===== 일일근무 현황 (구글 시트 CSV 공개 주소) =====
    duty: {
        csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR3jc-6ORNFCO2KGxiAJdvZ87JLAyTDgOxEEd2atN4q38jWjGAdBbT4q1LaIMnz2q68-8K9i1JR0yNs/pub?gid=0&single=true&output=csv',
        sheetUrl: 'https://docs.google.com/spreadsheets/d/1fooMUmUyiABOSiesvtd9FoD2Fs8jRq1VB_T9nYSkOCo/edit?gid=0#gid=0'
    },

    // ===== 급식 위젯 동작 =====
    meal: {
        appUrl: '/food',            // 급식 신청·조회 시스템
        // 이 시각(KST)이 지나면 다음 급식일로 전환
        // 점심시간이 12:50~13:50 이라 배식이 끝난 뒤인 14시로 둡니다.
        switchToTomorrowHour: 14,
        lookAheadDays: 14           // 급식이 없는 날(공휴일·행사일)은 이 기간 안에서 다음 급식일을 찾음
    },

    // ===== 개인화 제한 =====
    limits: {
        personalLinks: 12,
        personalLinkNameLength: 10,
        memos: 5
    },

    // ===== 전광판 문구 =====
    ticker: [
        '📣 2026학년도 성일정보고등학교 화이팅!!'
    ],

    // ===== Firebase (개편 시 사용) =====
    // firebase: { apiKey: '...', authDomain: '...', projectId: '...' },
    firebase: null
};