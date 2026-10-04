import type { Ref } from "react";
import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";

import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = ({
  ref,
  className,
  activeClassName,
  pendingClassName,
  to,
  ...props
}: NavLinkCompatProps & { ref?: Ref<HTMLAnchorElement> }) => {
  return (
    <RouterNavLink
      ref={ref}
      to={to}
      className={({ isActive, isPending }) => cn(className, isActive && activeClassName, isPending && pendingClassName)}
      {...props}
    />
  );
};

NavLink.displayName = "NavLink";

export { NavLink };
