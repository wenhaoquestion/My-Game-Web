(function () {
    const canvas = document.getElementById("ambient-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let rafId = null;

    function isAmbientOn() {
        return document.body.dataset.ambient !== "off" && !prefersReducedMotion.matches;
    }

    function readAccentColor() {
        const styles = getComputedStyle(document.body);
        return styles.getPropertyValue("--accent-3").trim() || "#7ef9ff";
    }

    function resizeCanvas() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const targetCount = Math.max(24, Math.min(70, Math.round(width * height / 18000)));
        particles = Array.from({ length: targetCount }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.8 + Math.random() * 2.4,
            vx: -0.08 + Math.random() * 0.16,
            vy: 0.05 + Math.random() * 0.18,
            alpha: 0.18 + Math.random() * 0.34
        }));
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        if (!isAmbientOn()) {
            rafId = null;
            return;
        }

        const accent = readAccentColor();
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;

        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -8) p.x = width + 8;
            if (p.x > width + 8) p.x = -8;
            if (p.y > height + 8) p.y = -8;

            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        rafId = window.requestAnimationFrame(draw);
    }

    function startOrStop() {
        if (isAmbientOn()) {
            if (!rafId) {
                rafId = window.requestAnimationFrame(draw);
            }
        } else if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
            ctx.clearRect(0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height);
        }
    }

    resizeCanvas();
    startOrStop();

    window.addEventListener("resize", () => {
        resizeCanvas();
        startOrStop();
    });

    if (typeof prefersReducedMotion.addEventListener === "function") {
        prefersReducedMotion.addEventListener("change", startOrStop);
    } else if (typeof prefersReducedMotion.addListener === "function") {
        prefersReducedMotion.addListener(startOrStop);
    }

    const observer = new MutationObserver(startOrStop);
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-ambient", "data-theme"]
    });
})();
