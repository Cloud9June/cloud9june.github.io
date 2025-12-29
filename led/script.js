document.addEventListener('DOMContentLoaded', () => {

    const panels = document.querySelectorAll('.image-panel');
    const panelCount = panels.length;

    const ENTRY_DURATION = 800;
    const ENTRY_DELAY = 250;
    const STATIC_DURATION = 10000;
    const REPLACE_DURATION = 500;
    const EXIT_DURATION = 800;
    const FINAL_DELAY = 2000;

    let currentSet = 1;

    /* 이미지 경로 */
    function getImg(panelId, set) {
        const idx = panelId.replace('img', '');
        return set === 1
            ? `images/${idx}.jpg`
            : `images/1-${idx}.jpg`;
    }

    /* ENTRY */
    function sequenceEntry() {
        currentSet = 1;

        panels.forEach((panel, i) => {
            panel.classList.remove('panel-active', 'panel-remove');
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-100vh)';
            panel.style.animationDelay = '0ms';
            void panel.offsetWidth;

            panel.style.animationDelay = `${i * ENTRY_DELAY}ms`;
            panel.classList.add('panel-active');

            const img = panel.querySelector('img');
            img.src = getImg(panel.id, 1);
            img.className = '';
            img.style.transform = 'translateX(0)';
        });

        const total = ENTRY_DURATION + (panelCount - 1) * ENTRY_DELAY;
        setTimeout(sequenceStatic, total);
    }

    /* STATIC */
    function sequenceStatic() {
        console.log('STATIC START');
        panels.forEach(panel => {
            const inner = panel.querySelector('.img-inner');
            inner.classList.add('idle-zoom', 'idle-bright');
        });

        setTimeout(sequenceReplace, STATIC_DURATION);
    }

    /* IMAGE REPLACE (덮기 슬라이드) */
    function sequenceReplace() {

        panels.forEach(panel => {
            const inner = panel.querySelector('.img-inner');
            inner.classList.remove('idle-zoom', 'idle-bright');
        });

        const nextSet = currentSet === 1 ? 2 : 1;

        panels.forEach(panel => {
            const inner = panel.querySelector('.img-inner');
            const oldImg = inner.querySelector('img');

            const newImg = document.createElement('img');
            newImg.src = getImg(panel.id, nextSet);
            newImg.classList.add('new-img');
            newImg.style.transform = 'translateX(100%)';
            newImg.style.transition = `transform ${REPLACE_DURATION}ms ease-out`;

            oldImg.classList.add('old-img');
            oldImg.style.transform = 'translateX(0)';

            inner.appendChild(newImg);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newImg.style.transform = 'translateX(0)';
                });
            });
        });

        currentSet = nextSet;

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

            setTimeout(sequenceExit, STATIC_DURATION);
        }, REPLACE_DURATION);
    }

    /* EXIT */
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

    /* RESET */
    function sequenceResetAndLoop() {
        panels.forEach(panel => {
            panel.classList.remove('panel-active', 'panel-remove');
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-100vh)';
            panel.style.animationDelay = '0ms';
            void panel.offsetWidth;
        });

        setTimeout(sequenceEntry, FINAL_DELAY);
    }

    sequenceEntry();
});
