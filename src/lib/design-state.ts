import { nanoid } from "nanoid";

// Design state represents how a design is positioned on a product
// This structure can be modified via drag/drop UI or via natural language commands

export interface DesignState {
  // Position as percentage of print area (0-100)
  x: number; // 50 = centered horizontally
  y: number; // 50 = centered vertically

  // Scale as multiplier (1 = 100% of original/fitted size)
  scale: number;

  // Rotation in degrees (0-360)
  rotation: number;

  // Lock aspect ratio when scaling
  lockAspectRatio: boolean;
}

// Product configuration including print areas
export interface ProductConfig {
  blueprintId: number;
  printProviderId: number;
  productName: string;

  // Selected color
  color: {
    name: string;
    hex: string;
    variantIds: number[];
  };

  // Selected size (affects print area dimensions)
  size: string;

  // Print area for the selected position
  printArea: {
    position: "front" | "back" | "left_sleeve" | "right_sleeve" | "neck";
    width: number;
    height: number;
  };
}

// Full canvas state combining product + design positioning
export interface CanvasState {
  product: ProductConfig;
  design: DesignState;
  artifactId: string | null;
  artifactUrl: string | null;
}

// Default centered design state
export const DEFAULT_DESIGN_STATE: DesignState = {
  x: 50,
  y: 50,
  scale: 1,
  rotation: 0,
  lockAspectRatio: true,
};

// Default product config (Bella+Canvas 3001)
export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  blueprintId: 12,
  printProviderId: 99,
  productName: "Bella+Canvas 3001",
  color: {
    name: "White",
    hex: "#FFFFFF",
    variantIds: [],
  },
  size: "M",
  printArea: {
    position: "front",
    width: 3591,
    height: 4364,
  },
};

// Apply a position command to the design state
export function applyPositionCommand(
  state: DesignState,
  command: {
    action: "move" | "scale" | "rotate" | "reset" | "center";
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    preset?: "center" | "top" | "bottom" | "left" | "right" | "fill" | "fit";
  }
): DesignState {
  const newState = { ...state };

  // Handle presets first
  if (command.preset) {
    switch (command.preset) {
      case "center":
        newState.x = 50;
        newState.y = 50;
        break;
      case "top":
        newState.y = 25;
        break;
      case "bottom":
        newState.y = 75;
        break;
      case "left":
        newState.x = 30;
        break;
      case "right":
        newState.x = 70;
        break;
      case "fill":
        newState.scale = Math.min(state.scale * 1.5, 2);
        newState.x = 50;
        newState.y = 50;
        break;
      case "fit":
        newState.scale = Math.max(state.scale * 0.8, 0.3);
        newState.x = 50;
        newState.y = 50;
        break;
    }
  }

  // Handle specific actions
  switch (command.action) {
    case "move":
      if (command.x !== undefined) newState.x = clamp(command.x, 0, 100);
      if (command.y !== undefined) newState.y = clamp(command.y, 0, 100);
      break;
    case "scale":
      if (command.scale !== undefined) {
        // Apply as multiplier to current scale
        newState.scale = clamp(state.scale * command.scale, 0.1, 3);
      }
      break;
    case "rotate":
      if (command.rotation !== undefined) {
        newState.rotation = (state.rotation + command.rotation) % 360;
      }
      break;
    case "reset":
      return { ...DEFAULT_DESIGN_STATE };
    case "center":
      newState.x = 50;
      newState.y = 50;
      break;
  }

  return newState;
}

// Clamp a value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Convert design state to CSS transform for preview
export function designStateToTransform(state: DesignState): string {
  const translateX = (state.x - 50);
  const translateY = (state.y - 50);

  return `translate(${translateX}%, ${translateY}%) scale(${state.scale}) rotate(${state.rotation}deg)`;
}

// Serialize canvas state for storage/API
export function serializeCanvasState(state: CanvasState): string {
  return JSON.stringify(state);
}

// Deserialize canvas state from storage/API
export function deserializeCanvasState(json: string): CanvasState | null {
  try {
    const parsed = JSON.parse(json);
    // Validate required fields
    if (parsed.product && parsed.design) {
      return parsed as CanvasState;
    }
    return null;
  } catch {
    return null;
  }
}

// --- Multi-layer / multi-side types ---

