import React from "react";

export function AnimatedCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md bg-background border border-border p-6 shadow-sm ${className} animate-float`}
    >
      {children}
    </div>
  );
}

export default AnimatedCard;
