const badge = document.createElement("div");
badge.textContent = "INSERT";
badge.className = "vimput-badge";
document.body.appendChild(badge);

document.addEventListener("focusin", (e) => {
  if (VimputTarget.resolveTarget(e)) {
    badge.classList.add("active");
  }
});

document.addEventListener("focusout", (e) => {
  if (VimputTarget.resolveTarget(e)) {
    badge.classList.remove("active");
  }
});
