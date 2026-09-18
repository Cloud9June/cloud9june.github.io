/*
==========================================
 성일정보고 링크 허브 - 복무 결재선 데이터
------------------------------------------
 근무상황별 결재라인 정보
 (내용 변경 시 이 파일만 수정하면 됨)
------------------------------------------
 구조
   id     : 내부 식별자 (중복 불가)
   label  : 드롭다운에 보이는 이름
   note   : 항목 전체에 적용되는 안내 (선택)
   lines  : [{ position: 직급, line: 결재선, note: 이 직급만의 안내(선택) }]

 ⦿ 2026-09-18 정리
    · 반복되는 결재선을 상수로 묶어 오타·불일치 방지
    · note 위치를 label 바로 아래로 통일 (기존에는 위/아래가 섞여 있었음)
    · 내용 자체는 변경 없음
==========================================
*/

/* 여러 항목에서 똑같이 쓰이는 결재선 — 한 곳만 고치면 전부 반영됩니다 */
const LINE_PRINCIPAL_VIA_ADMIN = '본인 → 행정실장(협조) → 교장';
const LINE_BUDGET_REVIEW = '본인 → 담당부장 → 교감 → 행정실장(검토) → 교장';
const NOTE_BUDGET_SHARE = '행정실 전직원 공람';
const NOTE_TRIP = '출장자는 반드시 결재 완료 확인 후 출장 나갈 것';
const NOTE_TRIP_FULLDAY =
    '단, 08:50~16:50까지 출장인 경우: 본인 → 교무부장 → 교감 → 행정실장(협조) → 교장';

const approvalData = [
    {
        id: 'ext_lecture',
        label: '외부강의신고',
        note: '상신경로: 나이스 > 외부활동 > 외부강의등록\n(대결 지정 시 "공람"도 반드시 재설정)',
        lines: [
            { position: '전체', line: '기안자 → 업무담당자(정창곤)(공람) → 교무기획부장(검토) → 교감(검토) → 행정실장(협조) → 교장(결재)' }
        ]
    },
    {
        id: 'duty_with_time',
        label: '근무시간 있는 복무 (지각·외출·조퇴·반일연가·육아시간 등)',
        lines: [
            { position: '교장', line: '본인 → 행정실장(협조) → 교장(결재)' },
            { position: '교감', line: '본인 → 행정실장(공람) → 교장(결재)' },
            { position: '부장교사', line: '본인 → 교무부장 → 교감(결재)' },
            { position: '교사', line: '본인 → 교무부장 → 교감(결재)' }
        ]
    },
    {
        id: 'duty_without_time',
        label: '근무시간 없는 복무 (연가·병가·경조사휴가·공가 등)',
        note: '사전에 교무기획부장 > 교감님 > 교장님과 상의 (반일 등은 교감님까지)',
        lines: [
            { position: '교장', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '교감', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '부장교사', line: '본인 → 교무부장 → 교감 → 행정실장(공람) → 교장' },
            { position: '교사', line: '본인 → 교무부장 → 교감 → 행정실장(공람) → 교장' }
        ]
    },
    {
        id: 'trip_local',
        label: '출장 - 관내(성남지역)',
        note: NOTE_TRIP,
        lines: [
            { position: '교장', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '교감', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '부장교사', line: '본인 → 교무부장 → 행정실장(협조) → 교감', note: NOTE_TRIP_FULLDAY },
            { position: '교사', line: '본인 → 교무부장 → 출장업무관련부장(공람) → 행정실장(협조) → 교감', note: NOTE_TRIP_FULLDAY }
        ]
    },
    {
        id: 'trip_outside',
        label: '출장 - 관외',
        note: NOTE_TRIP,
        lines: [
            { position: '교장', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '교감', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '부장교사', line: '본인 → 교무부장 → 교감 → 행정실장(협조) → 교장' },
            { position: '교사', line: '본인 → 교무부장 → 출장업무관련부장(공람) → 교감 → 행정실장(협조) → 교장' }
        ]
    },
    {
        id: 'overtime',
        label: '초과근무 명령',
        note: '2시간 초과 시 1시간 공제, 1시간 인정 / 16:50~18:50 이상 근무부터 1시간 인정 시작\n10시 이전 상신, 13시 이전 결재 완료 필수',
        lines: [
            { position: '교장', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '교감', line: LINE_PRINCIPAL_VIA_ADMIN },
            { position: '교사/부장교사', line: '본인 → 해당업무관련부장 → 교감 → 행정실장(협조) → 교장' }
        ]
    },
    {
        id: 'flex_work',
        label: '유연근무',
        lines: [
            { position: '전체', line: '본인 → 교무부장 → 교감 → 행정실장(협조) → 교장' }
        ]
    },
    {
        id: 'edu_data_portal',
        label: '교육데이터포털(구:자료집계) 보고자료',
        note: '교감 결재 아님, "전결"임',
        lines: [
            { position: '전체', line: '기안자 → 담당부장 → 행정실장(협조) → 교감(전결)' }
        ]
    },
    {
        id: 'official_doc',
        label: '가정통신문·상장 등 직인 포함 서류',
        lines: [
            { position: '전체', line: '교사 → 담당부장 → 교감 → 행정실장(협조) → 교장' }
        ]
    },
    {
        id: 'evpn',
        label: 'EVPN 신청',
        note: '경로: 나이스 > 원격업무지원서비스, 요청사유란에 "원격업무" 기재',
        lines: [
            { position: '전체', line: '본인 → 교무부장 → 교감(전결)' }
        ]
    },
    {
        id: 'internal_plan',
        label: '내부계획(K-에듀파인 상신), 예산 무관',
        note: '직인 사용할 경우 "가정통신문·상장" 항목 참조',
        lines: [
            { position: '전체', line: '본인 → 담당부장 → 교감 → 교장' }
        ]
    },
    {
        id: 'budget_plan',
        label: '사업계획서 결재라인 (예산 포함)',
        note: NOTE_BUDGET_SHARE,
        lines: [
            { position: '전체', line: LINE_BUDGET_REVIEW }
        ]
    },
    {
        id: 'budget_use',
        label: '예산 사용 계획서 / 회계관련 결재',
        note: NOTE_BUDGET_SHARE,
        lines: [
            { position: '전체', line: LINE_BUDGET_REVIEW }
        ]
    },
    {
        id: 'budget_result',
        label: '예산 품의 전 내부계획 / 예산결과보고서',
        note: NOTE_BUDGET_SHARE,
        lines: [
            { position: '전체', line: LINE_BUDGET_REVIEW }
        ]
    }
];