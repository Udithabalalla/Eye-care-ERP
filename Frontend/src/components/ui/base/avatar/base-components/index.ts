import { createElement } from "react";
import { Check } from "@untitledui/icons";

export { AvatarAddButton } from "./avatar-add-button";
export { AvatarCompanyIcon } from "./avatar-company-icon";
export { AvatarOnlineIndicator } from "./avatar-online-indicator";

type VerifiedTickSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const sizes: Record<VerifiedTickSize, string> = {
    xs: "size-4",
    sm: "size-5",
    md: "size-6",
    lg: "size-7",
    xl: "size-8",
    "2xl": "size-9",
    "3xl": "size-10",
    "4xl": "size-11",
};

interface VerifiedTickProps {
    size: VerifiedTickSize;
    className?: string;
}

export const VerifiedTick = ({ size, className }: VerifiedTickProps) =>
    createElement(
        "span",
        { className: "absolute right-0 bottom-0 rounded-full bg-brand-600 text-white ring-[1.5px] ring-bg-primary" },
        createElement(Check, { className: className ? `${sizes[size]} ${className}` : sizes[size] }),
    );