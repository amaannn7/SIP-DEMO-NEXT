import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Levata mark (leaf + flag glyph in a violet/blue gradient square), rendered
 * directly with no backing plate. Its "leaf" and flag-notch shapes are genuine
 * transparent cutouts in the source art, so on a dark surface they show the
 * surface through rather than staying white — accepted tradeoff per request,
 * rather than covering it with a plate.
 */
export function BrandMark({
  size = 36,
  className,
  alt = "Levata",
}: {
  size?: number;
  className?: string;
  /** Org display name, for orgs whose branding_config sets a custom companyName — the mark art itself stays fixed. */
  alt?: string;
}) {
  return (
    <Image
      src="/brand/levata-mark.png"
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      priority
    />
  );
}

/**
 * The full "Levata" wordmark lockup (mark + name), for auth screens where
 * there's room to read it. The "Levata" text is baked into the source art as
 * solid pixels — a `-dark` variant with that text recolored white ships
 * alongside it for dark mode, since CSS can't selectively invert only the text
 * pixels of a flat image without also touching the gradient mark.
 */
export function BrandWordmark({
  height = 32,
  className,
  alt = "Levata",
}: {
  height?: number;
  className?: string;
  /** Org display name, for orgs whose branding_config sets a custom companyName — the wordmark art itself stays fixed. */
  alt?: string;
}) {
  const width = Math.round(height * (829 / 253));
  return (
    <>
      <Image
        src="/brand/levata-logo.png"
        alt={alt}
        width={width}
        height={height}
        className={cn("h-auto dark:hidden", className)}
        style={{ height }}
        priority
      />
      <Image
        src="/brand/levata-logo-dark.png"
        alt={alt}
        width={width}
        height={height}
        className={cn("hidden h-auto dark:block", className)}
        style={{ height }}
        priority
      />
    </>
  );
}
