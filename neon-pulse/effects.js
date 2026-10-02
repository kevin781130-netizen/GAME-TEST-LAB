/* NEON PULSE — isolated audiovisual presentation layer
   Phase 2: spectrum bands + journey progression. Gameplay stays untouched. */
(function () {
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function ReactiveBackdrop(props) {
        var canvasRef = React.useRef(null);
        var analyserRef = props.analyserRef;
        var burstRef = props.burstRef;
        var mode = props.mode || 'level';
        var playing = props.playing !== false;
        var telemetryRef = React.useRef({
            level: props.level || 1,
            combo: props.combo || 0,
            lines: props.lines || 0,
            danger: !!props.danger
        });

        React.useEffect(function () {
            telemetryRef.current = {
                level: props.level || 1,
                combo: props.combo || 0,
                lines: props.lines || 0,
                danger: !!props.danger
            };
        }, [props.level, props.combo, props.lines, props.danger]);

        React.useEffect(function () {
            var canvas = canvasRef.current;
            if (!canvas) return;
            var ctx = canvas.getContext('2d');
            var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var raf = 0, width = 0, height = 0, dpr = 1, t = 0, particles = [], frequencyData = null;
            var smooth = { energy: 0, bass: 0, mid: 0, treble: 0 };

            function paletteForMode() {
                if (mode === 'sprint') return { a:[244,63,94], b:[217,70,239], c:[251,146,60], deep:[69,10,10] };
                if (mode === 'survival') return { a:[34,211,238], b:[139,92,246], c:[59,130,246], deep:[17,24,39] };
                if (mode === 'menu') return { a:[34,211,238], b:[217,70,239], c:[99,102,241], deep:[15,23,42] };
                return { a:[34,211,238], b:[59,130,246], c:[217,70,239], deep:[8,15,35] };
            }

            function resetParticles() {
                var count = reducedMotion ? 22 : (window.innerWidth < 768 ? 46 : 88);
                particles = Array.from({ length: count }, function () {
                    return {
                        x: Math.random(),
                        y: Math.random(),
                        z: .22 + Math.random() * .92,
                        phase: Math.random() * Math.PI * 2,
                        size: .45 + Math.random() * 1.9,
                        lane: Math.random() > .5 ? 1 : -1
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

            function averageRange(data, startRatio, endRatio) {
                var start = Math.floor(data.length * startRatio);
                var end = Math.max(start + 1, Math.floor(data.length * endRatio));
                var total = 0;
                for (var i = start; i < end; i++) total += data[i];
                return (total / (end - start)) / 255;
            }

            function sampleSpectrum() {
                var analyser = analyserRef.current;
                if (!analyser) {
                    var fallback = .10 + Math.sin(t * .012) * .025;
                    return {
                        energy: fallback,
                        bass: fallback * (1 + Math.sin(t * .021) * .18),
                        mid: fallback * (1 + Math.sin(t * .015 + 1.1) * .15),
                        treble: fallback * (1 + Math.sin(t * .029 + 2.4) * .12)
                    };
                }
                if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
                    frequencyData = new Uint8Array(analyser.frequencyBinCount);
                }
                analyser.getByteFrequencyData(frequencyData);
                var bass = averageRange(frequencyData, 0, .12);
                var mid = averageRange(frequencyData, .12, .42);
                var treble = averageRange(frequencyData, .42, .78);
                return {
                    bass: bass,
                    mid: mid,
                    treble: treble,
                    energy: clamp(bass * .42 + mid * .38 + treble * .20, 0, 1)
                };
            }

            function rgba(rgb, alpha) {
                return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + clamp(alpha, 0, 1) + ')';
            }

            function drawHorizon(palette, centerX, centerY, journey, bass, mid, treble, danger) {
                if (reducedMotion) return;
                var horizonY = centerY + Math.min(160, height * .18);
                var depth = 8 + Math.round(journey * 5);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                for (var lane = -4; lane <= 4; lane++) {
                    ctx.beginPath();
                    ctx.moveTo(centerX, horizonY);
                    var endX = centerX + lane * width * .18;
                    ctx.lineTo(endX, height + 30);
                    ctx.strokeStyle = rgba(lane % 2 ? palette.b : palette.a, .018 + journey * .025 + bass * .028);
                    ctx.lineWidth = .7;
                    ctx.stroke();
                }

                for (var row = 0; row < depth; row++) {
                    var p = row / Math.max(1, depth - 1);
                    var eased = p * p;
                    var y = horizonY + eased * (height - horizonY + 20);
                    var wave = Math.sin(t * .018 + row * .75) * mid * (4 + p * 12);
                    ctx.beginPath();
                    ctx.moveTo(0, y + wave);
                    ctx.bezierCurveTo(width * .28, y - wave, width * .72, y + wave, width, y - wave);
                    ctx.strokeStyle = rgba(danger ? [244,63,94] : (row % 2 ? palette.c : palette.a), .018 + p * .025 + treble * .025);
                    ctx.lineWidth = .55 + p * .45;
                    ctx.stroke();
                }
                ctx.restore();
            }

            function drawRibbons(palette, centerY, journey, mid, treble) {
                if (reducedMotion) return;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                var ribbons = 3 + Math.round(journey * 2);
                for (var r = 0; r < ribbons; r++) {
                    ctx.beginPath();
                    for (var x = -20; x <= width + 20; x += 24) {
                        var phase = t * (.008 + journey * .003) + r * 1.7 + x * .006;
                        var y = centerY + Math.sin(phase) * (42 + r * 22 + mid * 75) + (r - ribbons / 2) * 38;
                        if (x === -20) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.strokeStyle = rgba(r % 2 ? palette.b : palette.c, .018 + mid * .055 + treble * .018);
                    ctx.lineWidth = .7 + mid * 1.35;
                    ctx.shadowBlur = 16 + mid * 20;
                    ctx.shadowColor = rgba(palette.b, .22);
                    ctx.stroke();
                }
                ctx.restore();
            }

            function draw() {
                t += 1;
                var palette = paletteForMode();
                var raw = playing ? sampleSpectrum() : { energy:.035, bass:.02, mid:.02, treble:.02 };
                smooth.energy += (raw.energy - smooth.energy) * .11;
                smooth.bass += (raw.bass - smooth.bass) * .15;
                smooth.mid += (raw.mid - smooth.mid) * .11;
                smooth.treble += (raw.treble - smooth.treble) * .18;

                var telemetry = telemetryRef.current;
                var progression = Math.max((telemetry.level - 1) / 12, telemetry.lines / 80);
                var journey = clamp(progression + telemetry.combo * .018, 0, 1);
                var flow = clamp(telemetry.combo / 10, 0, 1);
                var danger = telemetry.danger;
                var burst = burstRef.current || 0;
                burstRef.current = Math.max(0, burst * .90 - .003);
                var energy = clamp(smooth.energy + burst * .72 + flow * .08, 0, 1);

                ctx.clearRect(0, 0, width, height);
                var centerX = width * .5;
                var centerY = height * .47;

                var ambient = ctx.createLinearGradient(0, 0, 0, height);
                ambient.addColorStop(0, rgba(palette.deep, .12 + journey * .06));
                ambient.addColorStop(.52, 'rgba(2,6,23,0)');
                ambient.addColorStop(1, rgba(danger ? [127,29,29] : palette.deep, .12 + smooth.bass * .05));
                ctx.fillStyle = ambient;
                ctx.fillRect(0, 0, width, height);

                var glow = ctx.createRadialGradient(centerX, centerY, 18, centerX, centerY, Math.max(width,height) * (.58 + journey * .08));
                glow.addColorStop(0, rgba(danger ? [244,63,94] : palette.a, .045 + energy * .13 + smooth.bass * .05));
                glow.addColorStop(.30, rgba(palette.b, .025 + smooth.mid * .09));
                glow.addColorStop(.72, rgba(palette.c, .008 + journey * .025));
                glow.addColorStop(1, 'rgba(2,6,23,0)');
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);

                drawHorizon(palette, centerX, centerY, journey, smooth.bass, smooth.mid, smooth.treble, danger);
                drawRibbons(palette, centerY, journey, smooth.mid, smooth.treble);

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                var rings = reducedMotion ? 2 : 4 + Math.round(journey * 2);
                for (var r = 0; r < rings; r++) {
                    var base = 130 + r * (92 - journey * 12);
                    var beatPush = smooth.bass * (30 + r * 6);
                    var pulse = Math.sin(t * (.011 + journey * .002) + r * 1.7) * (8 + journey * 8) + beatPush + energy * 12;
                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, base + pulse, (base + pulse) * (.60 + smooth.mid * .035), t * .0009 * (r % 2 ? -1 : 1), 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(r % 2 ? palette.b : palette.a, .022 + energy * .05 + smooth.bass * .045);
                    ctx.lineWidth = .65 + smooth.bass * 1.4 + journey * .35;
                    ctx.stroke();
                }

                var drift = (playing ? .20 : .05) + energy * 1.05 + burst * 2.5 + journey * .72;
                for (var p = 0; p < particles.length; p++) {
                    var particle = particles[p];
                    var dx = particle.x - .5;
                    var dy = particle.y - .47;
                    var len = Math.max(.08, Math.hypot(dx,dy));
                    particle.x += (dx / len) * drift * .00055 * particle.z;
                    particle.y += (dy / len) * drift * .00055 * particle.z;
                    particle.x += Math.sin(t * .006 + particle.phase) * smooth.mid * .00022 * particle.lane;
                    particle.phase += .010 + smooth.treble * .075 + journey * .006;

                    if (particle.x < -.06 || particle.x > 1.06 || particle.y < -.06 || particle.y > 1.06) {
                        particle.x = .46 + Math.random() * .08;
                        particle.y = .43 + Math.random() * .08;
                        particle.z = .22 + Math.random() * .92;
                    }

                    var x = particle.x * width;
                    var y = particle.y * height;
                    var twinkle = .65 + Math.max(0, Math.sin(particle.phase)) * smooth.treble * 1.4;
                    var alpha = (.13 + .31 * particle.z) * (.58 + energy * .78 + journey * .20) * twinkle;
                    var size = particle.size * (.72 + particle.z) * (1 + smooth.treble * .75 + burst * .18);
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fillStyle = rgba(Math.sin(particle.phase) > 0 ? palette.a : palette.c, alpha);
                    ctx.shadowBlur = 7 + smooth.treble * 24 + energy * 8;
                    ctx.shadowColor = rgba(palette.a, .55);
                    ctx.fill();
                }

                if (burst > .06 && !reducedMotion) {
                    var rays = 12 + Math.round(journey * 8);
                    for (var ray = 0; ray < rays; ray++) {
                        var angle = (Math.PI * 2 / rays) * ray + t * .001;
                        var inner = 82 + (1 - burst) * 92;
                        var outer = inner + (100 + journey * 65) * burst;
                        ctx.beginPath();
                        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * .62);
                        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * .62);
                        ctx.strokeStyle = rgba(ray % 2 ? palette.b : palette.a, burst * (.14 + smooth.treble * .08));
                        ctx.lineWidth = 1 + smooth.bass * 1.2;
                        ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.ellipse(centerX, centerY, 120 + (1 - burst) * 170, 74 + (1 - burst) * 105, 0, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(palette.c, burst * .18);
                    ctx.lineWidth = 1.2 + burst * 2.2;
                    ctx.stroke();
                }

                if (danger && Math.sin(t * .12) > .25) {
                    ctx.fillStyle = rgba([244,63,94], .012 + smooth.bass * .018);
                    ctx.fillRect(0, 0, width, height);
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
            React.createElement('div', { className: 'fx-aurora', 'aria-hidden': 'true' }),
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
