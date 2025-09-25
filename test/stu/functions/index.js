// index.js (Firebase Cloud Functions 파일)
const functions = require("firebase-functions");
const { messaging, db } = require("./admin-sdk"); // 1단계에서 만든 파일

// 'feeds/{month}/items/{feedId}' 경로에 새로운 문서가 추가될 때 실행됩니다.
exports.sendNewFeedNotification = functions.firestore
  .document("feeds/{month}/items/{feedId}")
  .onCreate(async (snap, context) => {
    const newFeed = snap.data();
    const { title, content } = newFeed;

    // 1. 모든 사용자의 토큰을 가져옵니다.
    // 실제로는 토큰을 저장할 별도의 'fcmTokens' 같은 컬렉션을 만드는 것이 좋습니다.
    const tokensSnapshot = await db.collection("fcmTokens").get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
      console.log("알림을 보낼 토큰이 없습니다.");
      return null;
    }

    // 2. 알림 메시지를 구성합니다.
    const payload = {
      notification: {
        title: `${title}`,
        body: `${content.substring(0, 50)}...`, // 내용이 너무 길지 않게 자르기
        // 알림 클릭 시 이동할 URL을 설정할 수 있습니다.
        click_action: "https://eduinfo.sungil-i.kr/stu" 
      }
    };

    // 3. 메시지를 모든 토큰에 보냅니다.
    try {
      const response = await messaging.sendEachForMulticast({ tokens, ...payload });
      console.log('알림 전송 성공:', response);
    } catch (error) {
      console.error('알림 전송 실패:', error);
    }
    return null;
  });

  // index.js (함수 추가)
exports.sendNewClassFeedNotification = functions.firestore
  .document("classFeeds/{classKey}/feeds_{month}/items/{feedId}")
  .onCreate(async (snap, context) => {
    // 위에서 만든 sendNewFeedNotification 함수와 동일한 로직을 적용하면 됩니다.
    // (토큰을 가져오고 알림을 보내는 코드)
    const newFeed = snap.data();
    const { title, content } = newFeed;

    const tokensSnapshot = await db.collection("fcmTokens").get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    
    // ... 알림 메시지 구성 및 전송 ...
    const payload = {
      notification: {
        title: `[우리반] ${title}`,
        body: `${content.substring(0, 50)}...`,
        click_action: "https://eduinfo.sungil-i.kr/stu"
      }
    };
    try {
      await messaging.sendEachForMulticast({ tokens, ...payload });
      console.log('우리반 피드 알림 전송 성공');
    } catch (error) {
      console.error('우리반 피드 알림 전송 실패:', error);
    }
    return null;
  });