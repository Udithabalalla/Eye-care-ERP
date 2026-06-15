import type { ReactNode } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import {
	Tooltip as TooltipPrimitive,
	TooltipContent as TooltipPrimitiveContent,
	TooltipProvider as TooltipPrimitiveProvider,
	TooltipTrigger as TooltipPrimitiveTrigger,
} from "../../tooltip";

export { TooltipPrimitiveContent as TooltipContent, TooltipPrimitiveProvider as TooltipProvider };

interface TooltipProps {
	title: ReactNode;
	description?: ReactNode;
	placement?: "top" | "bottom" | "left" | "right";
	children: ReactNode;
}

export const Tooltip = ({ title, description, placement = "top", children }: TooltipProps) => (
	<TooltipPrimitiveProvider>
		<TooltipPrimitive>
			{children}
			<TooltipPrimitiveContent side={placement}>
				{title}
				{description ? <span>{description}</span> : null}
			</TooltipPrimitiveContent>
		</TooltipPrimitive>
	</TooltipPrimitiveProvider>
);

interface TooltipTriggerProps extends AriaButtonProps {
	isDisabled?: boolean;
	className?: string;
	children: ReactNode;
}

export const TooltipTrigger = ({ isDisabled, children, ...props }: TooltipTriggerProps) => (
	<TooltipPrimitiveTrigger asChild>
		<AriaButton isDisabled={isDisabled} {...props}>
			{children}
		</AriaButton>
	</TooltipPrimitiveTrigger>
);