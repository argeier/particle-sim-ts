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
    wanderStrength: number;
    attractionStrength: number;
    repulsionStrength: number;
    maxSpeed: number;
    particleSize: number;
}

class ParticleSystem2D {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private raycaster: THREE.Raycaster;
    private mousePos: THREE.Vector2;
    private attractionPoint: THREE.Vector3;
    private particles: ParticleData[];
    private isLeftMouseDown: boolean;
    private isRightMouseDown: boolean;
    private params: SystemParams;

    constructor() {
        // Scene setup
        this.scene = new THREE.Scene();

        // Initialize parameters
        this.params = {
            color: '#88ccff',
            particleCount: 100,
            wanderStrength: 0.02,
            attractionStrength: 0.1,
            repulsionStrength: 0.15,
            maxSpeed: 0.05,
            particleSize: 0.1
        };

        // Use orthographic camera for 2D view
        const frustumSize = 10;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            100
        );
        this.camera.position.z = 10;

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 1);
        document.body.appendChild(this.renderer.domElement);

        // Post-processing setup
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,
            0.4,
            0.1
        );
        this.composer.addPass(bloomPass);

        // Mouse interaction setup
        this.raycaster = new THREE.Raycaster();
        this.mousePos = new THREE.Vector2();
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
        this.attractionPoint = new THREE.Vector3();

        // Initialize particles
        this.particles = this.createParticles();

        // Initialize GUI
        this.initGUI();

        // Event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Start animation
        this.animate();
    }

    private initGUI(): void {
        const gui = new GUI();
        gui.addColor(this.params, 'color').name('Particle Color').onChange(() => this.updateParticleColors());
        gui.add(this.params, 'wanderStrength', 0, 0.1).name('Wander Strength');
        gui.add(this.params, 'attractionStrength', 0, 0.5).name('Attraction Strength');
        gui.add(this.params, 'repulsionStrength', 0, 0.5).name('Repulsion Strength');
        gui.add(this.params, 'maxSpeed', 0, 0.2).name('Max Speed');
        gui.add(this.params, 'particleSize', 0.05, 0.3).name('Particle Size').onChange(() => this.updateParticleSizes());
    }

    private updateParticleSizes(): void {
        this.particles.forEach(particle => {
            particle.mesh.scale.set(this.params.particleSize, this.params.particleSize, 1);
        });
    }

    private createParticles(): ParticleData[] {
        const particles: ParticleData[] = [];
        const geometry = new THREE.CircleGeometry(1, 16);
        const baseColor = new THREE.Color(this.params.color);

        for (let i = 0; i < this.params.particleCount; i++) {
            // Random position within a 2D rectangle
            const x = (Math.random() - 0.5) * 8;
            const y = (Math.random() - 0.5) * 8;

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
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                baseColor: baseColor.clone()
            });
        }

        return particles;
    }

    private updateParticleColors(): void {
        const color = new THREE.Color(this.params.color);
        this.particles.forEach(particle => {
            particle.baseColor = color.clone();
            if (particle.mesh.material instanceof THREE.MeshBasicMaterial) {
                particle.mesh.material.color = color.clone();
            }
        });
    }

    private updateParticles(): void {
        this.particles.forEach(particle => {
            // Add random movement (wandering behavior)
            particle.velocity.x += (Math.random() - 0.5) * this.params.wanderStrength;
            particle.velocity.y += (Math.random() - 0.5) * this.params.wanderStrength;

            // Handle mouse interactions
            if (this.isLeftMouseDown || this.isRightMouseDown) {
                const mousePos2D = new THREE.Vector2(this.attractionPoint.x, this.attractionPoint.y);
                const particlePos2D = new THREE.Vector2(particle.position.x, particle.position.y);
                const distance = mousePos2D.distanceTo(particlePos2D);

                if (distance < 5) { // Interaction radius
                    const direction = mousePos2D.clone().sub(particlePos2D).normalize();
                    const force = this.isLeftMouseDown ? this.params.attractionStrength : -this.params.repulsionStrength;

                    particle.velocity.x += direction.x * force;
                    particle.velocity.y += direction.y * force;

                    // Adjust opacity based on interaction
                    if (particle.mesh.material instanceof THREE.MeshBasicMaterial) {
                        const opacityChange = this.isLeftMouseDown ?
                            (1 - distance / 5) * 0.5 : // Attraction: more opaque when closer
                            (distance / 5) * 0.5;      // Repulsion: more opaque when further

                        particle.mesh.material.opacity = Math.min(0.8 + opacityChange, 1);
                    }
                } else if (particle.mesh.material instanceof THREE.MeshBasicMaterial) {
                    particle.mesh.material.opacity = 0.8;
                }
            } else if (particle.mesh.material instanceof THREE.MeshBasicMaterial) {
                particle.mesh.material.opacity = 0.8;
            }

            // Limit velocity
            const speed = particle.velocity.length();
            if (speed > this.params.maxSpeed) {
                particle.velocity.multiplyScalar(this.params.maxSpeed / speed);
            }

            // Update position
            particle.position.add(particle.velocity);

            // Bounce off boundaries
            const bounds = 4;
            if (Math.abs(particle.position.x) > bounds) {
                particle.position.x = Math.sign(particle.position.x) * bounds;
                particle.velocity.x *= -0.8;
            }
            if (Math.abs(particle.position.y) > bounds) {
                particle.position.y = Math.sign(particle.position.y) * bounds;
                particle.velocity.y *= -0.8;
            }

            // Update mesh position
            particle.mesh.position.set(particle.position.x, particle.position.y, 0);
        });
    }

    private onWindowResize(): void {
        const frustumSize = 10;
        const aspect = window.innerWidth / window.innerHeight;

        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    private onMouseDown(event: MouseEvent): void {
        if (event.button === 0) {
            this.isLeftMouseDown = true;
        }
        if (event.button === 2) {
            this.isRightMouseDown = true;
        }
        this.updateMousePosition(event);
    }

    private onMouseUp(event: MouseEvent): void {
        if (event.button === 0) {
            this.isLeftMouseDown = false;
        }
        if (event.button === 2) {
            this.isRightMouseDown = false;
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (this.isLeftMouseDown || this.isRightMouseDown) {
            this.updateMousePosition(event);
        }
    }

    private updateMousePosition(event: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Convert to world space
        const frustumSize = 10;
        const aspect = window.innerWidth / window.innerHeight;
        this.attractionPoint.x = (x * (frustumSize * aspect) / 2);
        this.attractionPoint.y = (y * frustumSize / 2);
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.updateParticles();
        this.composer.render();
    }
}

// Initialize the application
new ParticleSystem2D();