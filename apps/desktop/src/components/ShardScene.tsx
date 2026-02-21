import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface ShardMeshProps {
  color?: string;
  emissive?: string;
  variant?: string;
}

function geometryForVariant(variant?: string): THREE.BufferGeometry {
  switch ((variant || "").toLowerCase()) {
    case "oracle":
      return new THREE.OctahedronGeometry(1.35, 1);
    case "cipher":
      return new THREE.TorusKnotGeometry(0.85, 0.22, 128, 16);
    case "scribe":
      return new THREE.DodecahedronGeometry(1.3, 0);
    case "muse":
      return new THREE.IcosahedronGeometry(1.2, 2);
    case "architect":
      return new THREE.BoxGeometry(1.9, 1.9, 1.9, 2, 2, 2);
    case "advocate":
      return new THREE.ConeGeometry(1.25, 2.2, 7, 1);
    case "sentinel":
      return new THREE.CylinderGeometry(1.0, 1.0, 2.1, 8, 3, true);
    case "mirror":
      return new THREE.SphereGeometry(1.25, 32, 24);
    default:
      return new THREE.IcosahedronGeometry(1.4, 1);
  }
}

function ShardMesh({
  color = "#00d4aa",
  emissive = "#00d4aa",
  variant,
}: ShardMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const geo = useMemo(() => geometryForVariant(variant), [variant]);

  useEffect(() => {
    return () => geo.dispose();
  }, [geo]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    meshRef.current.rotation.y = t * 0.4;
    meshRef.current.position.y = Math.sin(t * 0.5) * 0.15;
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.22}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

interface ShardSceneProps {
  color?: string;
  emissive?: string;
  variant?: string;
  className?: string;
}

export default function ShardScene({
  color,
  emissive,
  variant,
  className,
}: ShardSceneProps) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} color="#00d4aa" intensity={1.5} />
        <pointLight position={[-5, -3, 3]} color="#7c3aed" intensity={1} />
        <ShardMesh color={color} emissive={emissive} variant={variant} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
