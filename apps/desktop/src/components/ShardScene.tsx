import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface ShardMeshProps {
  color?: string;
  emissive?: string;
}

function ShardMesh({ color = "#00d4aa", emissive = "#00d4aa" }: ShardMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.4, 1), []);

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
        emissiveIntensity={0.3}
        wireframe
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

interface ShardSceneProps {
  color?: string;
  emissive?: string;
  className?: string;
}

export default function ShardScene({
  color,
  emissive,
  className,
}: ShardSceneProps) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} color="#00d4aa" intensity={1.5} />
        <pointLight position={[-5, -3, 3]} color="#7c3aed" intensity={1} />
        <ShardMesh color={color} emissive={emissive} />
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
