export function bytesFromPrisma(data: Buffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array
    ? data
    : new Uint8Array(
        (data as Buffer).buffer,
        (data as Buffer).byteOffset,
        (data as Buffer).byteLength
      );
}
