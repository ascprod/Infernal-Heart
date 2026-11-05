(() => {
  "use strict";
  const enabled =
    new URLSearchParams(location.search).get("debug") === "1" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const report = document.querySelector("#error-report");
  const details = document.querySelector("#error-details");
  const status = document.querySelector("#dev-status");
  let errors = 0;
  function showError(message) {
    errors++;
    report.hidden = false;
    // textContent keeps stack traces and error messages as plain text.
    details.textContent += (errors > 1 ? "\n\n" : "") + String(message);
    details.textContent = details.textContent.slice(-12000);
    status.textContent = "GAME ERROR — see details";
  }
  addEventListener(
    "error",
    (event) => {
      if (event.target !== window) {
        const target = event.target;
        showError(
          "Could not load " + (target.src || target.href || target.tagName),
        );
        return;
      }
      showError(
        (event.error && event.error.stack) ||
          `${event.message}\n${event.filename}:${event.lineno}:${event.colno}`,
      );
    },
    true,
  );
  addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    showError(
      (reason && reason.stack) || reason || "Unhandled promise rejection",
    );
  });
  document
    .querySelector("#error-reload")
    .addEventListener("click", () => location.reload());
  if (enabled) {
    status.hidden = false;
    status.textContent = "DEV · waiting for game startup…";
  }
  window.InfernalDiagnostics = Object.freeze({
    enabled,
    attach(snapshot) {
      if (!enabled) return;
      let previous = -1;
      setInterval(() => {
        if (errors) return;
        const state = snapshot();
        const loop = document.hidden
          ? "background"
          : state.frames === previous
            ? "LOOP STALLED"
            : "loop running";
        status.textContent = `DEV · ${state.mode.toUpperCase()} · ${loop} · ${state.frames} frames`;
        previous = state.frames;
      }, 1000);
    },
  });
})();
