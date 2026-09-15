/* =========================================================
   repo/totals.js — 일자별 총 급식 인원 (학생 + 교사)

   v1 대비 핵심 변경
   1) v1 은 같은 mealRequests 컬렉션을 세 함수에서 각각 getDocs 로 읽어
      읽기 비용이 3배였습니다. → 한 번만 읽어 재사용합니다.
   2) v1 은 페이지를 열기만 해도 totals 문서에 setDoc 을 했습니다.
      → 계산(computeTotals)과 저장(saveTotals)을 분리했습니다.
   3) v1 은 "2025-09-03 - 312명" 같은 표현용 문자열을 DB 에 저장하고
      화면에서 다시 파싱했습니다. → 숫자만 쓰고 문자열은 뷰에서 만듭니다.
      (단 v1 페이지가 strings 를 읽으므로 저장 시 미러는 유지)
   ========================================================= */

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase.js";
import { COL } from "../config.js";
import { monthKey, isoDate, dowOf, DOW_LABEL, pad2 } from "../util/date.js";
import { listMonthRequests, countTeachersPerDay, groupReasonsByDay } from "./requests.js";
import { loadStudentMonth, mirrorEffective } from "./students.js";

/**
 * 해당 월 총원 계산. **읽기 전용** — 아무것도 저장하지 않습니다.
 *
 * @returns {Promise<{
 *   rows: Array<{day:number, iso:string, dow:number, dowLabel:string,
 *                students:number, teachers:number, total:number}>,
 *   requests: Array, student: object, teacherPerDay: object,
 *   reasonsByDay: object, blocked: number[], notes: object,
 *   sumStudents:number, sumTeachers:number, sumTotal:number
 * }>}
 */
export async function computeTotals(year, month) {
  const [requests, student] = await Promise.all([
    listMonthRequests(year, month),   // 컬렉션 읽기 1회
    loadStudentMonth(year, month),
  ]);

  const teacherPerDay = countTeachersPerDay(requests);
  const reasonsByDay = groupReasonsByDay(requests);

  const rows = student.schoolDays.map((day) => {
    const key = String(day);
    const students = student.effective[key] || 0;
    const teachers = teacherPerDay[key] || 0;
    return {
      day,
      iso: isoDate(year, month, day),
      dow: dowOf(year, month, day),
      dowLabel: DOW_LABEL[dowOf(year, month, day)],
      students,
      teachers,
      total: students + teachers,
    };
  });

  return {
    rows,
    requests,
    student,
    teacherPerDay,
    reasonsByDay,
    blocked: student.blocked,
    notes: student.notes,
    sumStudents: rows.reduce((a, r) => a + r.students, 0),
    sumTeachers: rows.reduce((a, r) => a + r.teachers, 0),
    sumTotal: rows.reduce((a, r) => a + r.total, 0),
  };
}

/**
 * 총원 저장 (관리자가 명시적으로 버튼을 눌렀을 때만).
 * strings 는 v1 mealtotal.html 이 읽으므로 호환 미러로 함께 씁니다.
 */
export async function saveTotals(year, month, rows, effective = null) {
  const days = {};
  const strings = [];

  for (const row of rows) {
    days[String(row.day)] = row.total;
    strings.push(`${year}-${pad2(month)}-${pad2(row.day)} - ${row.total}명`);
  }

  await setDoc(doc(db, COL.TOTALS, monthKey(year, month)), {
    days,
    strings,                  // v1 호환 미러
    updatedAt: serverTimestamp(),
  });

  // v1 총원 페이지가 낡은 학생 수를 읽지 않도록 차감 반영본도 함께 동기화
  if (effective) await mirrorEffective(year, month, effective);

  return { days, strings };
}

/** 급식실 제출용 CSV */
export function toCsv(year, month, rows) {
  const header = "일자,요일,학생,교사,합계";
  const lines = rows.map((r) => `${r.iso},${r.dowLabel},${r.students},${r.teachers},${r.total}`);
  const sum = rows.reduce((a, r) => a + r.total, 0);
  return [header, ...lines, `합계,,,,${sum}`].join("\n");
}
