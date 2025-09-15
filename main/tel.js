// 초성을 추출하는 함수 (유니코드 기반 초성 분리)
function getChosung(str) {
    const CHOSUNG_LIST = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", 
        "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
    ];
    return str.split('').map(char => {
        let code = char.charCodeAt(0) - 0xAC00;
        if (code < 0 || code > 11171) return char; // 한글이 아니면 그대로 반환
        return CHOSUNG_LIST[Math.floor(code / 588)]; // 초성 추출
    }).join('');
}

// 위치 자동 할당
data.forEach(person => {
    const title = person.title;
    if (/(도제교육부|학생생활안전부|1학년부|교육정보부|교육연구부|교육과정부|교무기획부|교감)/.test(title)) {
        person.location = "본관 1층 교무실";
    } else if (/(IT교육부|상업교육부|창의인성부|과학환경부|2학년부|3학년부)/.test(title)) {
        person.location = "본관 2층 교무실";
    } else if (/예술체육부/.test(title)) {
        person.location = "자미원 3층 미지움";
    } else if (/(행정실장|행정부장|주무관|행정실무사)/.test(title)) {
        person.location = "행정실";
    } else {
        person.location = "";
    }
});

// ===== 검색창 한글 입력 전용 =====
const searchBox = document.getElementById('searchBox');
const resultBody = document.getElementById('resultBody');
const resultTable = document.getElementById('resultTable');

// 안내 메시지를 표시할 전용 영역 추가
let msgBox = document.createElement('div');
msgBox.id = "noticeMsg";
msgBox.style.color = "#ff6b6b";
msgBox.style.textAlign = "center";
msgBox.style.marginTop = "10px";
msgBox.style.fontSize = "14px";
msgBox.style.display = "none";
resultTable.insertAdjacentElement("afterend", msgBox);

let msgTimer = null;

if (searchBox) {
  searchBox.addEventListener('input', (e) => {
    const before = e.target.value;
    e.target.value = before.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, '');

    // 영어/숫자 등이 입력되었다가 지워진 경우
    if (before !== e.target.value) {
      resultTable.style.display = "none"; // 테이블 숨김
      resultBody.innerHTML = ""; // 기존 결과 제거

      msgBox.textContent = "⚠️ 교직원 내선 검색은 한글로만 입력 가능합니다.";
      msgBox.style.display = "block";
      msgBox.style.textAlign = "left";

      // 3초 후 메시지 자동 숨김
      if (msgTimer) clearTimeout(msgTimer);
      msgTimer = setTimeout(() => {
        msgBox.style.display = "none";
      }, 3000);
    }
  });
}

function searchStaff() {
    let input = document.getElementById('searchBox').value.trim();
    let resultBody = document.getElementById('resultBody');
    let resultTable = document.getElementById('resultTable');
    resultBody.innerHTML = "";
    const frontNum = "0317201";

    if (input === "") {
        resultTable.style.display = "none";
        return;
    }

    let isChosungSearch = /^[ㄱ-ㅎ]+$/.test(input);  // 초성 검색 여부 확인

    let foundList = data.filter(person => {
        // 숫자만 단독으로 입력된 경우 (1, 2, 3)
        if (/^[1-3]$/.test(input)) {
            return person.title.startsWith(input + "학년부");
        }

        if (isChosungSearch) {
            const nameChosung = getChosung(person.name);
            const titleChosung = getChosung(person.title);

            if (nameChosung.includes(input)) return true;
            if (input.length >= 4 && titleChosung.includes(input)) return true;

            return false;
        } else {
            if (person.name.includes(input)) return true;
            if (input.length >= 4 && person.title.includes(input)) return true;
            return false;
        }
    });

    if (foundList.length > 0) {
        resultTable.style.display = "table";
        foundList.forEach(person => {
            let fullNum = frontNum + person.ext;
            let row = `<tr><td>${person.title}</td><td>${person.name}</td><td><a href="tel:${fullNum}">${person.ext}</a></td>
            resultBody.innerHTML += row;
        });
    } else {
        resultTable.style.display = "none";
    }
}

function resetSearch() {
    document.getElementById('searchBox').value = ""; // 검색창 초기화
    document.getElementById('resultBody').innerHTML = ""; // 결과 삭제
    document.getElementById('resultTable').style.display = "none"; // 테이블 숨기기
    document.getElementById('searchBox').focus();  // 포커스 이동
}
