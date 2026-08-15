export const IMAGE_STORAGE_ADAPTER = Symbol('IMAGE_STORAGE_ADAPTER');

export type ImageUploadOptions = {
  /** Storage folder / prefix, e.g. users/{id} or products/{id} */
  folder?: string;
};

export type ImageUploadResult = {
  url: string;
  publicId: string;
};

export abstract class ImageStorageAdapter {
  abstract upload(
    file: Buffer,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult>;

  abstract delete(publicId: string): Promise<void>;
}
