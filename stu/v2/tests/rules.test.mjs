/* ============================================================
   S:NOW Firestore 보안 규칙 테스트

   실행:  npm test          (에뮬레이터를 자동으로 띄웠다 내립니다)
   조건:  Java 11 이상,  npm install 완료

   규칙을 고칠 때마다 이 파일을 돌리세요.
   "권한이 있어야 하는 사람"과 "없어야 하는 사람"을 모두 확인합니다.
   ============================================================ */
import { test, before, after, beforeEach, describe } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  collection, query, where, serverTimestamp, arrayRemove,
} from "firebase/firestore";

const HERE = dirname(fileURLToPath(import.meta.url));
let env;

/* ── 등장인물 ──────────────────────────────────────────── */
const P = {
  super:    "june@sungil-i.kr",      // 교사 · 총관리자 · 2-3 담임
  admin:    "admin@sungil-i.kr",     // 교사 · 관리자 (총관리자 아님)
  homeroom: "hong@sungil-i.kr",      // 교사 · 1-1 담임
  lead:     "lead@sungil-i.kr",      // 학생 2-3 · 1번 · 반장
  s14:      "s14@sungil-i.kr",       // 학생 2-3 · 14번 · 권한 없음
  s20:      "s20@sungil-i.kr",       // 학생 2-3 · 20번 · 권한 없음
  other:    "other@sungil-i.kr",     // 학생 1-1 · 5번
  ghost:    "ghost@sungil-i.kr",     // 학교 계정이지만 명부에 없음
  outsider: "someone@gmail.com",     // 외부 구글 계정
};

const ROSTER = {
  [P.super]:    { name: "김형준", role: "교사", grade: 2, class: 3, classKey: "2-3", privilege: ["총관리자", "담임"] },
  [P.admin]:    { name: "박선영", role: "교사", privilege: ["관리자"] },
  [P.homeroom]: { name: "홍길동", role: "교사", grade: 1, class: 1, classKey: "1-1", privilege: ["담임"] },
  [P.lead]:     { name: "김서준", role: "학생", grade: 2, class: 3, classKey: "2-3", number: 1,  privilege: ["반장"] },
  [P.s14]:      { name: "이지우", role: "학생", grade: 2, class: 3, classKey: "2-3", number: 14, privilege: [] },
  [P.s20]:      { name: "정민준", role: "학생", grade: 2, class: 3, classKey: "2-3", number: 20, privilege: [] },
  [P.other]:    { name: "최이환", role: "학생", grade: 1, class: 1, classKey: "1-1", number: 5,  privilege: [] },
};

/** 로그인한 사람의 Firestore 핸들 */
const as = (email) =>
  env.authenticatedContext(email.replace(/[^a-z0-9]/gi, ""), { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

/** 정상적인 글 한 건 */
const post = (email, extra = {}) => ({
  title: "테스트 공지",
  content: "본문입니다.",
  authorName: "테스트",
  authorEmail: email,
  createdAt: serverTimestamp(),
  ...extra,
});

/* ── 준비 ──────────────────────────────────────────────── */
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "snow-test",
    firestore: {
      rules: readFileSync(join(HERE, "..", "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [email, data] of Object.entries(ROSTER)) {
      await setDoc(doc(db, "users", email), data);
    }
    await setDoc(doc(db, "feeds", "f1"), post(P.admin, { createdAt: new Date() }));
    await setDoc(doc(db, "externalFeeds", "e1"), post(P.admin, { createdAt: new Date() }));
    await setDoc(doc(db, "classFeeds", "2-3", "items", "c1"),
      post(P.super, { createdAt: new Date(), important: true, students: [14, 20] }));
    await setDoc(doc(db, "classFeeds", "1-1", "items", "d1"),
      post(P.homeroom, { createdAt: new Date() }));
  });
});

