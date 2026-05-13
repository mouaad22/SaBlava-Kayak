// Bottom-sheet drag controller. Three snap points expressed as a fraction
// of the parent height: collapsed, default, expanded.

const SNAPS = { collapsed: 0.22, default: 0.58, expanded: 0.92 };

export function attachSheet(sheetEl, options = {}) {
  const handles = sheetEl.querySelectorAll("[data-sheet-grip]");
  let parent = sheetEl.parentElement;
  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  let parentHeight = 0;
  let currentSnap = options.initial || "default";

  function setSnap(name) {
    currentSnap = name;
    sheetEl.classList.toggle("is-expanded", name === "expanded");
    sheetEl.classList.toggle("is-collapsed", name === "collapsed");
    sheetEl.style.height = ""; // let CSS take over for the transition
    sheetEl.classList.remove("is-dragging");
    options.onSnap?.(name);
  }

  function onDown(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    dragging = true;
    startY = ev.clientY ?? ev.touches?.[0]?.clientY;
    parentHeight = parent.getBoundingClientRect().height;
    startHeight = sheetEl.getBoundingClientRect().height;
    sheetEl.classList.add("is-dragging");
    ev.target.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }

  function onMove(ev) {
    if (!dragging) return;
    const y = ev.clientY ?? ev.touches?.[0]?.clientY;
    const delta = y - startY;
    let newHeight = startHeight - delta;
    const min = parentHeight * (SNAPS.collapsed - 0.04);
    const max = parentHeight * (SNAPS.expanded + 0.02);
    newHeight = Math.max(min, Math.min(max, newHeight));
    sheetEl.style.height = `${newHeight}px`;
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    const finalHeight = sheetEl.getBoundingClientRect().height;
    const ratio = finalHeight / parentHeight;
    let nearest = "default";
    let bestDiff = Infinity;
    for (const [name, frac] of Object.entries(SNAPS)) {
      const diff = Math.abs(ratio - frac);
      if (diff < bestDiff) {
        bestDiff = diff;
        nearest = name;
      }
    }
    setSnap(nearest);
  }

  handles.forEach((h) => {
    h.addEventListener("pointerdown", onDown);
    h.addEventListener("pointermove", onMove);
    h.addEventListener("pointerup", onUp);
    h.addEventListener("pointercancel", onUp);
    h.style.touchAction = "none";
  });

  return {
    expand: () => setSnap("expanded"),
    collapse: () => setSnap("collapsed"),
    reset: () => setSnap("default"),
    get current() {
      return currentSnap;
    },
  };
}
