export const IMAGE_STORAGE_ADAPTER = Symbol('IMAGE_STORAGE_ADAPTER');

export type ImageDeliveryVariant = 'avatar' | 'product' | 'default';

export type ImageUploadOptions = {
  /** Storage folder / prefix, e.g. users/{id} or products/{id} */
  folder?: string;
  /** Controls delivery URL transforms (f_auto/q_auto, avatar crop, etc.) */
  variant?: ImageDeliveryVariant;
};

export type ImageUploadResult = {
  /** Optimized delivery URL (not necessarily the raw original) */
  url: string;
  publicId: string;
};

export abstract class ImageStorageAdapter {
  abstract upload(
    file: Buffer,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult>;

  abstract delete(publicId: string): Promise<void>;

  /** Build a CDN delivery URL from a stored publicId */
  abstract getDeliveryUrl(
    publicId: string,
    variant?: ImageDeliveryVariant,
  ): string;
}
