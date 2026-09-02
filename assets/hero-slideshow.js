/* トップのヒーロー背景スライドショー（枚数自由・5秒ごとにゆっくりクロスフェード） */
(function () {
  function init() {
    var box = document.querySelector(".hero-slideshow");
    if (!box) return;
    var slides = box.querySelectorAll(".hero-slide");
    if (!slides.length) return;
    var i = 0;
    slides[0].classList.add("is-shown");
    if (slides.length < 2) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setInterval(function () {
      slides[i].classList.remove("is-shown");
      i = (i + 1) % slides.length;
      slides[i].classList.add("is-shown");
    }, 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
