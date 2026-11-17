export type CropTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function clampTransform(input: {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  transform: CropTransform;
}): CropTransform {
  'worklet';
  const imageWidth = input.imageWidth;
  const imageHeight = input.imageHeight;
  const viewport = input.viewport;
  const scale = Math.max(1, input.transform.scale);
  if (imageWidth <= 0 || imageHeight <= 0 || viewport <= 0) {
    return {
      scale,
      translateX: input.transform.translateX,
      translateY: input.transform.translateY,
    };
  }

  const baseScale = Math.max(viewport / imageWidth, viewport / imageHeight);
  const displayScale = baseScale * scale;
  const maxTx = Math.max(0, (imageWidth * displayScale - viewport) / 2);
  const maxTy = Math.max(0, (imageHeight * displayScale - viewport) / 2);

  return {
    scale,
    translateX: Math.min(maxTx, Math.max(-maxTx, input.transform.translateX)),
    translateY: Math.min(maxTy, Math.max(-maxTy, input.transform.translateY)),
  };
}

export function computeCropRect(input: {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  transform: CropTransform;
}): CropRect {
  const { imageWidth, imageHeight, viewport } = input;
  const transform = clampTransform(input);
  if (imageWidth <= 0 || imageHeight <= 0 || viewport <= 0) {
    return { originX: 0, originY: 0, width: 0, height: 0 };
  }

  const baseScale = Math.max(viewport / imageWidth, viewport / imageHeight);
  const displayScale = baseScale * transform.scale;
  const cropSize = Math.min(imageWidth, imageHeight, viewport / displayScale);
  const width = Math.max(1, Math.round(cropSize));
  const height = width;
  const originX = (imageWidth - cropSize) / 2 - transform.translateX / displayScale;
  const originY = (imageHeight - cropSize) / 2 - transform.translateY / displayScale;

  return {
    originX: Math.min(imageWidth - width, Math.max(0, Math.round(originX))),
    originY: Math.min(imageHeight - height, Math.max(0, Math.round(originY))),
    width,
    height,
  };
}
