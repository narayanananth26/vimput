const badge = document.createElement("div");
badge.textContent = "VIMPUT";
badge.className = "vimput-badge";
document.body.appendChild(badge);

VimEngine.onModeChange = (mode) => {
  if (!mode) {
    badge.textContent = "VIMPUT";
    badge.classList.remove("active", "normal", "insert", "visual");
    return;
  }
  badge.textContent = mode;
  badge.classList.add("active");
  badge.classList.toggle("insert", mode === "INSERT");
  badge.classList.toggle("normal", mode === "NORMAL");
  badge.classList.toggle("visual", mode === "VISUAL" || mode === "V-LINE");
};

document.addEventListener("focusin", (e) => {
  const target = VimputTarget.resolveTarget(e);
  if (target) VimEngine.activate(target);
});

document.addEventListener("focusout", (e) => {
  if (VimputTarget.resolveTarget(e)) VimEngine.deactivate();
});

// Capture phase so motions are intercepted before the page reacts.
document.addEventListener("keydown", (e) => VimEngine.handleKeyDown(e), true);
