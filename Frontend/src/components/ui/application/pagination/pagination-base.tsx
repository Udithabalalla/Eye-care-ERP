import type { ReactElement, ReactNode } from "react";
import React, { createContext, useContext } from "react";

export interface PaginationRootProps {
    page?: number;
    total?: number;
    className?: string;
    children: ReactNode;
    onPageChange?: (page: number) => void;
}

type PaginationPage =
    | { type: "page"; value: number; isCurrent: boolean }
    | { type: "ellipsis" };

interface PaginationContextValue {
    currentPage: number;
    total: number;
    pages: PaginationPage[];
    onPageChange?: (page: number) => void;
}

const PaginationContext = createContext<PaginationContextValue | null>(null);

const clampPage = (page: number, total: number) => Math.min(Math.max(page, 1), Math.max(total, 1));

const buildPages = (currentPage: number, total: number): PaginationPage[] => {
    const safeTotal = Math.max(total, 1);

    if (safeTotal <= 7) {
        return Array.from({ length: safeTotal }, (_, index) => {
            const value = index + 1;
            return { type: "page", value, isCurrent: value === currentPage };
        });
    }

    const pages: PaginationPage[] = [{ type: "page", value: 1, isCurrent: currentPage === 1 }];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(safeTotal - 1, currentPage + 1);

    if (left > 2) {
        pages.push({ type: "ellipsis" });
    }

    for (let page = left; page <= right; page += 1) {
        pages.push({ type: "page", value: page, isCurrent: page === currentPage });
    }

    if (right < safeTotal - 1) {
        pages.push({ type: "ellipsis" });
    }

    pages.push({ type: "page", value: safeTotal, isCurrent: currentPage === safeTotal });
    return pages;
};

function Root({ page = 1, total = 1, children, onPageChange, className }: PaginationRootProps) {
    const currentPage = clampPage(page, total);

    return (
        <PaginationContext.Provider value={{ currentPage, total: Math.max(total, 1), pages: buildPages(currentPage, total), onPageChange }}>
            <div className={className}>{children}</div>
        </PaginationContext.Provider>
    );
}

function Context({ children }: { children: (context: PaginationContextValue) => ReactNode }) {
    const context = useContext(PaginationContext);

    if (!context) {
        return null;
    }

    return <>{children(context)}</>;
}

function mergeHandlers<Args extends unknown[]>(first?: (...args: Args) => void, second?: (...args: Args) => void) {
    return (...args: Args) => {
        first?.(...args);
        second?.(...args);
    };
}

function makeTrigger(direction: -1 | 1) {
    return function Trigger({ asChild, children, ...props }: { asChild?: boolean; children?: ReactNode; className?: string; onClick?: React.MouseEventHandler; disabled?: boolean; [key: string]: unknown }) {
        const context = useContext(PaginationContext);

        if (!context) {
            return asChild && React.isValidElement(children) ? children : null;
        }

        const handleClick: React.MouseEventHandler = (event) => {
            props.onClick?.(event);
            if (!event.defaultPrevented) {
                context.onPageChange?.(clampPage(context.currentPage + direction, context.total));
            }
        };

        if (asChild && React.isValidElement(children)) {
            const child = children as ReactElement<any>;
            const childProps = child.props as Record<string, any>;

            return React.cloneElement(child, {
                onClick: mergeHandlers(childProps.onClick, handleClick),
                disabled: props.disabled ?? childProps.disabled,
                "aria-disabled": props["aria-disabled"],
                className: props.className ? [childProps.className, props.className].filter(Boolean).join(" ") : childProps.className,
            } as any);
        }

        return (
            <button type="button" {...props} onClick={handleClick}>
                {children}
            </button>
        );
    };
}

const PrevTrigger = makeTrigger(-1);
const NextTrigger = makeTrigger(1);

function Item({ asChild, children, value, isCurrent, className, ...props }: { asChild?: boolean; children?: ReactNode; value: number; isCurrent?: boolean; className?: string | ((state: { isSelected: boolean }) => string); onClick?: React.MouseEventHandler; [key: string]: unknown }) {
    const context = useContext(PaginationContext);

    const resolvedClassName = typeof className === "function" ? className({ isSelected: Boolean(isCurrent) }) : className;
    const handleClick: React.MouseEventHandler = (event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
            context?.onPageChange?.(value);
        }
    };

    if (asChild && React.isValidElement(children)) {
        const child = children as ReactElement<any>;
        const childProps = child.props as Record<string, any>;

        return React.cloneElement(child, {
            onClick: mergeHandlers(childProps.onClick, handleClick),
            "aria-current": isCurrent ? "page" : undefined,
            className: [childProps.className, resolvedClassName].filter(Boolean).join(" "),
        } as any);
    }

    return (
        <button type="button" aria-current={isCurrent ? "page" : undefined} className={resolvedClassName} onClick={handleClick}>
            {children ?? value}
        </button>
    );
}

function Ellipsis({ children, className }: { children?: ReactNode; className?: string }) {
    return <span className={className}>{children ?? "…"}</span>;
}

export const Pagination = {
    Root,
    Context,
    PrevTrigger,
    NextTrigger,
    Item,
    Ellipsis,
};