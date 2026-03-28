import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import * as THREE from "three";

export function Hero() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.z = 7;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Brain Particles
    const pts = [];
    for (let i = 0; i < 6000; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.5 + Math.random() * 1.8;

      let x = r * Math.sin(phi) * Math.cos(theta) * 1.2;
      const y = r * Math.cos(phi) * 0.85;
      const z = r * Math.sin(phi) * Math.sin(theta) * 1.0;

      // Create a small gap to simulate two hemispheres
      if (Math.abs(x) < 0.2) {
        x = x > 0 ? x + 0.3 : x - 0.3;
      }

      pts.push(x, y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc084fc,
      size: 0.03,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const brain = new THREE.Points(geo, mat);
    scene.add(brain);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPts = [];
    for (let i = 0; i < 3000; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      starPts.push(x, y, z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
    const starMat = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.05, 
      transparent: true, 
      opacity: 0.5 
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
    };
    window.addEventListener('mousemove', onMouseMove);

    let animationFrameId: number;
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Avoid THREE.Clock due to deprecation warnings in newer versions
      const elapsed = (performance.now() - startTime) * 0.001;

      brain.rotation.y += 0.003;
      brain.rotation.x = Math.sin(elapsed * 0.5) * 0.05;
      brain.rotation.z = Math.cos(elapsed * 0.3) * 0.02;

      stars.rotation.y += 0.0005;
      stars.rotation.x += 0.0002;
      
      // Smooth camera follow mouse
      camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 5 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geo.dispose();
      mat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      
      {/* Vanilla Three.js Background Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Central content */}
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center pointer-events-none mt-[-5%]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      >
        <motion.h1
          className="text-6xl md:text-8xl font-bold text-white mb-4"
          animate={{
            textShadow: [
              "0 0 20px rgba(167, 139, 250, 0.5)",
              "0 0 40px rgba(167, 139, 250, 0.8)",
              "0 0 20px rgba(167, 139, 250, 0.5)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Recall
        </motion.h1>
        <motion.p
          className="text-xl md:text-2xl text-purple-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          你的第二大脑
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-10"
        animate={{ y: [0, 10, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center pt-2">
          <div className="w-1 h-3 bg-white/50 rounded-full" />
        </div>
      </motion.div>
    </section>
  );
}
