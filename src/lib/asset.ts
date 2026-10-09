/** Prefix a public asset path with the build-time base path (GitHub Pages sub-directory). */
export const asset = (p: string): string => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
