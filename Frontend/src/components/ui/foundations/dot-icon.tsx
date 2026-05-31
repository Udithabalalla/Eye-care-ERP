import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";

interface DotProps extends HTMLAttributes<HTMLSpanElement> {
    size?: "sm" | "md";
}

export const Dot = ({ size = "md", className, ...props }: DotProps) => (
    <span
        aria-hidden="true"
        {...props}
        className={cx(
            "inline-block rounded-full bg-current",
            size === "sm" ? "size-1.5" : "size-2",
            className,
        )}
    />
);