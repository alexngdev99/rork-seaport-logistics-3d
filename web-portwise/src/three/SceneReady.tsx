import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { boot } from "@/state/boot";

/** Frames rendered after shader compile before the cover lifts, so the first visible frame is warm. */
const WARM_FRAMES = 12;

/**
 * Mounted inside the scene's Suspense boundary, so it only runs once every model and
 * label font has resolved. It then precompiles all shaders and lets a few frames render
 * (shadow maps, text SDFs, instanced buffers) before reporting the scene ready.
 */
export function SceneReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const framesLeft = useRef<number>(-1);

  useEffect(() => {
    boot.mark("scene");
    let isCancelled = false;
    const finish = () => {
      if (isCancelled) return;
      boot.mark("shaders");
      framesLeft.current = WARM_FRAMES;
    };
    // Let React/troika flush the freshly mounted meshes before compiling.
    const raf = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera)
        .then(finish)
        .catch((err: unknown) => {
          console.warn("[boot] shader precompile failed", err instanceof Error ? err.message : err);
          finish();
        });
    });
    return () => {
      isCancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    if (framesLeft.current < 0) return;
    framesLeft.current -= 1;
    if (framesLeft.current === 0) boot.mark("frames");
  });

  return null;
}
