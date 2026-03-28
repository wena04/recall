import { Link } from "react-router-dom";
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

    const points: number[] = [];
    for (let i = 0; i < 6000; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.5 + Math.random() * 1.8;

      let x = r * Math.sin(phi) * Math.cos(theta) * 1.2;
      const y = r * Math.cos(phi) * 0.85;
      const z = r * Math.sin(phi) * Math.sin(theta) * 1.0;

      if (Math.abs(x) < 0.2) {
        x = x > 0 ? x + 0.3 : x - 0.3;
      }

      points.push(x, y, z);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc084fc,
      size: 0.03,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const brain = new THREE.Points(geo, mat);
    scene.add(brain);

    const starGeo = new THREE.BufferGeometry();
    const starPts: number[] = [];
    for (let i = 0; i < 3000; i++) {
      starPts.push(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPts, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.5,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
    };
    window.addEventListener("mousemove", onMouseMove);

    let animationFrameId: number;
    const startTime = performance.now();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      brain.rotation.y += 0.003;
      brain.rotation.x = Math.sin(elapsed * 0.5) * 0.05;
      brain.rotation.z = Math.cos(elapsed * 0.3) * 0.02;

      stars.rotation.y += 0.0005;
      stars.rotation.x += 0.0002;

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
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
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
    <section className="relative flex h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <div ref={mountRef} className="absolute inset-0 z-0" />

      <div className="absolute left-0 right-0 top-6 z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <p className="text-sm font-semibold tracking-wide text-purple-100">Recall</p>
        <div className="flex items-center gap-2">
          <Link
            to="/connect"
            className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/20"
          >
            Explore connect flow
          </Link>
          <Link
            to="/login"
            className="rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            Get started
          </Link>
        </div>
      </div>

      <motion.div
        className="relative z-10 mt-[-5%] flex flex-col items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      >
        <motion.h1
          className="mb-4 text-6xl font-bold text-white md:text-8xl"
          animate={{
            textShadow: [
              "0 0 20px rgba(167, 139, 250, 0.5)",
              "0 0 40px rgba(167, 139, 250, 0.8)",
              "0 0 20px rgba(167, 139, 250, 0.5)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          Recall
        </motion.h1>
        <motion.p
          className="text-xl text-purple-200 md:text-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          你的第二大脑
        </motion.p>
      </motion.div>
    </section>
  );
}
