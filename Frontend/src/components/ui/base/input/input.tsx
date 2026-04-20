import type { ReactNode, Ref } from "react";
import React, { isValidElement } from "react";
import type { InputProps as AriaInputProps, TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { Input as AriaInput, TextField as AriaTextField } from "react-aria-components";
import { HintText } from "@/components/ui/base/input/hint-text";
import { Label } from "@/components/ui/base/input/label";
import { isReactComponent } from "@/utils/is-react-component";
import { cx } from "@/utils/cx";

interface InputBaseProps extends AriaInputProps {
    ref?: Ref<HTMLInputElement>;
    iconLeading?: ReactNode | React.FC<{ className?: string }>;
    iconTrailing?: ReactNode | React.FC<{ className?: string }>;
}

export const InputBase = ({ className, iconLeading, iconTrailing, ...props }: InputBaseProps) => {
    const IconLeading = iconLeading;
    const IconTrailing = iconTrailing;

    return (
        <div className="relative w-full">
            {isValidElement(IconLeading) && (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    {IconLeading}
                </div>
            )}
            {isReactComponent(IconLeading) && (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <IconLeading className="size-5 text-fg-quaternary" />
                </div>
            )}
            <AriaInput
                {...props}
                className={(state) =>
                    cx(
                        "w-full rounded-lg bg-background py-2.5 text-md text-foreground shadow-xs ring-1 ring-secondary transition duration-100 ease-linear ring-inset placeholder:text-placeholder autofill:rounded-lg autofill:text-foreground focus:outline-hidden",

                        // Padding adjustments for icons
                        (isValidElement(IconLeading) || isReactComponent(IconLeading)) ? "pl-10" : "pl-3.5",
                        (isValidElement(IconTrailing) || isReactComponent(IconTrailing)) ? "pr-10" : "pr-3.5",

                        state.isFocused && !state.isDisabled && "ring-2 ring-brand",
                        state.isDisabled && "cursor-not-allowed bg-disabled_subtle text-disabled ring-disabled",
                        state.isInvalid && "ring-error_subtle",
                        state.isInvalid && state.isFocused && "ring-2 ring-error",

                        typeof className === "function" ? className(state) : className,
                    )
                }
            />
            {isValidElement(IconTrailing) && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    {IconTrailing}
                </div>
            )}
            {isReactComponent(IconTrailing) && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <IconTrailing className="size-5 text-fg-quaternary" />
                </div>
            )}
        </div>
    );
};

InputBase.displayName = "InputBase";

interface TextFieldProps extends AriaTextFieldProps {
    /** Label text for the input */
    label?: string;
    /** Helper text displayed below the input */
    hint?: ReactNode;
    /** Tooltip message displayed after the label. */
    tooltip?: string;
    /** Class name for the input wrapper */
    inputClassName?: InputBaseProps["className"];
    /** Ref for the input wrapper */
    ref?: Ref<HTMLDivElement>;
    /** Ref for the input */
    inputRef?: InputBaseProps["ref"];
    /** Whether to hide required indicator from label. */
    hideRequiredIndicator?: boolean;
    /** Placeholder text. */
    placeholder?: string;
    /** Icon component or element to show before the text */
    iconLeading?: InputBaseProps["iconLeading"];
    /** Icon component or element to show after the text */
    iconTrailing?: InputBaseProps["iconTrailing"];
}

export const Input = ({
    label,
    hint,
    tooltip,
    inputRef,
    hideRequiredIndicator,
    inputClassName,
    placeholder,
    className,
    iconLeading,
    iconTrailing,
    ...props
}: TextFieldProps) => {
    return (
        <AriaTextField
            {...props}
            className={(state) =>
                cx("group flex h-max w-full flex-col items-start justify-start gap-1.5", typeof className === "function" ? className(state) : className)
            }
        >
            {({ isInvalid, isRequired }) => (
                <>
                    {label && (
                        <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired} tooltip={tooltip}>
                            {label}
                        </Label>
                    )}

                    <InputBase
                        placeholder={placeholder}
                        className={inputClassName}
                        ref={inputRef}
                        iconLeading={iconLeading}
                        iconTrailing={iconTrailing}
                    />

                    {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                </>
            )}
        </AriaTextField>
    );
};

Input.displayName = "Input";

