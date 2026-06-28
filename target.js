const VimputTarget = (() => {
  const SELECTOR =
    'input, textarea, [contenteditable]:not([contenteditable="false"])';

  const deepActiveElement = () => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  };

  const resolveTarget = (e) => {
    const fromPath = e
      .composedPath()
      .find((node) => node instanceof HTMLElement && node.matches(SELECTOR));
    if (fromPath) return fromPath;

    const active = deepActiveElement();
    return active instanceof HTMLElement && active.matches(SELECTOR)
      ? active
      : null;
  };

  return { resolveTarget, deepActiveElement };
})();
