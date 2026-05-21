/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from 'react';

interface RawImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
}

export function RawImage({ alt, ...props }: RawImageProps) {
  return <img {...props} alt={alt} />;
}
