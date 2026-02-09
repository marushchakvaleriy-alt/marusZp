import React, { useEffect, useRef } from 'react';

const SeasonBackground = ({ season = 'winter' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Configuration based on season
        let particles = [];
        let particleCount = 50;

        const getSeasonConfig = () => {
            switch (season) {
                case 'winter': return { count: 100, type: 'snow', bg: 'linear-gradient(to bottom, #e0f2fe, #f8fafc)' }; // Sky blue to white
                case 'spring': return { count: 30, type: 'bird', bg: 'linear-gradient(to bottom, #f0fdf4, #f8fafc)' }; // Mint to white
                case 'summer': return { count: 60, type: 'firefly', bg: 'linear-gradient(to bottom, #fefce8, #f8fafc)' }; // Yellow to white
                case 'autumn': return { count: 80, type: 'leaf', bg: 'linear-gradient(to bottom, #fff7ed, #f8fafc)' }; // Orange to white
                default: return { count: 100, type: 'snow', bg: '#f8fafc' };
            }
        };

        const config = getSeasonConfig();
        particleCount = config.count;

        // Update canvas background for atmosphere
        canvas.style.background = config.bg;
        canvas.style.transition = 'background 2s ease';

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.reset();
                // Randomize initial position to fill screen
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
            }

            reset() {
                this.x = Math.random() * canvas.width;
                this.y = -10; // Start above screen
                if (config.type === 'bird') {
                    this.x = -10; // Birds start from left
                    this.y = Math.random() * canvas.height * 0.5; // Birds fly mostly in top half
                }

                // Speed and Size
                switch (config.type) {
                    case 'snow':
                        this.vx = (Math.random() - 0.5) * 0.2; // Very slight drift
                        this.vy = Math.random() * 0.5 + 0.2; // Very slow fall (0.2 to 0.7)
                        this.size = Math.random() * 4 + 2;
                        this.color = '#94a3b8';
                        break;
                    case 'bird':
                        this.vx = Math.random() * 0.5 + 0.2; // VERY SLOW speed (0.2 to 0.7)
                        this.vy = (Math.random() - 0.5) * 0.2; // Gentle vertical drift
                        this.size = Math.random() * 3 + 4; // Slightly larger for detail
                        this.color = 'rgba(0, 0, 0, 0.5)';
                        this.flapSpeed = Math.random() * 0.05 + 0.02; // Slow graceful flap
                        this.flap = Math.random() * Math.PI * 2;
                        break;
                    case 'firefly':
                        this.vx = (Math.random() - 0.5) * 0.3; // Slower fireflies
                        this.vy = (Math.random() - 0.5) * 0.3;
                        this.size = Math.random() * 3 + 2;
                        this.color = `rgba(255, 215, 0, ${Math.random() * 0.5 + 0.3})`; // Gold
                        this.y = Math.random() * canvas.height; // Fireflies start anywhere
                        break;
                    case 'leaf':
                        this.vx = (Math.random() - 0.5) * 1.5; // Slower leaves
                        this.vy = Math.random() * 1 + 0.5;
                        this.size = Math.random() * 8 + 5;
                        const leafColors = ['#e63946', '#f4a261', '#e9c46a', '#d62828'];
                        this.color = leafColors[Math.floor(Math.random() * leafColors.length)];
                        this.rotation = Math.random() * 360;
                        this.swing = Math.random() * 0.03; // Less swing speed
                        this.swingCount = Math.random() * 100;
                        break;
                    default:
                        break;
                }
            }

            draw() {
                ctx.beginPath();
                if (config.type === 'snow' || config.type === 'firefly') {
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    if (config.type === 'firefly') {
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = 'yellow';
                    } else {
                        ctx.shadowBlur = 0;
                    }
                    ctx.fill();
                } else if (config.type === 'bird') {
                    // Flapping animation
                    const wingY = Math.sin(this.flap) * 3; // Smaller flap amplitude

                    ctx.moveTo(this.x, this.y);
                    // Left wing (curved)
                    ctx.quadraticCurveTo(this.x - this.size, this.y + wingY - 3, this.x - this.size * 2, this.y + wingY);

                    ctx.moveTo(this.x, this.y);
                    // Right wing (curved)
                    ctx.quadraticCurveTo(this.x + this.size, this.y + wingY - 3, this.x + this.size * 2, this.y + wingY);

                    ctx.strokeStyle = this.color;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                } else if (config.type === 'leaf') {
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.rotation * Math.PI / 180);
                    ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.fill();
                    ctx.restore();
                }
            }

            update() {
                if (config.type === 'snow') {
                    this.x += this.vx;
                    this.y += this.vy;
                    // Reset if out of bounds
                    if (this.y > canvas.height) this.reset();
                    if (this.x > canvas.width || this.x < 0) this.x = (this.x + canvas.width) % canvas.width;
                } else if (config.type === 'bird') {
                    this.x += this.vx;
                    this.y += this.vy + Math.sin(this.x * 0.02) * 0.2; // Less wobble
                    this.flap += this.flapSpeed; // Update flap cycle
                    if (this.x > canvas.width + 20) this.reset();
                } else if (config.type === 'firefly') {
                    this.x += this.vx;
                    this.y += this.vy;
                    // Bounce off edges logic or wrap
                    if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
                    if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;
                    // Random slight direction change
                    if (Math.random() < 0.02) {
                        this.vx = (Math.random() - 0.5) * 0.3;
                        this.vy = (Math.random() - 0.5) * 0.3;
                    }
                } else if (config.type === 'leaf') {
                    this.swingCount += this.swing;
                    this.x += Math.sin(this.swingCount) * 1 + this.vx;
                    this.y += this.vy;
                    this.rotation += 1;
                    if (this.y > canvas.height) this.reset();
                }

                this.draw();
            }
        }

        const init = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };
        init();

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => p.update());
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [season]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: -1,
                pointerEvents: 'none',
                opacity: 0.6
            }}
        />
    );
};

export default SeasonBackground;
