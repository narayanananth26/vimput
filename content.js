const targets = document.querySelectorAll("input, textarea");

const highlight = () => {
  targets.forEach((el) => {
    el.style.backgroundColor = "red";
    console.log("highlighed - ", el.outerHTML);
  });
};

highlight(targets);
