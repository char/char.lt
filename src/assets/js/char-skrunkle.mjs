const profilePicture = document.querySelector(".profile-picture");
const wantsMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;

if (profilePicture && wantsMotion) {
  const randomBetween = (min, max) => Math.random() * (max - min) + min;
  const recentClicks = [];

  const squish = () => {
    const now = performance.now();
    recentClicks.push(now);
    while (recentClicks[0] < now - 900) recentClicks.shift();

    const chaos = 0.25 + (recentClicks.length - 1) * 0.5;
    const amplify = (value) => 1 + (value - 1) * chaos;

    profilePicture.style.setProperty("--squish-wide-x", amplify(randomBetween(1.04, 1.12)).toFixed(3));
    profilePicture.style.setProperty("--squish-wide-y", amplify(randomBetween(0.88, 0.96)).toFixed(3));
    profilePicture.style.setProperty("--squish-tall-x", amplify(randomBetween(0.88, 0.96)).toFixed(3));
    profilePicture.style.setProperty("--squish-tall-y", amplify(randomBetween(1.04, 1.12)).toFixed(3));
    profilePicture.style.setProperty("--squish-rotate-a", `${(randomBetween(-9, 9) * chaos).toFixed(2)}deg`);
    profilePicture.style.setProperty("--squish-rotate-b", `${(randomBetween(-7, 7) * chaos).toFixed(2)}deg`);
    profilePicture.style.setProperty("--squish-rotate-c", `${(randomBetween(-4, 4) * chaos).toFixed(2)}deg`);
    profilePicture.style.setProperty("--squish-duration", `${Math.max(0.26, 0.45 - (recentClicks.length - 1) * 0.025).toFixed(3)}s`);

    profilePicture.classList.remove("is-squishing");
    void profilePicture.offsetWidth;
    profilePicture.classList.add("is-squishing");
  };

  profilePicture.addEventListener("click", squish);
  profilePicture.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      squish();
    }
  });
  profilePicture.addEventListener("animationend", () => {
    profilePicture.classList.remove("is-squishing");
  });
}
