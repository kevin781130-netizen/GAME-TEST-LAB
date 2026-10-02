/* NEON PULSE — isolated audiovisual presentation layer */
(function () {
    function ReactiveBackdrop(props) {
        var canvasRef = React.useRef(null);
        var analyserRef = props.analyserRef;
        var burstRef = props.burstRef;
        var mode = props.mode || 'level';
        var playing = props.playing !== false;

        React.useEffect(function () {
            var canvas = canvasRef.current;
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var raf = 0, width = 0, height = 0, dpr = 1, smoothEnergy = 0, t = 0, particles = [];

            function paletteForMode() {
                if (mode === 'sprint') return { a:[244,63,94], b:[217,70,239], c:[251,146,60] };
                if (mode === 'survival') return { a:[34,211,238], b:[139,92,246], c:[59,130,246] };
                if (mode === 'menu') return { a:[34,211,238], b:[217,70,239], c:[99,102,241] };
                return { a:[34,211,238], b:[59,130,246], c:[217,70,239] };
            }

            function resetParticles() {
                var count = reducedMotion ? 24 : (window.innerWidth < 768 ? 42 : 78);
                particles = Array.from({ length: count }, function () {
                    return {
                        x: Math.random(), y: Math.random(), z: .25 + Math.random() * .9,
                        phase: Math.random() * Math.PI * 2, size: .5 + Math.random() * 1.9
                    };
                });
            }

            function resize() {
                dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                width = Math.max(1, window.innerWidth);
                height = Math.max(1, window.innerHeight);
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                resetParticles();
            }

            function sampleEnergy() {
                var analyser = analyserRef.current;
                if (!analyser) return .10 + Math.sin(t * .012) * .025;
                var data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                var bins = Math.max(8, Math.floor(data.length * .55));
                var total = 0;
                for (var i = 0; i < bins; i++) total += data[i];
                return Math.min(1, (total / bins) / 180);
            }

            function rgba(rgb, alpha) {
                return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
            }

            function draw() {
                t += 1;
                var palette = paletteForMode();
                var raw = playing ? sampleEnergy() : .04;
                smoothEnergy += (raw - smoothEnergy) * .12;
                var burst = burstRef.current || 0;
                burstRef.current = Math.max(0, burst * .90 - .003);
                var energy = Math.min(1, smoothEnergy + burst * .72);

                ctx.clearRect(0, 0, width, height);
                var centerX = width * .5, centerY = height * .47;
                var glow = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, Math.max(width,height) * .62);
                glow.addColorStop(0, rgba(palette.a, .045 + energy * .11));
                glow.addColorStop(.32, rgba(palette.b, .025 + energy * .07));
                glow.addColorStop(1, 'rgba(2,6,23,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                var rings = reducedMotion ? 2 : 4;
                for (var r = 0; r < rings; r++) {
                    var base = 140 + r * 105;
                    var pulse = Math.sin(t * .012 + r * 1.7) * 10 + energy * (24 + r * 8);
                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, base + pulse, (base + pulse) * .62, t * .0009 * (r % 2 ? -1 : 1), 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(r % 2 ? palette.b : palette.a, .025 + energy * .055);
                    ctx.lineWidth = .7 + energy * .8;
                    ctx.stroke();
                }

                var drift = (playing ? .20 : .05) + energy * 1.15 + burst * 2.4;
                for (var p = 0; p < particles.length; p++) {
                    var particle = particles[p];
                    var dx = particle.x - .5, dy = particle.y - .47;
                    var len = Math.max(.08, Math.hypot(dx,dy));
                    particle.x += (dx / len) * drift * .00055 * particle.z;
                    particle.y += (dy / len) * drift * .00055 * particle.z;
                    particle.phase += .012 + energy * .03;
                    if (particle.x < -.06 || particle.x > 1.06 || particle.y < -.06 || particle.y > 1.06) {
                        particle.x = .46 + Math.random() * .08;
                        particle.y = .43 + Math.random() * .08;
                        particle.z = .25 + Math.random() * .9;
                    }

                    var x = particle.x * width, y = particle.y * height;
                    var alpha = (.16 + .34 * particle.z) * (.6 + energy * .85);
                    var size = particle.size * (.75 + particle.z) * (1 + energy * .55);
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = rgba(Math.sin(particle.phase) > 0 ? palette.a : palette.c, alpha);
                    ctx.shadowBlur = 8 + energy * 18;
                    ctx.shadowColor = rgba(palette.a, .55);
                    ctx.fill();
                }

                if (burst > .08 && !reducedMotion) {
                    for (var ray = 0; ray < 12; ray++) {
                        var angle = (Math.PI * 2 / 12) * ray + t * .001;
                        var inner = 95 + (1 - burst) * 80;
                        var outer = inner + 90 * burst;
                        ctx.beginPath();
                        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * .62);
                        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * .62);
                        ctx.strokeStyle = rgba(ray % 2 ? palette.b : palette.a, burst * .16);
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }
                }

                ctx.restore();
                raf = requestAnimationFrame(draw);
            }

            resize();
            window.addEventListener('resize', resize);
            draw();
            return function () {
                cancelAnimationFrame(raf);
                window.removeEventListener('resize', resize);
            };
        }, [mode, playing]);

        return React.createElement(
            React.Fragment,
            null,
            React.createElement('canvas', { ref: canvasRef, className: 'fx-canvas', 'aria-hidden': 'true' }),
            React.createElement('div', { className: 'fx-vignette', 'aria-hidden': 'true' }),
            React.createElement('div', { className: 'fx-scanline', 'aria-hidden': 'true' })
        );
    }

    function setupAnalyser(audioElement, audioContext, analyserRef, sourceRef) {
        if (!audioElement || !audioContext || analyserRef.current) return;
        try {
            var analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = .82;
            var source = audioContext.createMediaElementSource(audioElement);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            sourceRef.current = source;
            analyserRef.current = analyser;
        } catch (error) {
            console.log('Audio visualizer fallback mode:', error);
        }
    }

    function triggerBurst(burstRef, setBurstId, strength) {
        var power = typeof strength === 'number' ? strength : .6;
        burstRef.current = Math.max(burstRef.current || 0, power);
        setBurstId(function (id) { return id + 1; });
    }

    window.ReactiveBackdrop = ReactiveBackdrop;
    window.NeonPulseFX = {
        setupAnalyser: setupAnalyser,
        triggerBurst: triggerBurst
    };
})();