/* ══ 1. 누가 들어올 수 있나 ══════════════════════════════ */
describe("1. 접근 자체", () => {
  test("외부 구글 계정은 전체 피드를 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(as(P.outsider), "feeds", "f1")));
  });

  test("명부에 없는 학교 계정은 전체 피드를 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(as(P.ghost), "feeds", "f1")));
  });

  test("명부에 없는 계정도 '자기 문서'는 조회할 수 있다 (등록 안내를 띄우기 위해)", async () => {
    await assertSucceeds(getDoc(doc(as(P.ghost), "users", P.ghost)));
  });

  test("명부에 있는 학생은 전체 피드를 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(as(P.s14), "feeds", "f1")));
  });

  test("로그인하지 않아도 대외 피드는 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(anon(), "externalFeeds", "e1")));
  });

  test("로그인하지 않으면 전체 피드는 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(anon(), "feeds", "f1")));
  });
});

/* ══ 2. 글쓰기 권한 ══════════════════════════════════════ */
describe("2. 글쓰기 권한", () => {
  test("일반 학생은 전체 피드에 글을 쓸 수 없다", async () => {
    await assertFails(addDoc(collection(as(P.s14), "feeds"), post(P.s14)));
  });

  test("반장도 전체 피드에는 쓸 수 없다", async () => {
    await assertFails(addDoc(collection(as(P.lead), "feeds"), post(P.lead)));
  });

  test("담임만으로는 전체 피드에 쓸 수 없다", async () => {
    await assertFails(addDoc(collection(as(P.homeroom), "feeds"), post(P.homeroom)));
  });

  test("관리자는 전체 피드에 쓸 수 있다", async () => {
    await assertSucceeds(addDoc(collection(as(P.admin), "feeds"), post(P.admin)));
  });

  test("일반 학생은 전체 피드를 지울 수 없다", async () => {
    await assertFails(deleteDoc(doc(as(P.s14), "feeds", "f1")));
  });

  test("관리자는 전체 피드를 지울 수 있다", async () => {
    await assertSucceeds(deleteDoc(doc(as(P.admin), "feeds", "f1")));
  });

  test("반장은 자기 반 피드에 쓸 수 있다", async () => {
    await assertSucceeds(addDoc(collection(as(P.lead), "classFeeds", "2-3", "items"), post(P.lead)));
  });

  test("반장이라도 다른 반 피드에는 쓸 수 없다", async () => {
    await assertFails(addDoc(collection(as(P.lead), "classFeeds", "1-1", "items"), post(P.lead)));
  });

  test("일반 학생은 자기 반 피드에도 쓸 수 없다", async () => {
    await assertFails(addDoc(collection(as(P.s14), "classFeeds", "2-3", "items"), post(P.s14)));
  });

  test("담임은 자기 반 피드에 쓸 수 있다", async () => {
    await assertSucceeds(addDoc(collection(as(P.homeroom), "classFeeds", "1-1", "items"), post(P.homeroom)));
  });
});

/* ══ 3. 위조 방지 ════════════════════════════════════════ */
describe("3. 문서 위조", () => {
  test("작성자 이메일을 남의 것으로 적으면 거부된다", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"),
      post(P.admin, { authorEmail: P.super })));
  });

  test("createdAt 을 임의 시각으로 넣으면 거부된다 (상단 고정 방지)", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"),
      post(P.admin, { createdAt: new Date("2099-01-01") })));
  });

  test("허용되지 않은 필드를 넣으면 거부된다", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"),
      post(P.admin, { pinned: true })));
  });

  test("제목이 비어 있으면 거부된다", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"), post(P.admin, { title: "" })));
  });

  test("본문이 3000자를 넘으면 거부된다", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"),
      post(P.admin, { content: "가".repeat(3001) })));
  });

  test("태그가 12개를 넘으면 거부된다", async () => {
    await assertFails(addDoc(collection(as(P.admin), "feeds"),
      post(P.admin, { tags: Array.from({ length: 13 }, (_, i) => "#t" + i) })));
  });
});

