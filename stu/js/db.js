/* ============================================================
   db.js — Firestore 접근 계층. DOM 을 전혀 모릅니다.

   컬렉션 구조 (v2에서 월별 분리를 없앴습니다)
     feeds/{id}                      전체 피드
     classFeeds/{classKey}/items/{id} 반별 피드
     externalFeeds/{id}              대외 피드
     users/{email}                   명부 + 권한
   ============================================================ */
import {
  collection, doc, query, orderBy, limit, startAfter,
  getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  serverTimestamp, arrayRemove, where, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import { db } from "./firebase.js";
import { PAGE_SIZE } from "./config.js";

/** 탭에 해당하는 컬렉션 참조 */
export function colRef(tab, classKey) {
  if (tab === "all") return collection(db, "feeds");
  if (tab === "external") return collection(db, "externalFeeds");
  if (tab === "class") {
    if (!classKey) throw new Error("classKey 가 필요합니다");
    return collection(db, "classFeeds", classKey, "items");
  }
  throw new Error("알 수 없는 탭: " + tab);
}

export function docRef(tab, classKey, id) {
  if (tab === "all") return doc(db, "feeds", id);
  if (tab === "external") return doc(db, "externalFeeds", id);
  return doc(db, "classFeeds", classKey, "items", id);
}

/**
 * 피드 한 페이지를 읽습니다.
 * @returns {{items:Array, cursor:any, done:boolean}}
 */
export async function listFeeds({ tab, classKey, cursor = null, pageSize = PAGE_SIZE }) {
  const parts = [orderBy("createdAt", "desc")];
  if (cursor) parts.push(startAfter(cursor));
  parts.push(limit(pageSize));

  const snap = await getDocs(query(colRef(tab, classKey), ...parts));
  const items = snap.docs.map(toFeed);

  return {
    items,
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor,
    done: snap.docs.length < pageSize,
  };
}

/** 실시간 구독 (키오스크 전용) */
export function watchFeeds({ tab, classKey, pageSize = 30 }, cb) {
  const q = query(colRef(tab, classKey), orderBy("createdAt", "desc"), limit(pageSize));
  return onSnapshot(q, (snap) => cb(snap.docs.map(toFeed)));
}

function toFeed(d) {
  const v = d.data();
  return {
    id: d.id,
    title: String(v.title ?? ""),
    content: String(v.content ?? ""),
    tags: Array.isArray(v.tags) ? v.tags.map(String) : [],
    important: v.important === true,
    students: Array.isArray(v.students) ? v.students : [],
    authorName: String(v.authorName ?? "작성자 미상"),
    authorEmail: String(v.authorEmail ?? ""),
    createdAt: v.createdAt?.toDate?.() ?? null,
    updatedAt: v.updatedAt?.toDate?.() ?? null,
  };
}

/* ── 쓰기 ──────────────────────────────────────────────── */

export async function createFeed({ tab, classKey, title, content, tags = [], important = false, students = [], me }) {
  const payload = {
    title,
    content,
    tags,
    authorName: me.role === "교사" ? `${me.name} 선생님` : me.name,
    authorEmail: me.email,
    createdAt: serverTimestamp(),
  };
  if (tab === "class") {
    payload.important = important;
    payload.students = important ? students : [];
  }
  const ref = await addDoc(colRef(tab, classKey), payload);
  return ref.id;
}

export async function editFeed({ tab, classKey, id, title, content, tags = [], important, students }) {
  const payload = { title, content, tags, updatedAt: serverTimestamp() };
  if (typeof important === "boolean") {
    payload.important = important;
    payload.students = important ? (students ?? []) : [];
  }
  await updateDoc(docRef(tab, classKey, id), payload);
}

export async function removeFeed({ tab, classKey, id }) {
  await deleteDoc(docRef(tab, classKey, id));
}

/** 학생이 중요 알림을 확인 — 본인 번호만 빠집니다 (규칙이 검증) */
export async function confirmRead({ classKey, id, number }) {
  await updateDoc(docRef("class", classKey, id), { students: arrayRemove(number) });
}

/* ── 본인 등록 ─────────────────────────────────────────── */

/**
 * 로그인한 본인이 명부 문서를 "최초 1회" 만듭니다.
 * 이미 문서가 있으면 규칙이 거부합니다 (create 는 신규일 때만 성공).
 * privilege 는 빈 배열로 고정 — 규칙도 이를 강제합니다.
 */
export async function registerSelf({ email, name, role, grade, klass, number }) {
  const payload = {
    name,
    role,
    privilege: [],
    status: role === "교사" ? "pending" : "active",
    selfRegistered: true,
    createdAt: serverTimestamp(),
  };

  if (role === "학생") {
    payload.grade = grade;
    payload.class = klass;
    payload.classKey = `${grade}-${klass}`;
    payload.number = number;
  } else if (grade && klass) {
    // 담임 신청 (총관리자가 승인하면서 확인합니다)
    payload.grade = grade;
    payload.class = klass;
    payload.classKey = `${grade}-${klass}`;
  }

  await setDoc(doc(db, "users", email), payload);
  return payload;
}

/* ── 명부 ──────────────────────────────────────────────── */

/** 같은 반 학생 번호 목록 (중요 알림 만들 때 사용) */
export async function listClassNumbers(classKey) {
  const q = query(collection(db, "users"), where("classKey", "==", classKey));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((u) => u.role !== "교사" && Number.isFinite(Number(u.number)))
    .map((u) => Number(u.number))
    .sort((a, b) => a - b);
}
