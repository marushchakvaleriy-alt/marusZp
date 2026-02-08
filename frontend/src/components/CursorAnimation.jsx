import React, { useEffect, useRef } from 'react';

const CursorAnimation = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Google Colors
        const colors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58'];

        let particles = [];
        const particleCount = 60; // Number of particles
        let mouse = { x: null, y: null };

        // Resize handling
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        // Mouse tracking
        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Particle Class
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 1;
                this.vy = (Math.random() - 0.5) * 1;
                this.size = Math.random() * 3 + 2;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.baseX = this.x;
                this.baseY = this.y;
                this.density = (Math.random() * 20) + 1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                // Physics: Mouse Interaction
                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    // Gravitational pull force
                    // The closer the mouse, the stronger the pull
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;

                    // Max distance to affect
                    const maxDistance = 300;

                    if (distance < maxDistance) {
                        // Attraction logic: move towards mouse
                        // More "antigravity" floaty feel: 
                        // Accel towards mouse but keep momentum
                        const force = (maxDistance - distance) / maxDistance;
                        const directionX = forceDirectionX * force * this.density * 0.5;
                        const directionY = forceDirectionY * force * this.density * 0.5;

                        this.vx += directionX * 0.05;
                        this.vy += directionY * 0.05;
                    }
                }

                // Friction / Drag to prevent infinite speed
                this.vx *= 0.95;
                this.vy *= 0.95;

                // Add random wandering
                this.vx += (Math.random() - 0.5) * 0.05;
                this.vy += (Math.random() - 0.5) * 0.05;

                // Apply velocity
                this.x += this.vx;
                this.y += this.vy;

                // Wall collisions (bounce)
                if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
                if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

                this.draw();
            }
        }

        // Initialize particles
        const init = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };
        init();

        // Animation Loop
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(particle => particle.update());
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

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
                pointerEvents: 'none', // Allow clicks to pass through
                opacity: 0.6
            }}
        />
    );
};

export default CursorAnimation;