/* ══ 4. 반별 피드 열람 ═══════════════════════════════════ */
describe("4. 반별 피드 열람", () => {
  test("같은 반 학생은 우리반 피드를 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(as(P.s14), "classFeeds", "2-3", "items", "c1")));
  });

  test("다른 반 학생은 우리반 피드를 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(as(P.other), "classFeeds", "2-3", "items", "c1")));
  });

  test("교사는 담임이 아닌 반도 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(as(P.homeroom), "classFeeds", "2-3", "items", "c1")));
  });
});

/* ══ 5. 중요 알림 확인 처리 ══════════════════════════════ */
describe("5. 중요 알림 확인", () => {
  const ref = (db) => doc(db, "classFeeds", "2-3", "items", "c1");

  test("학생이 자기 번호를 빼는 것은 허용된다 (arrayRemove)", async () => {
    await assertSucceeds(updateDoc(ref(as(P.s14)), { students: arrayRemove(14) }));
  });

  test("학생이 남의 번호를 빼면 거부된다", async () => {
    await assertFails(updateDoc(ref(as(P.s14)), { students: arrayRemove(20) }));
  });

  test("students 를 통째로 비우면 거부된다", async () => {
    await assertFails(updateDoc(ref(as(P.s14)), { students: [] }));
  });

  test("확인하면서 다른 필드를 같이 바꾸면 거부된다", async () => {
    await assertFails(updateDoc(ref(as(P.s14)),
      { students: arrayRemove(14), title: "몰래 바꾼 제목" }));
  });

  test("다른 반 학생은 확인 처리를 할 수 없다", async () => {
    await assertFails(updateDoc(ref(as(P.other)), { students: arrayRemove(5) }));
  });

  test("담임은 글 내용을 수정할 수 있다", async () => {
    await assertSucceeds(updateDoc(ref(as(P.super)),
      { title: "수정된 제목", content: "수정된 본문", updatedAt: serverTimestamp() }));
  });

  test("학생은 글 내용을 수정할 수 없다", async () => {
    await assertFails(updateDoc(ref(as(P.s14)),
      { title: "수정", content: "수정", updatedAt: serverTimestamp() }));
  });
});

/* ══ 6. 명부 ═════════════════════════════════════════════ */
describe("6. 명부 · 권한", () => {
  const newUser = { name: "새학생", role: "학생", grade: 2, class: 3, classKey: "2-3", number: 30, privilege: [] };

  test("총관리자는 명부를 추가할 수 있다", async () => {
    await assertSucceeds(setDoc(doc(as(P.super), "users", "new@sungil-i.kr"), newUser));
  });

  test("관리자(총관리자 아님)는 명부를 바꿀 수 없다", async () => {
    await assertFails(setDoc(doc(as(P.admin), "users", "new@sungil-i.kr"), newUser));
  });

  test("학생은 자기 권한을 올릴 수 없다", async () => {
    await assertFails(setDoc(doc(as(P.s14), "users", P.s14),
      { ...ROSTER[P.s14], privilege: ["총관리자"] }));
  });

  test("학생은 남의 명부 문서를 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(as(P.s14), "users", P.s20)));
  });

  test("학생은 자기 문서는 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(as(P.s14), "users", P.s14)));
  });

  test("같은 반 명부는 목록 조회할 수 있다 (중요 알림에 번호를 붙이기 위해)", async () => {
    await assertSucceeds(getDocs(query(
      collection(as(P.lead), "users"), where("classKey", "==", "2-3"))));
  });

  test("다른 반 명부는 목록 조회할 수 없다", async () => {
    await assertFails(getDocs(query(
      collection(as(P.other), "users"), where("classKey", "==", "2-3"))));
  });

  test("조건 없이 명부 전체를 훑을 수 없다", async () => {
    await assertFails(getDocs(collection(as(P.s14), "users")));
  });

  test("교사는 명부 전체를 조회할 수 있다", async () => {
    await assertSucceeds(getDocs(collection(as(P.homeroom), "users")));
  });
});
