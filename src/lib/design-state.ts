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
