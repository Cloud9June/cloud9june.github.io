document.addEventListener('DOMContentLoaded', () => {

    const panels = document.querySelectorAll('.image-panel');
    const panelCount = panels.length;

    // --- 설정 변수 ---
    const TOTAL_SETS = 4;      // 👈 보여줄 총 사진 세트 수 (예: 1~, 1-1~, 2-1~, 3-1~ 이면 4세트)
    const ENTRY_DURATION = 800;
    const ENTRY_DELAY = 250;
    const STATIC_DURATION = 10000;
    const REPLACE_DURATION = 500;
    const EXIT_DURATION = 800;
    const FINAL_DELAY = 2000;

    let currentSet = 1;

    /* 🔹 이미지 경로 규칙 최적화 */
    function getImg(panelId, set) {
        const idx = panelId.replace('img', '');

        return set === 1
            ? `images/${idx}.png`
            : `images/${set - 1}-${idx}.png`;
    }

    /* 🔹 1. ENTRY (첫 번째 세트 등장) */
    function sequenceEntry() {
        currentSet = 1;

        panels.forEach((panel, i) => {
            panel.classList.remove('panel-active', 'panel-remove');
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-100vh)';
            panel.style.animationDelay = '0ms';
            void panel.offsetWidth; // Reflow

            panel.style.animationDelay = `${i * ENTRY_DELAY}ms`;
            panel.classList.add('panel-active');

            const img = panel.querySelector('img');
            img.src = getImg(panel.id, 1);
            img.className = 'main-img';
            img.style.transform = 'translateX(0)';
        });

        const total = ENTRY_DURATION + (panelCount - 1) * ENTRY_DELAY;
        setTimeout(sequenceStatic, total);
    }

    /* 🔹 2. STATIC (정지 상태 효과) */
    function sequenceStatic() {
        panels.forEach(panel => {
            const inner = panel.querySelector('.img-inner');
            inner.classList.add('idle-zoom', 'idle-bright');
        });

        // 지정된 시간 대기 후 교체 로직 실행
        setTimeout(sequenceReplace, STATIC_DURATION);
    }

    /* 🔹 3. IMAGE REPLACE (다음 세트로 슬라이드 교체) */
    function sequenceReplace() {
        // 교체 시작 전 효과 제거
        panels.forEach(panel => {
            const inner = panel.querySelector('.img-inner');
            inner.classList.remove('idle-zoom', 'idle-bright');
        });

        // 👈 다음 세트가 있는지 확인
        if (currentSet < TOTAL_SETS) {
            currentSet++;
            console.log(`Switching to Set: ${currentSet}`);

            panels.forEach(panel => {
                const inner = panel.querySelector('.img-inner');
                const oldImg = inner.querySelector('img');

                // 새 이미지 요소 생성 및 배치
                const newImg = document.createElement('img');
                newImg.src = getImg(panel.id, currentSet);
                newImg.classList.add('new-img');
                newImg.style.transform = 'translateX(100%)'; // 오른쪽 대기
                newImg.style.transition = `transform ${REPLACE_DURATION}ms ease-out`;

                oldImg.classList.add('old-img');
                inner.appendChild(newImg);

                // 애니메이션 트리거
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        newImg.style.transform = 'translateX(0)';
                    });
                });
            });

            // 슬라이드 완료 후 정리
            setTimeout(() => {
                panels.forEach(panel => {
                    const inner = panel.querySelector('.img-inner');
                    const old = inner.querySelector('.old-img');
                    if (old) old.remove();

                    const cur = inner.querySelector('.new-img');
                    if (cur) {
                        cur.classList.remove('new-img');
                        cur.classList.add('main-img');
                        cur.style.transition = '';
                    }
                });
                
                // 다시 정지(Static) 상태로 가서 다음 교체 대기
                sequenceStatic(); 
            }, REPLACE_DURATION);

        } else {
            // 모든 세트를 다 보여줬다면 퇴장 로직 실행
            sequenceExit();
        }
    }

    /* 🔹 4. EXIT (전체 판 퇴장) */
    function sequenceExit() {
        panels.forEach(panel => {
            panel.classList.remove('panel-active', 'panel-remove');
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
            panel.style.animationDelay = '0ms';
            void panel.offsetWidth;
        });

        panels.forEach((panel, i) => {
            panel.style.animationDelay = `${i * ENTRY_DELAY}ms`;
            panel.classList.add('panel-remove');
        });

        const total = EXIT_DURATION + (panelCount - 1) * ENTRY_DELAY;
        setTimeout(sequenceResetAndLoop, total);
    }

    /* 🔹 5. RESET (초기화 및 무한 반복) */
    function sequenceResetAndLoop() {
        panels.forEach(panel => {
            panel.classList.remove('panel-active', 'panel-remove');
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-100vh)';
            
            // 내부 이미지 태그들을 첫 세트 상태로 초기화
            const inner = panel.querySelector('.img-inner');
            inner.innerHTML = `<img src="${getImg(panel.id, 1)}" class="main-img">`;
        });

        setTimeout(sequenceEntry, FINAL_DELAY);
    }

    sequenceEntry();
});