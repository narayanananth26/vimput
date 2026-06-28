const VimEngine = (() => {
  const INSERT = "INSERT";
  const NORMAL = "NORMAL";
  const VISUAL = "VISUAL";
  const VLINE = "V-LINE";

  let el = null;
  let mode = INSERT;
  let pending = null;
  let anchor = 0;
  let head = 0;
  let onModeChange = () => {};

  const isFormField = (n) =>
    n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement;
  const isVisual = () => mode === VISUAL || mode === VLINE;

  const setMode = (m) => {
    mode = m;
    pending = null;
    onModeChange(m);
  };

  const isSpace = (c) => /\s/.test(c);
  const isWord = (c) => /\w/.test(c);
  const lineStart = (t, p) => t.lastIndexOf("\n", p - 1) + 1;
  const lineEnd = (t, p) => {
    const i = t.indexOf("\n", p);
    return i === -1 ? t.length : i;
  };

  const nextWordStart = (t, p) => {
    const n = t.length;
    let i = p;
    if (i < n && !isSpace(t[i])) {
      const w = isWord(t[i]);
      while (i < n && !isSpace(t[i]) && isWord(t[i]) === w) i++;
    }
    while (i < n && isSpace(t[i])) i++;
    return i;
  };

  const prevWordStart = (t, p) => {
    let i = p - 1;
    while (i > 0 && isSpace(t[i])) i--;
    if (i <= 0) return 0;
    const w = isWord(t[i]);
    while (i > 0 && !isSpace(t[i - 1]) && isWord(t[i - 1]) === w) i--;
    return i;
  };

  const wordEnd = (t, p) => {
    const n = t.length;
    let i = p + 1;
    while (i < n && isSpace(t[i])) i++;
    if (i >= n) return Math.max(n - 1, 0);
    const w = isWord(t[i]);
    while (i + 1 < n && !isSpace(t[i + 1]) && isWord(t[i + 1]) === w) i++;
    return i;
  };

  const lineDown = (t, p) => {
    const col = p - lineStart(t, p);
    const le = lineEnd(t, p);
    if (le >= t.length) return p;
    const nls = le + 1;
    return Math.min(nls + col, lineEnd(t, nls));
  };

  const lineUp = (t, p) => {
    const ls = lineStart(t, p);
    if (ls === 0) return p;
    const pls = lineStart(t, ls - 1);
    return Math.min(pls + (p - ls), ls - 1);
  };

  const classOf = (c) => (isSpace(c) ? "s" : isWord(c) ? "w" : "p");
  const wordObject = (t, p, around) => {
    if (t.length === 0) return [0, 0];
    const i = Math.min(p, t.length - 1);
    const cls = classOf(t[i]);
    let start = i;
    let end = i;
    while (start > 0 && classOf(t[start - 1]) === cls) start--;
    while (end < t.length - 1 && classOf(t[end + 1]) === cls) end++;
    end += 1;
    if (around) {
      let te = end;
      while (te < t.length && isSpace(t[te])) te++;
      if (te > end) end = te;
      else while (start > 0 && isSpace(t[start - 1])) start--;
    }
    return [start, end];
  };

  const formMotion = (key, t, p) => {
    switch (key) {
      case "h":
        return Math.max(0, p - 1);
      case "l":
        return Math.min(t.length, p + 1);
      case "j":
        return lineDown(t, p);
      case "k":
        return lineUp(t, p);
      case "0":
        return lineStart(t, p);
      case "$":
        return lineEnd(t, p);
      case "w":
        return nextWordStart(t, p);
      case "b":
        return prevWordStart(t, p);
      case "e":
        return wordEnd(t, p);
      case "G":
        return t.length;
      default:
        return null;
    }
  };

  const fire = () => el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = (np) => {
    const c = Math.max(0, Math.min(np, el.value.length));
    try {
      el.setSelectionRange(c, c);
    } catch {
      console.warn("Element doesn't support selection");
    }
  };

  let register = "";
  let registerLinewise = false;
  const yank = (text, linewise) => {
    register = linewise ? text.replace(/^\n|\n$/g, "") : text;
    registerLinewise = linewise;
    navigator.clipboard?.writeText(register).catch(() => {}); 
  };

  const visualRange = (forDelete) => {
    const t = el.value;
    const lo = Math.min(anchor, head);
    const hi = Math.max(anchor, head);
    if (mode === VLINE) {
      let s = lineStart(t, lo);
      const le = lineEnd(t, hi);
      let e = le < t.length ? le + 1 : le;
      if (forDelete && e === le && s > 0) s -= 1;
      return [s, e];
    }
    return [lo, Math.min(t.length, hi + 1)];
  };

  const renderVisual = () => {
    const [s, e] = visualRange(false);
    try {
      el.setSelectionRange(s, e);
    } catch {
      console.warn("Element doesn't support selection");
    }
  };

  const deleteVisual = (intoInsert) => {
    const t = el.value;
    const [s, e] = visualRange(true);
    yank(t.slice(s, e), mode === VLINE);
    el.value = t.slice(0, s) + t.slice(e);
    fire();
    setMode(intoInsert ? INSERT : NORMAL);
    caret(s);
  };

  const yankVisual = () => {
    const t = el.value;
    const [s, e] = visualRange(false);
    yank(t.slice(s, e), mode === VLINE);
    setMode(NORMAL);
    caret(s);
  };

  const pasteForm = (after) => {
    if (!register) return;
    const t = el.value;
    const p = el.selectionStart ?? 0;
    if (registerLinewise) {
      if (after) {
        const le = lineEnd(t, p);
        el.value = t.slice(0, le) + "\n" + register + t.slice(le);
        fire();
        caret(le + 1);
      } else {
        const ls = lineStart(t, p);
        el.value = t.slice(0, ls) + register + "\n" + t.slice(ls);
        fire();
        caret(ls);
      }
    } else {
      const at = after ? Math.min(t.length, p + 1) : p;
      el.value = t.slice(0, at) + register + t.slice(at);
      fire();
      caret(at + register.length - 1); 
    }
  };

  const formNormal = (key) => {
    const t = el.value;
    const p = el.selectionStart ?? 0;
    const replace = (s, e, str, c) => {
      if (str === "" && e > s) yank(t.slice(s, e), false); 
      el.value = t.slice(0, s) + str + t.slice(e);
      fire();
      caret(c ?? s);
    };

    if (pending === "g") {
      pending = null;
      if (key === "g") caret(0);
      return;
    }
    if (pending === "d") {
      if (key === "i" || key === "a") {
        pending = "d" + key;
        return;
      }
      pending = null;
      if (key === "d") {
        const s = lineStart(t, p);
        const le = lineEnd(t, p);
        if (le < t.length) replace(s, le + 1, "", s);
        else replace(s > 0 ? s - 1 : s, le, "", s > 0 ? s - 1 : 0);
        registerLinewise = true; 
        register = register.replace(/^\n|\n$/g, "");
      } else if (key === "w") {
        replace(p, nextWordStart(t, p), "", p);
      } else if (key === "$") {
        replace(p, lineEnd(t, p), "", p);
      }
      return;
    }
    if (pending === "di" || pending === "da") {
      const around = pending === "da";
      pending = null;
      if (key === "w") {
        const [s, e] = wordObject(t, p, around);
        replace(s, e, "", s);
      }
      return;
    }
    if (pending === "c") {
      if (key === "i" || key === "a") {
        pending = "c" + key;
        return;
      }
      pending = null;
      if (key === "c")
        replace(lineStart(t, p), lineEnd(t, p), "", lineStart(t, p));
      else if (key === "w") replace(p, nextWordStart(t, p), "", p);
      else if (key === "$") replace(p, lineEnd(t, p), "", p);
      else return;
      setMode(INSERT);
      return;
    }
    if (pending === "ci" || pending === "ca") {
      const around = pending === "ca";
      pending = null;
      if (key === "w") {
        const [s, e] = wordObject(t, p, around);
        replace(s, e, "", s);
        setMode(INSERT);
      }
      return;
    }

    const m = formMotion(key, t, p);
    if (m !== null) return caret(m);

    switch (key) {
      case "g":
        pending = "g";
        break;
      case "d":
        pending = "d";
        break;
      case "c":
        pending = "c";
        break;
      case "x":
        if (p < t.length) replace(p, p + 1, "", p);
        break;
      case "D":
        replace(p, lineEnd(t, p), "", p);
        break;
      case "p":
        pasteForm(true);
        break;
      case "P":
        pasteForm(false);
        break;
      case "v":
        anchor = head = p;
        setMode(VISUAL);
        renderVisual();
        break;
      case "V":
        anchor = head = p;
        setMode(VLINE);
        renderVisual();
        break;
      case "i":
        setMode(INSERT);
        break;
      case "a":
        caret(p + 1);
        setMode(INSERT);
        break;
      case "I":
        caret(lineStart(t, p));
        setMode(INSERT);
        break;
      case "A":
        caret(lineEnd(t, p));
        setMode(INSERT);
        break;
      case "o":
        if (el instanceof HTMLTextAreaElement) {
          const le = lineEnd(t, p);
          replace(le, le, "\n", le + 1);
        } else caret(t.length);
        setMode(INSERT);
        break;
      case "O":
        if (el instanceof HTMLTextAreaElement) {
          const s = lineStart(t, p);
          replace(s, s, "\n", s);
        } else caret(0);
        setMode(INSERT);
        break;
      default:
        break;
    }
  };

  const formVisual = (key) => {
    const t = el.value;
    if (pending === "g") {
      pending = null;
      if (key === "g") {
        head = 0;
        renderVisual();
      }
      return;
    }
    if (pending === "i" || pending === "a") {
      const around = pending === "a";
      pending = null;
      if (key === "w") {
        const [s, e] = wordObject(t, head, around);
        anchor = s;
        head = Math.max(s, e - 1);
        renderVisual();
      }
      return;
    }
    const m = formMotion(key, t, head);
    if (m !== null) {
      head = m;
      renderVisual();
      return;
    }

    switch (key) {
      case "g":
        pending = "g";
        break;
      case "i":
        pending = "i";
        break;
      case "a":
        pending = "a";
        break;
      case "d":
      case "x":
        deleteVisual(false);
        break;
      case "c":
        deleteVisual(true);
        break;
      case "y":
        yankVisual();
        break;
      case "v":
      case "V":
        exitVisual();
        break;
      default:
        break;
    }
  };

  const exitVisual = () => {
    setMode(NORMAL);
    if (isFormField(el)) caret(head);
    else window.getSelection()?.collapseToEnd();
  };

  /* contenteditable driver (Selection.modify) */
  const ceSelectWord = (sel) => {
    sel.modify("move", "forward", "word");
    sel.modify("extend", "backward", "word");
  };

  const cePaste = (after, sel) => {
    if (!register || !sel.rangeCount) return;
    if (after) sel.modify("move", "forward", "character");
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(register);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };

  const ceNormal = (key) => {
    const sel = window.getSelection();
    if (!sel) return;
    const move = (dir, gran) => sel.modify("move", dir, gran);
    const del = (dir, gran) => {
      sel.modify("extend", dir, gran);
      yank(sel.toString(), false);
      document.execCommand("delete");
    };

    if (pending === "g") {
      pending = null;
      if (key === "g") move("backward", "documentboundary");
      return;
    }
    if (pending === "d") {
      if (key === "i" || key === "a") {
        pending = "d" + key;
        return;
      }
      pending = null;
      if (key === "d") {
        move("backward", "lineboundary");
        del("forward", "lineboundary");
        document.execCommand("forwardDelete");
      } else if (key === "w") del("forward", "word");
      else if (key === "$") del("forward", "lineboundary");
      return;
    }
    if (pending === "di" || pending === "da") {
      pending = null;
      if (key === "w") {
        ceSelectWord(sel);
        document.execCommand("delete");
      }
      return;
    }
    if (pending === "c") {
      if (key === "i" || key === "a") {
        pending = "c" + key;
        return;
      }
      pending = null;
      if (key === "c") {
        move("backward", "lineboundary");
        del("forward", "lineboundary");
      } else if (key === "w") del("forward", "word");
      else if (key === "$") del("forward", "lineboundary");
      else return;
      setMode(INSERT);
      return;
    }
    if (pending === "ci" || pending === "ca") {
      pending = null;
      if (key === "w") {
        ceSelectWord(sel);
        document.execCommand("delete");
        setMode(INSERT);
      }
      return;
    }

    switch (key) {
      case "h":
        move("backward", "character");
        break;
      case "l":
        move("forward", "character");
        break;
      case "j":
        move("forward", "line");
        break;
      case "k":
        move("backward", "line");
        break;
      case "0":
        move("backward", "lineboundary");
        break;
      case "$":
        move("forward", "lineboundary");
        break;
      case "w":
        move("forward", "word");
        break;
      case "b":
        move("backward", "word");
        break;
      case "e":
        move("forward", "word");
        break;
      case "G":
        move("forward", "documentboundary");
        break;
      case "g":
        pending = "g";
        break;
      case "d":
        pending = "d";
        break;
      case "c":
        pending = "c";
        break;
      case "x":
        del("forward", "character");
        break;
      case "D":
        del("forward", "lineboundary");
        break;
      case "p":
        cePaste(true, sel);
        break;
      case "P":
        cePaste(false, sel);
        break;
      case "v":
        sel.modify("extend", "forward", "character");
        setMode(VISUAL);
        break;
      case "V":
        move("backward", "lineboundary");
        sel.modify("extend", "forward", "lineboundary");
        setMode(VLINE);
        break;
      case "i":
        setMode(INSERT);
        break;
      case "a":
        move("forward", "character");
        setMode(INSERT);
        break;
      case "I":
        move("backward", "lineboundary");
        setMode(INSERT);
        break;
      case "A":
        move("forward", "lineboundary");
        setMode(INSERT);
        break;
      case "o":
        move("forward", "lineboundary");
        document.execCommand("insertParagraph");
        setMode(INSERT);
        break;
      case "O":
        move("backward", "lineboundary");
        document.execCommand("insertParagraph");
        move("backward", "line");
        setMode(INSERT);
        break;
      default:
        break;
    }
  };

  const ceVisual = (key) => {
    const sel = window.getSelection();
    if (!sel) return;
    const ext = (dir, gran) => sel.modify("extend", dir, gran);
    const gran = mode === VLINE ? "line" : "character";

    if (pending === "g") {
      pending = null;
      if (key === "g") ext("backward", "documentboundary");
      return;
    }
    if (pending === "i" || pending === "a") {
      pending = null;
      if (key === "w") ceSelectWord(sel);
      return;
    }

    switch (key) {
      case "i":
        pending = "i";
        break;
      case "a":
        pending = "a";
        break;
      case "h":
        ext("backward", gran);
        break;
      case "l":
        ext("forward", gran);
        break;
      case "j":
        ext("forward", "line");
        break;
      case "k":
        ext("backward", "line");
        break;
      case "0":
        ext("backward", "lineboundary");
        break;
      case "$":
        ext("forward", "lineboundary");
        break;
      case "w":
        ext("forward", "word");
        break;
      case "b":
        ext("backward", "word");
        break;
      case "e":
        ext("forward", "word");
        break;
      case "G":
        ext("forward", "documentboundary");
        break;
      case "g":
        pending = "g";
        break;
      case "d":
      case "x":
        yank(sel.toString(), mode === VLINE);
        document.execCommand("delete");
        setMode(NORMAL);
        break;
      case "c":
        yank(sel.toString(), mode === VLINE);
        document.execCommand("delete");
        setMode(INSERT);
        break;
      case "y":
        yank(sel.toString(), mode === VLINE);
        sel.collapseToStart();
        setMode(NORMAL);
        break;
      case "v":
      case "V":
        exitVisual();
        break;
      default:
        break;
    }
  };

  const handleKeyDown = (e) => {
    if (!el) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (isVisual()) {
        exitVisual();
      } else if (mode === INSERT) {
        setMode(NORMAL);
        if (isFormField(el)) {
          const p = el.selectionStart ?? 0;
          caret(Math.max(lineStart(el.value, p), p - 1));
        } else {
          window.getSelection()?.modify("move", "backward", "character");
        }
      } else {
        pending = null;
      }
      return;
    }

    if (mode === INSERT) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Tab") return;

    e.preventDefault();
    const form = isFormField(el);
    if (isVisual()) form ? formVisual(e.key) : ceVisual(e.key);
    else form ? formNormal(e.key) : ceNormal(e.key);
  };

  return {
    handleKeyDown,
    activate(target) {
      el = target;
      setMode(INSERT);
    },
    deactivate() {
      el = null;
      mode = INSERT;
      pending = null;
      onModeChange(null);
    },
    set onModeChange(fn) {
      onModeChange = fn;
    },
  };
})();
