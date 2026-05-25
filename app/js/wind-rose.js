// Vanilla mount for the wind-rose Rive animation.
//
// Equivalent of the React hook pattern (useRive + useViewModelInstance*) but
// using the @rive-app/canvas UMD bundle exposed as window.rive — this codebase
// is plain ES modules with no build step, no React.
//
// Returns a controller with setAngle / setName / fireStart / cleanup. The
// caller wires those to live weather data.

const RIV_SRC = "./assets/illustrations/WIND/wind.riv";
// Rive's default state machine name — confirmed by introspection on this file.
// If you rename it inside Rive, update this string.
const STATE_MACHINE = "State Machine 1";

export function mountWindRose(canvas) {
  if (!canvas || typeof window === "undefined" || !window.rive) {
    return null;
  }

  let angleProp = null;
  let nameProp = null;
  let startTrigger = null;
  let pending = null;

  // Passing `stateMachines` at construction is what makes `autoBind` actually
  // wire the view model instance into the running state machine — without it,
  // the trigger fires but the SM never receives it.
  const r = new window.rive.Rive({
    src: RIV_SRC,
    canvas,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    onLoad: () => {
      r.resizeDrawingSurfaceToCanvas();

      const vmi = r.viewModelInstance;
      if (vmi) {
        // Properties are looked up by name; if any are missing the catch
        // leaves the binding null and the setter no-ops. The .riv currently
        // exposes windAngle (number), windName (string), start (trigger).
        try { angleProp = vmi.number("windAngle"); } catch {}
        try { nameProp = vmi.string("windName"); } catch {}
        try { startTrigger = vmi.trigger("start"); } catch {}
      }

      // Drain any values that arrived before the file finished loading.
      if (pending) {
        if (pending.angle != null && angleProp) angleProp.value = pending.angle;
        if (pending.name != null && nameProp) nameProp.value = pending.name;
        if (pending.fire && startTrigger) startTrigger.trigger();
        pending = null;
      }
    },
  });

  // Keep the drawing surface in sync with the canvas's CSS box across DPR /
  // viewport changes — Rive does not auto-track size.
  const onResize = () => {
    try {
      r.resizeDrawingSurfaceToCanvas();
    } catch {}
  };
  window.addEventListener("resize", onResize);

  return {
    setAngle(deg) {
      if (typeof deg !== "number" || isNaN(deg)) return;
      if (angleProp) angleProp.value = deg;
      else (pending ||= {}).angle = deg;
    },
    setName(name) {
      // Accept any string (including empty) so the prop is always written and
      // stale values from a previous load don't linger on screen.
      const val = name ?? "";
      if (nameProp) nameProp.value = val;
      else (pending ||= {}).name = val;
    },
    fireStart() {
      if (startTrigger) startTrigger.trigger();
      else (pending ||= {}).fire = true;
    },
    cleanup() {
      window.removeEventListener("resize", onResize);
      try {
        r.cleanup();
      } catch {}
    },
  };
}
