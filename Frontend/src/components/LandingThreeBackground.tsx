import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type LandingStyleOption = 'atlas' | 'studio' | 'journal';

interface LandingThreeBackgroundProps {
  styleOption: LandingStyleOption;
  theme: 'dark' | 'light';
}

const NODE_POINTS: [number, number, number][] = [
  [0, 0.08, 0],
  [-1.7, 0.62, -0.52],
  [1.86, 0.68, -0.42],
  [-1.12, -1.05, 0.32],
  [1.36, -0.94, 0.52],
  [0.18, 1.48, -0.82],
  [0.68, -1.88, -0.18],
  [2.62, -0.05, -0.78],
  [-2.18, -0.28, -0.72],
];

const LINE_INDICES = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 3],
  [2, 4],
  [3, 6],
  [4, 6],
  [1, 5],
  [2, 5],
  [2, 7],
  [4, 7],
  [1, 8],
  [3, 8],
];

const THEME_PALETTES = {
  atlas: {
    primary: '#5ef2ff',
    secondary: '#4c8dff',
    accent: '#ff9966',
    line: '#78beff',
  },
  studio: {
    primary: '#6ee7ff',
    secondary: '#5b7cff',
    accent: '#67de96',
    line: '#5ea0ff',
  },
  journal: {
    primary: '#6aa7ff',
    secondary: '#5ef2ff',
    accent: '#c98854',
    line: '#8fb7e8',
  },
} as const;

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
}

function ResearchConstellation({ styleOption, theme }: LandingThreeBackgroundProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const scrollProgressRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const { viewport } = useThree();
  const palette = THEME_PALETTES[styleOption];

  const linePositions = useMemo(() => {
    const vertices: number[] = [];

    LINE_INDICES.forEach(([startIndex, endIndex]) => {
      vertices.push(...NODE_POINTS[startIndex], ...NODE_POINTS[endIndex]);
    });

    return new Float32Array(vertices);
  }, []);

  const particlePositions = useMemo(() => {
    const vertices: number[] = [];

    for (let index = 0; index < 180; index += 1) {
      const angle = index * 1.618;
      const radius = 2.35 + (index % 13) * 0.18;
      const depth = ((index % 17) - 8) * 0.13;
      vertices.push(Math.cos(angle) * radius, Math.sin(index * 0.71) * 1.35, Math.sin(angle) * radius * 0.38 + depth);
    }

    return new Float32Array(vertices);
  }, []);

  useEffect(() => {
    const scrollParent = document.querySelector('.premium-page-shell');
    const target = scrollParent ?? window;

    const updateScroll = () => {
      const scrollTop = scrollParent ? scrollParent.scrollTop : window.scrollY;
      const maxScroll = scrollParent
        ? scrollParent.scrollHeight - scrollParent.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;

      scrollProgressRef.current = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 0;
    };

    updateScroll();
    target.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);

    return () => {
      target.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, []);

  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.getElapsedTime();
    const scrollProgress = scrollProgressRef.current;

    if (groupRef.current) {
      const baseX = viewport.width < 6 ? 0.28 : 2.42;
      const baseY = viewport.width < 6 ? -0.32 : -0.18;
      const targetRotationY = -0.58 + scrollProgress * 1.05;
      const targetRotationX = 0.2 - scrollProgress * 0.34;
      const targetPositionX = baseX - scrollProgress * (viewport.width < 6 ? 0.22 : 0.62);
      const targetPositionY = baseY + scrollProgress * 1.12;

      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotationY, 3.8, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotationX, 3.8, delta);
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetPositionX, 3.6, delta);
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPositionY, 3.6, delta);

      if (!reducedMotion) {
        groupRef.current.rotation.z = Math.sin(elapsed * 0.18) * 0.028;
      }
    }

    if (coreRef.current && !reducedMotion) {
      const scale = 1 + Math.sin(elapsed * 1.15) * 0.028;
      coreRef.current.scale.setScalar(scale);
    }

    if (outerRingRef.current && !reducedMotion) {
      outerRingRef.current.rotation.z = elapsed * 0.11 + scrollProgress * 1.8;
    }

    if (innerRingRef.current && !reducedMotion) {
      innerRingRef.current.rotation.z = -elapsed * 0.16 - scrollProgress * 1.3;
      innerRingRef.current.rotation.x = Math.PI / 2.5 + scrollProgress * 0.38;
    }

    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.05 + scrollProgress * 0.24, 3, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, viewport.width < 6 ? 8.8 - scrollProgress * 0.55 : 7.4 - scrollProgress * 0.72, 3, delta);
    camera.lookAt(viewport.width < 6 ? 0.1 : 1.28, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={theme === 'dark' || styleOption === 'studio' ? 0.58 : 0.82} />
      <pointLight position={[-2.4, 2.4, 2.5]} intensity={1.8} color={palette.primary} />
      <pointLight position={[3.2, -1.4, 2.4]} intensity={1.15} color={palette.accent} />
      <group ref={groupRef} position={[viewport.width < 6 ? 0.28 : 2.42, viewport.width < 6 ? -0.32 : -0.18, -0.2]} scale={viewport.width < 6 ? 0.54 : 0.76}>
        <mesh ref={outerRingRef} rotation={[Math.PI / 2.7, 0, 0]}>
          <torusGeometry args={[2.08, 0.006, 10, 180]} />
          <meshBasicMaterial color={palette.line} transparent opacity={0.16} />
        </mesh>
        <mesh ref={innerRingRef} rotation={[Math.PI / 2.4, 0, Math.PI / 8]}>
          <torusGeometry args={[1.24, 0.008, 10, 160]} />
          <meshBasicMaterial color={palette.primary} transparent opacity={0.22} />
        </mesh>
        <mesh rotation={[Math.PI / 2.8, 0.34, -0.18]}>
          <torusGeometry args={[1.68, 0.004, 8, 180]} />
          <meshBasicMaterial color={palette.accent} transparent opacity={0.13} />
        </mesh>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={palette.line} transparent opacity={0.19} />
        </lineSegments>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={palette.primary} size={0.018} transparent opacity={styleOption === 'journal' ? 0.22 : 0.28} sizeAttenuation />
        </points>
        {NODE_POINTS.map(([x, y, z], index) => (
          <mesh key={`${x}-${y}-${z}`} ref={index === 0 ? coreRef : undefined} position={[x, y, z]}>
            <sphereGeometry args={[index === 0 ? 0.24 : 0.07 + (index % 2) * 0.025, 36, 36]} />
            <meshStandardMaterial
              color={index === 0 ? palette.primary : index % 3 === 0 ? palette.accent : palette.secondary}
              emissive={index === 0 ? palette.secondary : palette.primary}
              emissiveIntensity={index === 0 ? 0.28 : 0.1}
              roughness={0.34}
              metalness={0.18}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.02, -0.08]} scale={[1.35, 1.35, 1.35]}>
          <icosahedronGeometry args={[1.08, 1]} />
          <meshBasicMaterial color={palette.secondary} transparent opacity={0.035} wireframe />
        </mesh>
      </group>
    </>
  );
}

export function LandingThreeBackground({ styleOption, theme }: LandingThreeBackgroundProps) {
  return (
    <div className="premium-three-background" aria-hidden="true">
      <Canvas
        dpr={[1, 1.55]}
        camera={{ position: [0, 0.05, 6.8], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ResearchConstellation styleOption={styleOption} theme={theme} />
      </Canvas>
    </div>
  );
}
