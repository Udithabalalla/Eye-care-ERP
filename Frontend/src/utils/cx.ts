import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function sortCx<T extends Record<string, unknown>>(styles: T): T {
    return styles;
}