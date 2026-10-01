const sliderTrack = document.getElementById("works-track");
const mainWorkImage = document.getElementById("main-work-image");
const counter = document.querySelector(".counter");
const sliderViewport = document.querySelector(".slider__container");

if (sliderTrack && mainWorkImage && counter && sliderViewport) {
  const originalSlides = Array.from(sliderTrack.children);
  const totalSlides = originalSlides.length;

  if (!totalSlides) {
    counter.textContent = "00 / 00";
  } else {
    const slideData = originalSlides.map((slide) => {
      const image = slide.querySelector("img");

      return {
        src: image?.getAttribute("src") || "",
        alt: image?.getAttribute("alt") || "",
      };
    });

    const cloneCountPerSide = totalSlides;
    const totalRenderedSlides = totalSlides * 3;
    let selectedIndex = Math.min(4, totalSlides - 1);
    let selectionVersion = 0;
    let activeTransitionHandler = null;
    let isAnimating = false;

    const formatIndex = (value) => String(value + 1).padStart(2, "0");
    const normalizeIndex = (value) =>
      ((value % totalSlides) + totalSlides) % totalSlides;
    const getCanonicalDomIndex = (realIndex) => cloneCountPerSide + realIndex;
    const getOccurrences = (realIndex) => [
      realIndex,
      realIndex + totalSlides,
      realIndex + totalSlides * 2,
    ];

    const getMetrics = () => {
      const firstSlide = sliderTrack.querySelector(".work");

      if (!firstSlide) {
        return null;
      }

      const slideWidth = firstSlide.getBoundingClientRect().width;
      const trackStyles = window.getComputedStyle(sliderTrack);
      const viewportStyles = window.getComputedStyle(sliderViewport);
      const gap = parseFloat(trackStyles.gap || trackStyles.columnGap || "0");
      const viewportWidth = sliderViewport.getBoundingClientRect().width;
      const viewportPaddingLeft = parseFloat(viewportStyles.paddingLeft || "0");

      return {
        slideWidth,
        unitWidth: slideWidth + gap,
        centerPoint: viewportWidth / 2 - viewportPaddingLeft,
      };
    };

    const getCurrentOffset = () => {
      const transform = window.getComputedStyle(sliderTrack).transform;

      if (!transform || transform === "none") {
        return 0;
      }

      return -new DOMMatrixReadOnly(transform).m41;
    };

    const getCurrentDomPosition = () => {
      const metrics = getMetrics();

      if (!metrics || !metrics.unitWidth) {
        return getCanonicalDomIndex(selectedIndex);
      }

      return (
        (getCurrentOffset() + metrics.centerPoint - metrics.slideWidth / 2) /
        metrics.unitWidth
      );
    };

    const getOffsetForDomIndex = (domIndex) => {
      const metrics = getMetrics();

      if (!metrics || !metrics.unitWidth) {
        return 0;
      }

      const slideCenter = domIndex * metrics.unitWidth + metrics.slideWidth / 2;
      return slideCenter - metrics.centerPoint;
    };

    const updateCounter = () => {
      counter.textContent = `${formatIndex(selectedIndex)} / ${formatIndex(
        totalSlides - 1
      )}`;
    };

    const updateMainImage = () => {
      mainWorkImage.src = slideData[selectedIndex].src;
      mainWorkImage.alt = slideData[selectedIndex].alt;
    };

    const updateActiveStates = () => {
      const activeDomIndex = getCanonicalDomIndex(selectedIndex);

      sliderTrack.querySelectorAll(".work").forEach((slide) => {
        slide.classList.toggle(
          "is-active",
          Number(slide.dataset.domIndex) === activeDomIndex
        );
      });
    };

    const stopTrackAnimation = () => {
      if (activeTransitionHandler) {
        sliderTrack.removeEventListener("transitionend", activeTransitionHandler);
        activeTransitionHandler = null;
      }

      const currentOffset = getCurrentOffset();
      sliderTrack.style.transition = "none";
      sliderTrack.style.transform = `translateX(${-currentOffset}px)`;
    };

    const setTrackOffset = (offset, animate, onComplete) => {
      if (activeTransitionHandler) {
        sliderTrack.removeEventListener("transitionend", activeTransitionHandler);
        activeTransitionHandler = null;
      }

      sliderTrack.style.transition = animate
        ? "transform 0.45s cubic-bezier(.4, 0, .2, 1)"
        : "none";
      sliderTrack.style.transform = `translateX(${-offset}px)`;

      if (!onComplete) {
        return;
      }

      if (!animate) {
        onComplete();
        return;
      }

      activeTransitionHandler = (event) => {
        if (event.target !== sliderTrack || event.propertyName !== "transform") {
          return;
        }

        sliderTrack.removeEventListener("transitionend", activeTransitionHandler);
        activeTransitionHandler = null;
        onComplete();
      };

      sliderTrack.addEventListener("transitionend", activeTransitionHandler);
    };

    const renderSlides = () => {
      const slideMarkup = [];

      for (let domIndex = 0; domIndex < totalRenderedSlides; domIndex += 1) {
        const realIndex = domIndex % totalSlides;
        const slide = slideData[realIndex];

        slideMarkup.push(`
          <div class="work" data-real-index="${realIndex}" data-dom-index="${domIndex}">
            <img src="${slide.src}" alt="${slide.alt}">
          </div>
        `);
      }

      sliderTrack.innerHTML = slideMarkup.join("");

      sliderTrack.querySelectorAll(".work").forEach((slide) => {
        slide.addEventListener("click", () => {
          selectSlide(Number(slide.dataset.realIndex));
        });
      });
    };

    const syncUi = () => {
      updateMainImage();
      updateCounter();
      updateActiveStates();
    };

    const syncLayout = () => {
      stopTrackAnimation();
      syncUi();
      setTrackOffset(
        getOffsetForDomIndex(getCanonicalDomIndex(selectedIndex)),
        false
      );
    };

    const selectSlide = (realIndex) => {
      isAnimating = true;
      stopTrackAnimation();

      const targetIndex = normalizeIndex(realIndex);
      wheelTargetIndex = targetIndex;
      const version = ++selectionVersion;
      const currentDomPosition = getCurrentDomPosition();
      const canonicalDomIndex = getCanonicalDomIndex(targetIndex);
      const nearestDomIndex = getOccurrences(targetIndex).reduce(
        (closestDomIndex, candidateDomIndex) => {
          const currentDistance = Math.abs(
            candidateDomIndex - currentDomPosition
          );
          const closestDistance = Math.abs(
            closestDomIndex - currentDomPosition
          );

          return currentDistance < closestDistance
            ? candidateDomIndex
            : closestDomIndex;
        }
      );

      const targetOffset = getOffsetForDomIndex(nearestDomIndex);
      const canonicalOffset = getOffsetForDomIndex(canonicalDomIndex);

      selectedIndex = targetIndex;
      syncUi();

      if (Math.abs(targetOffset - getCurrentOffset()) < 0.5) {
        setTrackOffset(canonicalOffset, false);
        wheelTargetIndex = selectedIndex;
        isAnimating = false;
        return;
      }

      setTrackOffset(targetOffset, true, () => {
        if (version !== selectionVersion) {
          return;
        }

        setTrackOffset(canonicalOffset, false);
        wheelTargetIndex = selectedIndex;
        isAnimating = false;
      });
    };

    renderSlides();
    syncLayout();

let wheelAccum = 0;
let wheelTargetIndex = selectedIndex;
let cooldown = false;

sliderViewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (isAnimating) return;
  if (cooldown) {
    wheelAccum = 0;
    return;
  }
  const capped = Math.max(-120, Math.min(120, e.deltaY));
  if (Math.abs(capped) < 5) return;
  wheelAccum += capped;
  if (Math.abs(wheelAccum) >= 300) {
    const direction = wheelAccum > 0 ? 1 : -1;
    selectSlide(selectedIndex + direction);
    wheelAccum = 0;
    wheelTargetIndex = selectedIndex;
    cooldown = true;
    setTimeout(() => {
      cooldown = false;
    }, 400);
  }
}, { passive: false });

