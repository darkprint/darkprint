// Browser stand-in for `next/image`, aliased in .design-sync/tsconfig.sync.json.
// next/image rewrites src through the Next optimizer route, which does not exist
// outside a running app; a plain img keeps the picture and drops the rewrite.
import * as React from "react";

type ImageProps = Omit<React.ComponentPropsWithoutRef<"img">, "src"> & {
  src: string | { src: string };
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  loader?: unknown;
  unoptimized?: boolean;
};

export function Image({ src, priority, quality, fill, placeholder, blurDataURL, loader, unoptimized, style, ...rest }: ImageProps) {
  const url = typeof src === "string" ? src : src?.src;
  const fillStyle: React.CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
    : style;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} style={fillStyle} {...rest} />;
}

export default Image;