export interface Layer {
  id: string;
  artifactId: string;
  designState: DesignState;
  zIndex: number;
}

export interface MultiSideDesignState {
  version: 2;
  activeSide: "front" | "back";
  front: Layer[];
  back: Layer[];
}

const MAX_LAYERS_PER_SIDE = 3;

export const DEFAULT_MULTI_STATE: MultiSideDesignState = {
  version: 2,
  activeSide: "front",
  front: [],
  back: [],
};

/**
 * Detect old single-design format and wrap it in v2 multi-layer structure.
 * If the data is already v2, return as-is.
 * If null/undefined, return an empty v2 state.
 */
export function migrateDesignState(raw: unknown): MultiSideDesignState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MULTI_STATE, front: [], back: [] };
  }

  const obj = raw as Record<string, unknown>;

  // Already v2
  if (obj.version === 2 && Array.isArray(obj.front) && Array.isArray(obj.back)) {
    return obj as unknown as MultiSideDesignState;
  }

  // Old single-design format: { x, y, scale, rotation, ... }
  if (typeof obj.x === "number" && typeof obj.y === "number") {
    const legacyState: DesignState = {
      x: obj.x as number,
      y: obj.y as number,
      scale: (obj.scale as number) ?? 1,
      rotation: (obj.rotation as number) ?? 0,
      lockAspectRatio: (obj.lockAspectRatio as boolean) ?? true,
    };
    return {
      version: 2,
      activeSide: "front",
      front: [
        {
          id: nanoid(8),
          artifactId: "", // caller fills this from latestArtifact
          designState: legacyState,
          zIndex: 0,
        },
      ],
      back: [],
    };
  }

  return { ...DEFAULT_MULTI_STATE, front: [], back: [] };
}

/** Add a new layer to a side. Returns unchanged state if at max capacity. */
export function addLayerToSide(
  state: MultiSideDesignState,
  side: "front" | "back",
  artifactId: string
): MultiSideDesignState {
  const layers = state[side];
  if (layers.length >= MAX_LAYERS_PER_SIDE) return state;

  const maxZ = layers.reduce((max, l) => Math.max(max, l.zIndex), -1);
  const newLayer: Layer = {
    id: nanoid(8),
    artifactId,
    designState: { ...DEFAULT_DESIGN_STATE },
    zIndex: maxZ + 1,
  };

  return { ...state, [side]: [...layers, newLayer] };
}

/** Remove a layer by ID. */
export function removeLayerFromSide(
  state: MultiSideDesignState,
  side: "front" | "back",
  layerId: string
): MultiSideDesignState {
  return { ...state, [side]: state[side].filter((l) => l.id !== layerId) };
}

/** Update a specific layer's designState. */
export function updateLayerDesignState(
  state: MultiSideDesignState,
  side: "front" | "back",
  layerId: string,
  designState: DesignState
): MultiSideDesignState {
  return {
    ...state,
    [side]: state[side].map((l) =>
      l.id === layerId ? { ...l, designState } : l
    ),
  };
}

/** Get all unique artifact IDs across both sides. */
export function getAllArtifactIds(state: MultiSideDesignState): string[] {
  const ids = new Set<string>();
  for (const l of [...state.front, ...state.back]) {
    if (l.artifactId) ids.add(l.artifactId);
  }
  return Array.from(ids);
}

// Calculate the actual pixel dimensions for the design on the canvas
export function calculateDesignBounds(
  designState: DesignState,
  printArea: { width: number; height: number },
  imageAspectRatio: number = 1
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  // Base size: fit the design within 80% of the print area
  const maxWidth = printArea.width * 0.8;
  const maxHeight = printArea.height * 0.8;

  let width: number;
  let height: number;

  if (imageAspectRatio > maxWidth / maxHeight) {
    // Image is wider than the area
    width = maxWidth;
    height = width / imageAspectRatio;
  } else {
    // Image is taller than the area
    height = maxHeight;
    width = height * imageAspectRatio;
  }

  // Apply scale
  width *= designState.scale;
  height *= designState.scale;

  // Calculate position (x, y are center points as percentages)
  const x = (designState.x / 100) * printArea.width - width / 2;
  const y = (designState.y / 100) * printArea.height - height / 2;

  return { x, y, width, height };
}