let touchStartX = 0;
let touchStartY = 0;

sliderViewport.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

let touchIsHorizontal = false;

sliderViewport.addEventListener("touchmove", (e) => {
  const deltaX = Math.abs(touchStartX - e.touches[0].clientX);
  const deltaY = Math.abs(touchStartY - e.touches[0].clientY);
  
  if (deltaX > 5 || deltaY > 5) {
    touchIsHorizontal = deltaX > deltaY;
  }
  
  if (touchIsHorizontal) {
    e.preventDefault();
  }
}, { passive: false });

sliderViewport.addEventListener("touchend", (e) => {
  if (cooldown) return;
  
  const deltaX = touchStartX - e.changedTouches[0].clientX;
  const deltaY = touchStartY - e.changedTouches[0].clientY;
  
  if (Math.abs(deltaY) > Math.abs(deltaX)) return;
  
  if (Math.abs(deltaX) < 40) return;
  
  const direction = deltaX > 0 ? 1 : -1;
  wheelTargetIndex = normalizeIndex(wheelTargetIndex + direction);
  selectSlide(wheelTargetIndex);
  
  cooldown = true;
  setTimeout(() => { cooldown = false; }, 600);
  wheelAccum = 0;
  wheelTargetIndex = selectedIndex;
});
    window.addEventListener("resize", syncLayout);
  }
}
