// admin-sdk.js (예시 파일)
const admin = require('firebase-admin');
const serviceAccount = require('./sungilnow-firebase-adminsdk.json'); // 다운로드한 파일 경로

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

module.exports = { db, messaging };