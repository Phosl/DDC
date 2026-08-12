"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { PublicRelease } from "@/content/project";

type ReleaseShaderProps = {
  imageSrc: string;
  mode: PublicRelease["visualMode"];
  className?: string;
};

const MODE_INDEX: Record<PublicRelease["visualMode"], number> = {
  reaction: 0,
  echo: 1,
  fracture: 2,
};

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uMode;
  uniform vec2 uPointer;
  uniform vec2 uResolution;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);

    float a = hash(cell);
    float b = hash(cell + vec2(1.0, 0.0));
    float c = hash(cell + vec2(0.0, 1.0));
    float d = hash(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  vec3 reaction(vec2 uv, float strength) {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 toPointer = uv - uPointer;
    toPointer.x *= aspect;
    float pulse = sin(length(toPointer) * 34.0 - uTime * 3.2);
    float liquid = valueNoise(uv * 7.0 + vec2(uTime * 0.12, -uTime * 0.09));
    vec2 offset = vec2(
      sin(uv.y * 22.0 + uTime * 1.7),
      cos(uv.x * 18.0 - uTime * 1.25)
    ) * (0.0025 + liquid * 0.006) * strength;
    offset += normalize(toPointer + vec2(0.0001)) * pulse * 0.004 * strength;

    vec3 base = texture2D(uTexture, uv + offset).rgb;
    float split = 0.0065 * strength;
    float red = texture2D(uTexture, uv + offset + vec2(split, 0.0)).r;
    float blue = texture2D(uTexture, uv + offset - vec2(split, 0.0)).b;
    vec3 chroma = vec3(red, base.g, blue);
    vec3 reagent = vec3(0.843, 1.0, 0.275);
    float bloom = smoothstep(0.58, 0.9, liquid + pulse * 0.08) * strength;
    return mix(chroma, chroma + reagent * bloom * 0.24, strength * 0.82);
  }

  vec3 echo(vec2 uv, float strength) {
    float scan = sin(uv.y * 96.0 + uTime * 2.4);
    float drift = sin(uv.y * 14.0 - uTime * 0.85) * 0.008 * strength;
    float pointerDrift = (uPointer.x - 0.5) * 0.012 * strength;
    vec2 echoOffset = vec2(drift + pointerDrift, scan * 0.0018 * strength);

    vec3 base = texture2D(uTexture, uv).rgb;
    vec3 past = texture2D(uTexture, uv - echoOffset * 1.7).rgb;
    vec3 future = texture2D(uTexture, uv + echoOffset).rgb;
    float mono = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 ghost = vec3(past.r * 0.8, future.g, future.b * 1.08);
    vec3 cyan = vec3(0.153, 0.878, 0.82);
    vec3 magenta = vec3(1.0, 0.165, 0.471);
    float band = smoothstep(0.75, 1.0, sin(uv.y * 30.0 - uTime * 0.7) * 0.5 + 0.5);
    vec3 tinted = mix(vec3(mono), ghost, 0.72);
    tinted += mix(cyan, magenta, step(0.0, scan)) * band * 0.12 * strength;
    return mix(base, tinted, strength * 0.88);
  }

  vec3 fracture(vec2 uv, float strength) {
    vec2 grid = vec2(9.0, 13.0);
    vec2 cell = floor(uv * grid);
    float cellNoise = hash(cell);
    float beat = step(0.7, sin(uTime * 1.35 + cellNoise * 6.283) * 0.5 + 0.5);
    float direction = step(0.5, cellNoise) * 2.0 - 1.0;
    vec2 fracturedUv = uv;
    fracturedUv.x += direction * beat * 0.014 * strength;
    fracturedUv.y += (cellNoise - 0.5) * 0.008 * strength;

    vec3 base = texture2D(uTexture, fracturedUv).rgb;
    float luminance = dot(base, vec3(0.299, 0.587, 0.114));
    float poster = floor(luminance * 5.0) / 5.0;
    float dither = step(hash(gl_FragCoord.xy), fract(luminance * 5.0));
    vec3 paper = vec3(0.906, 0.882, 0.843);
    vec3 magenta = vec3(1.0, 0.165, 0.471);
    vec3 cyan = vec3(0.153, 0.878, 0.82);
    vec3 ink = mix(vec3(0.03), paper, clamp(poster + dither * 0.09, 0.0, 1.0));
    ink = mix(ink, magenta, smoothstep(0.42, 0.74, base.r - base.g) * 0.72);
    float seam = step(0.94, fract(uv.y * grid.y + cellNoise * 0.2));
    ink += cyan * seam * 0.32 * strength;
    return mix(base, ink, strength * 0.78);
  }

  void main() {
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    float strength = clamp(uIntensity, 0.0, 1.0);
    vec3 color;

    if (uMode < 0.5) {
      color = reaction(uv, strength);
    } else if (uMode < 1.5) {
      color = echo(uv, strength);
    } else {
      color = fracture(uv, strength);
    }

    float grain = (hash(gl_FragCoord.xy + uTime * 17.0) - 0.5) * 0.045 * strength;
    gl_FragColor = vec4(clamp(color + grain, 0.0, 1.0), 1.0);
  }
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function ReleaseShader({
  imageSrc,
  mode,
  className,
}: ReleaseShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nearViewportRef = useRef(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (reducedMotion || connection?.saveData) return;

    let disposeRenderer: (() => void) | null = null;
    let cancelled = false;

    const initializeRenderer = () => {
      if (cancelled || disposeRenderer || !nearViewportRef.current) return;

      const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
      if (!gl) return;

      const program = createProgram(gl);
      if (!program) return;

      const positionLocation = gl.getAttribLocation(program, "aPosition");
    const textureLocation = gl.getUniformLocation(program, "uTexture");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const intensityLocation = gl.getUniformLocation(program, "uIntensity");
    const modeLocation = gl.getUniformLocation(program, "uMode");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();

      if (positionLocation < 0 || !buffer || !texture) {
      gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
        return;
      }

      gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(textureLocation, 0);
    gl.uniform1f(modeLocation, MODE_INDEX[mode]);

      let animationFrame = 0;
    let isVisible = false;
    let isDocumentVisible = !document.hidden;
    let textureReady = false;
    let targetIntensity = 0.18;
    let intensity = 0;
    let previousTime = performance.now();
    let previousDrawTime = 0;
      let firstFrameDrawn = false;
      let touchResetTimer = 0;
      const pointer = { x: 0.5, y: 0.5 };
    const smoothPointer = { x: 0.5, y: 0.5 };
    const interactiveRoot = canvas.closest("a");

      const image = new Image();
      image.decoding = "async";

      const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const sourceWidth = image.naturalWidth || 768;
        const sourceHeight = image.naturalHeight || 768;
        const width = Math.max(
          1,
          Math.min(768, sourceWidth, Math.round(bounds.width * dpr)),
        );
        const height = Math.max(
          1,
          Math.min(768, sourceHeight, Math.round(bounds.height * dpr)),
        );

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      };

      const draw = (timestamp: number) => {
      if (!textureReady || !isVisible || !isDocumentVisible) {
        animationFrame = 0;
        return;
      }

      if (timestamp - previousDrawTime < 30) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      resize();
      const delta = Math.min(0.05, Math.max(0, (timestamp - previousTime) / 1_000));
      previousTime = timestamp;
      const easing = 1 - Math.exp(-delta * 8);
      intensity += (targetIntensity - intensity) * easing;
      smoothPointer.x += (pointer.x - smoothPointer.x) * easing;
      smoothPointer.y += (pointer.y - smoothPointer.y) * easing;
      previousDrawTime = timestamp;

      gl.useProgram(program);
      gl.uniform1f(timeLocation, timestamp / 1_000);
      gl.uniform1f(intensityLocation, intensity);
      gl.uniform2f(pointerLocation, smoothPointer.x, smoothPointer.y);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (!firstFrameDrawn) {
          firstFrameDrawn = true;
          canvas.dataset.ready = "true";
        }
      animationFrame = window.requestAnimationFrame(draw);
      };

      const requestDraw = () => {
      if (
        animationFrame === 0 &&
        textureReady &&
        isVisible &&
        isDocumentVisible
      ) {
        previousTime = performance.now();
        animationFrame = window.requestAnimationFrame(draw);
      }
      };

    image.onload = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      textureReady = true;
      requestDraw();
    };
    image.src = imageSrc;

    const onPointerEnter = () => {
      targetIntensity = 0.92;
      requestDraw();
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      pointer.y = clamp(1 - (event.clientY - bounds.top) / bounds.height, 0, 1);
    };
    const onPointerLeave = () => {
      targetIntensity = 0.18;
      pointer.x = 0.5;
      pointer.y = 0.5;
    };
    const onPointerDown = () => {
      targetIntensity = 1;
      requestDraw();
      window.clearTimeout(touchResetTimer);
      touchResetTimer = window.setTimeout(() => {
        targetIntensity = 0.18;
      }, 420);
    };
    const onFocusIn = () => {
      targetIntensity = 0.92;
      requestDraw();
    };
    const onFocusOut = () => {
      targetIntensity = 0.18;
    };
    const onVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible) requestDraw();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      canvas.dataset.ready = "false";
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    interactiveRoot?.addEventListener("pointerenter", onPointerEnter);
    interactiveRoot?.addEventListener("pointermove", onPointerMove);
    interactiveRoot?.addEventListener("pointerleave", onPointerLeave);
    interactiveRoot?.addEventListener("pointerdown", onPointerDown);
    interactiveRoot?.addEventListener("focusin", onFocusIn);
    interactiveRoot?.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);

      const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

      const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = Boolean(entry?.isIntersecting);
        if (isVisible) {
          requestDraw();
        } else if (animationFrame !== 0) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      },
      { rootMargin: "160px 0px", threshold: 0.01 },
    );
      intersectionObserver.observe(canvas);

      disposeRenderer = () => {
      image.onload = null;
      interactiveRoot?.removeEventListener("pointerenter", onPointerEnter);
      interactiveRoot?.removeEventListener("pointermove", onPointerMove);
      interactiveRoot?.removeEventListener("pointerleave", onPointerLeave);
      interactiveRoot?.removeEventListener("pointerdown", onPointerDown);
      interactiveRoot?.removeEventListener("focusin", onFocusIn);
      interactiveRoot?.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.clearTimeout(touchResetTimer);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
        disposeRenderer = null;
      };
    };

    const nearViewportObserver = new IntersectionObserver(
      ([entry]) => {
        nearViewportRef.current = Boolean(entry?.isIntersecting);
        if (nearViewportRef.current) {
          initializeRenderer();
          nearViewportObserver.disconnect();
        }
      },
      { rootMargin: "180px 0px", threshold: 0.01 },
    );
    nearViewportObserver.observe(canvas);

    return () => {
      cancelled = true;
      nearViewportRef.current = false;
      nearViewportObserver.disconnect();
      disposeRenderer?.();
      canvas.dataset.ready = "false";
    };
  }, [imageSrc, mode, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      data-ready="false"
    />
  );
}
