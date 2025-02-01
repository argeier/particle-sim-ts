import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GUI } from 'lil-gui';

interface ParticleData {
    mesh: THREE.Mesh;
    position: THREE.Vector2;
    velocity: THREE.Vector2;
    baseColor: THREE.Color;
}

interface SystemParams {
    color: string;
    particleCount: number;
    attractionStrength: number;
    repulsionStrength: number;
    maxSpeed: number;
    particleSize: number;
    gravity: number;
    friction: number;
    stopThreshold: number;
}

class ParticleSystem2D {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private attractionPoint = new THREE.Vector3();
    private particles: ParticleData[];
    private border!: THREE.LineSegments;
    private isLeftMouseDown = false;
    private isRightMouseDown = false;
    private params: SystemParams = {
        color: '#88ccff',
        particleCount: 1000,
        attractionStrength: 0.1,
        repulsionStrength: 0.15,
        maxSpeed: 8,
        particleSize: 8,
        gravity: 0.2,
        friction: 0.98,
        stopThreshold: 0.05
    };
    private windowWidth: number = window.innerWidth;
    private windowHeight: number = window.innerHeight;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(
            -this.windowWidth / 2,
            this.windowWidth / 2,
            this.windowHeight / 2,
            -this.windowHeight / 2,
            0.1,
            100
        );
        this.camera.position.z = 10;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.windowWidth, this.windowHeight);
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(
            new UnrealBloomPass(
                new THREE.Vector2(this.windowWidth, this.windowHeight),
                1.5,
                0.4,
                0.1
            )
        );

        this.particles = this.createParticles();
        this.createBorder();
        this.initGUI();
        this.addEventListeners();
        this.animate();
    }

    private createParticles(): ParticleData[] {
        const particles: ParticleData[] = [];
        const geometry = new THREE.CircleGeometry(1, 16);
        const baseColor = new THREE.Color(this.params.color);

        for (let i = 0; i < this.params.particleCount; i++) {
            // Place particles randomly within the border.
            const x = (Math.random() - 0.5) * this.windowWidth;
            const y = (Math.random() - 0.5) * this.windowHeight;
            const material = new THREE.MeshBasicMaterial({
                color: baseColor.clone(),
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, 0);
            mesh.scale.set(this.params.particleSize, this.params.particleSize, 1);
            this.scene.add(mesh);

            particles.push({
                mesh,
                position: new THREE.Vector2(x, y),
                velocity: new THREE.Vector2(
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 4
                ),
                baseColor: baseColor.clone()
            });
        }
        return particles;
    }

    // Create a visible rectangular border.
    private createBorder(): void {
        if (this.border) {
            this.scene.remove(this.border);
        }
        const borderGeometry = new THREE.EdgesGeometry(
            new THREE.PlaneGeometry(this.windowWidth, this.windowHeight)
        );
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        this.border = new THREE.LineSegments(borderGeometry, borderMaterial);
        this.scene.add(this.border);
    }

    private updateParticles(): void {
        const radius = this.params.particleSize;
        const halfWidth = this.windowWidth / 2;
        const halfHeight = this.windowHeight / 2;

        // Update each particle.
        this.particles.forEach(p => {
            // Apply mouse-based attraction or repulsion.
            if (this.isLeftMouseDown || this.isRightMouseDown) {
                const mousePos = new THREE.Vector2(this.attractionPoint.x, this.attractionPoint.y);
                const distance = mousePos.distanceTo(p.position);
                const interactionRadius = Math.min(this.windowWidth, this.windowHeight);
                if (distance < interactionRadius) {
                    const direction = mousePos.clone().sub(p.position).normalize();
                    const force = this.isLeftMouseDown ? this.params.attractionStrength : -this.params.repulsionStrength;
                    p.velocity.addScaledVector(direction, force * 100);
                    if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
                        const opacityChange =
                            this.isLeftMouseDown
                                ? (1 - distance / interactionRadius) * 0.5
                                : (distance / interactionRadius) * 0.5;
                        p.mesh.material.opacity = Math.min(0.8 + opacityChange, 1);
                    }
                } else if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
                    p.mesh.material.opacity = 0.8;
                }
            } else if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
                p.mesh.material.opacity = 0.8;
            }

            // Apply gravity.
            p.velocity.y -= this.params.gravity;

            // Limit speed.
            const speed = p.velocity.length();
            if (speed > this.params.maxSpeed) {
                p.velocity.multiplyScalar(this.params.maxSpeed / speed);
            }

            // Update position.
            p.position.add(p.velocity);

            // Handle collision with the rectangular border.
            if (p.position.x < -halfWidth + radius) {
                p.position.x = -halfWidth + radius;
                p.velocity.x *= -0.9;
            }
            if (p.position.x > halfWidth - radius) {
                p.position.x = halfWidth - radius;
                p.velocity.x *= -0.9;
            }
            if (p.position.y < -halfHeight + radius) {
                p.position.y = -halfHeight + radius;
                p.velocity.y *= -0.9;
            }
            if (p.position.y > halfHeight - radius) {
                p.position.y = halfHeight - radius;
                p.velocity.y *= -0.9;
            }

            // Apply friction so particles eventually slow down.
            p.velocity.multiplyScalar(this.params.friction);
            if (p.velocity.length() < this.params.stopThreshold) {
                p.velocity.set(0, 0);
            }
        });

        // (Optional) Collision handling among particles.
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const diff = p1.position.clone().sub(p2.position);
                const distance = diff.length();
                const minDist = radius * 2;
                if (distance > 0 && distance < minDist) {
                    const overlap = minDist - distance;
                    const normal = diff.clone().normalize();
                    p1.position.add(normal.clone().multiplyScalar(overlap / 2));
                    p2.position.sub(normal.clone().multiplyScalar(overlap / 2));
                    const relativeVelocity = p1.velocity.clone().sub(p2.velocity);
                    const velAlongNormal = relativeVelocity.dot(normal);
                    if (velAlongNormal < 0) {
                        const impulse = -velAlongNormal;
                        p1.velocity.add(normal.clone().multiplyScalar(impulse));
                        p2.velocity.sub(normal.clone().multiplyScalar(impulse));
                    }
                }
            }
        }

        // Update each mesh position.
        this.particles.forEach(p => {
            p.mesh.position.set(p.position.x, p.position.y, 0);
        });
    }

    private onWindowResize = (): void => {
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.camera.left = -this.windowWidth / 2;
        this.camera.right = this.windowWidth / 2;
        this.camera.top = this.windowHeight / 2;
        this.camera.bottom = -this.windowHeight / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.windowWidth, this.windowHeight);
        this.composer.setSize(this.windowWidth, this.windowHeight);
        this.createBorder();
    };

    private updateMousePosition = (event: MouseEvent): void => {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.attractionPoint.x = event.clientX - rect.left - this.windowWidth / 2;
        this.attractionPoint.y = -(event.clientY - rect.top - this.windowHeight / 2);
    };

    private initGUI(): void {
        const gui = new GUI();
        gui.addColor(this.params, 'color').name('Particle Color').onChange(() => this.updateParticleColors());
        gui.add(this.params, 'attractionStrength', 0, 0.5).name('Attraction Strength');
        gui.add(this.params, 'repulsionStrength', 0, 0.5).name('Repulsion Strength');
        gui.add(this.params, 'maxSpeed', 0, 20).name('Max Speed');
        gui.add(this.params, 'particleSize', 2, 20)
            .name('Particle Size')
            .onChange(() => this.updateParticleSizes());
        gui.add(this.params, 'gravity', 0, 2).name('Gravity');
        gui.add(this.params, 'friction', 0.90, 1).name('Friction');
        gui.add(this.params, 'stopThreshold', 0.01, 0.2).name('Stop Threshold');
    }

    private updateParticleSizes(): void {
        this.particles.forEach(p => {
            p.mesh.scale.set(this.params.particleSize, this.params.particleSize, 1);
        });
    }

    private updateParticleColors(): void {
        const color = new THREE.Color(this.params.color);
        this.particles.forEach(p => {
            p.baseColor = color.clone();
            if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
                p.mesh.material.color = color.clone();
            }
        });
    }

    private onMouseDown = (event: MouseEvent): void => {
        if (event.button === 0) this.isLeftMouseDown = true;
        if (event.button === 2) this.isRightMouseDown = true;
        this.updateMousePosition(event);
    };

    private onMouseUp = (event: MouseEvent): void => {
        if (event.button === 0) this.isLeftMouseDown = false;
        if (event.button === 2) this.isRightMouseDown = false;
    };

    private onMouseMove = (event: MouseEvent): void => {
        if (this.isLeftMouseDown || this.isRightMouseDown) {
            this.updateMousePosition(event);
        }
    };

    private addEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    private animate = (): void => {
        requestAnimationFrame(this.animate);
        this.updateParticles();
        this.composer.render();
    };
}

new ParticleSystem2D();
