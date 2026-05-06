// 1. 명언 데이터 (배열)
const quotes = [
    { text: "시작이 반이다.", author: "속담" },
    { text: "어제보다 나은 내일을 만들자.", author: "자기계발" },
    { text: "작은 일의 반복이 큰 성취를 만든다.", author: "무명" },
    { text: "오늘 걷지 않으면 내일은 뛰어야 한다.", author: "격언" },
    { text: "충분히 휴식하라. 밭도 쉬어야 풍작을 거둔다.", author: "오비디우스" }
];

// 2. 랜덤 명언 출력 함수
function showRandomQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    document.getElementById('quote').innerText = `"${quotes[randomIndex].text}"`;
    document.getElementById('author').innerText = `- ${quotes[randomIndex].author} -`;
}

// 3. 할 일 추가 함수
function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    
    if (text === "") return; // 빈 값 방지

    const li = document.createElement('li');
    li.innerHTML = `
        <span onclick="toggleComplete(this)">${text}</span>
        <button onclick="deleteTodo(this)" style="background: #ff4d4d; padding: 3px 8px; font-size: 12px;">삭제</button>
    `;
    
    document.getElementById('todo-list').appendChild(li);
    input.value = ""; // 입력창 비우기
}

// 4. 완료 체크 (토글) 함수
function toggleComplete(element) {
    element.classList.toggle('completed');
}

// 5. 삭제 함수
function deleteTodo(button) {
    button.parentElement.remove();
}

// 페이지 로드 시 실행
window.onload = function() {
    showRandomQuote();
    // 날짜 표시
    const now = new Date();
    document.getElementById('today-date').innerText = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
}