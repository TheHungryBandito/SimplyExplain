window.addEventListener('load', async () => {
    const upArrow = document.getElementById("up-arrow");
    const downArrow = document.getElementById("down-arrow");
    const scrollContainers = document.getElementsByClassName("scroll-container");
    const currentIndexArray = [];
    
    for (let i = 0; i < scrollContainers.length; i++) {
        scrollContainers[i].scrollBehaviour = "smooth";
        scrollContainers[i].addEventListener('wheel', async function(event) { 
            await onUserScroll(event, scrollContainers[i], i)
        });

        await changeCurrentElement(scrollContainers[i], i, 0);
    }

    upArrow.addEventListener('click', async () => {
        await incrementCurrentIndex(scrollContainers[0], 0, -1);
    })

    downArrow.addEventListener('click', async () => {
        await incrementCurrentIndex(scrollContainers[0], 0, 1);
    })

    async function onUserScroll(wheel, container, id) {
        if (!container.hasChildNodes()) {
            return;
        }
        const scrollDirection = await getScrollDirection(wheel);
        if (scrollDirection == 0) {
            return;
        }
        const newIndex = await getNextElementIndex(container, id, scrollDirection);
        await changeCurrentElement(container, id, newIndex);
    }

    async function getScrollDirection(wheel) {
        if (wheel.deltaY > 0) {
            return 1;
        }
        if (wheel.deltaY < 0) {
            return -1;
        }
        return 0;
    }

    async function getNextElementIndex(container, id, increment) {
        let newIndex = currentIndexArray[id] + increment;
        if (newIndex >= container.childElementCount) {
            return container.childElementCount - 1;
        }
        if (newIndex < 0) {
            return 0;
        }
        return newIndex;
    }

    async function changeCurrentElement(container, id, newIndex) {
        currentIndexArray[id] = newIndex;
        container.children[currentIndexArray[id]].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
        });
    }

    async function incrementCurrentIndex(container, id, increment) {
        let newIndex = await getNextElementIndex(container, id, increment);
        await changeCurrentElement(container, id, newIndex);
    }
});