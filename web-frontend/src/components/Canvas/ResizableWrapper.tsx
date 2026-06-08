import React from "react";
import { CanvasItem } from "./types";

interface ResizableWrapperProps {
  item: CanvasItem;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  stageScale: number;
  stagePos: {
    x: number;
    y: number;
  };
  otherItems: CanvasItem[];
  onResizeMove: (newBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  onResizeEnd: (finalBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  item,
  bounds,
  stageScale,
  stagePos,
  otherItems,
  onResizeMove,
  onResizeEnd,
}) => {
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = bounds.width;
    const startH = bounds.height;
    const startXPos = bounds.x;
    const startYPos = bounds.y;

    const calculateNewBounds = (clientX: number, clientY: number) => {
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      // Adjust delta by canvas zoom factor
      const logicalDeltaX = deltaX / stageScale;
      const logicalDeltaY = deltaY / stageScale;

      const min_size = 10.0;
      const aspect = startW / startH;

      let newW = startW;
      let newH = startH;
      let newX = startXPos;
      let newY = startYPos;

      if (["tl", "tr", "bl", "br"].includes(handle)) {
        let sx = 1;
        let sy = 1;
        if (handle === "bl" || handle === "tl") sx = -1;
        if (handle === "tr" || handle === "tl") sy = -1;

        const rawW = startW + sx * logicalDeltaX;
        const rawH = startH + sy * logicalDeltaY;

        const dw = rawW - startW;
        const dh = rawH - startH;

        // Dominant directional delta
        const widthDriver = Math.abs(dw) / startW >= Math.abs(dh) / startH;

        if (widthDriver) {
          newW = Math.max(min_size, rawW);
          newH = newW / aspect;
          if (newH < min_size) {
            newH = min_size;
            newW = newH * aspect;
          }
        } else {
          newH = Math.max(min_size, rawH);
          newW = newH * aspect;
          if (newW < min_size) {
            newW = min_size;
            newH = newW / aspect;
          }
        }

        // Anchor updates to prevent visual drift
        if (handle === "br") {
          newX = startXPos;
          newY = startYPos;
        } else if (handle === "bl") {
          newX = startXPos + startW - newW;
          newY = startYPos;
        } else if (handle === "tr") {
          newX = startXPos;
          newY = startYPos + startH - newH;
        } else if (handle === "tl") {
          newX = startXPos + startW - newW;
          newY = startYPos + startH - newH;
        }
      } else {
        // Mid-point independent stretching
        if (handle === "r") {
          newW = Math.max(min_size, startW + logicalDeltaX);
        } else if (handle === "l") {
          newW = Math.max(min_size, startW - logicalDeltaX);
          newX = startXPos + startW - newW;
        } else if (handle === "b") {
          newH = Math.max(min_size, startH + logicalDeltaY);
        } else if (handle === "t") {
          newH = Math.max(min_size, startH - logicalDeltaY);
          newY = startYPos + startH - newH;
        }
      }

      return { x: newX, y: newY, width: newW, height: newH };
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextBounds = calculateNewBounds(moveEvent.clientX, moveEvent.clientY);

      // Check collision/overlap with other items
      const hasCollision = otherItems.some((other) => {
        if (other.id === item.id) return false;
        return (
          nextBounds.x < other.x + other.width &&
          nextBounds.x + nextBounds.width > other.x &&
          nextBounds.y < other.y + other.height &&
          nextBounds.y + nextBounds.height > other.y
        );
      });

      if (!hasCollision) {
        onResizeMove(nextBounds);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const nextBounds = calculateNewBounds(upEvent.clientX, upEvent.clientY);

      const hasCollision = otherItems.some((other) => {
        if (other.id === item.id) return false;
        return (
          nextBounds.x < other.x + other.width &&
          nextBounds.x + nextBounds.width > other.x &&
          nextBounds.y < other.y + other.height &&
          nextBounds.y + nextBounds.height > other.y
        );
      });

      if (!hasCollision) {
        onResizeEnd(nextBounds);
      } else {
        // Fallback: keep previous bounds on cancel/collision release
        onResizeEnd({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDetails = [
    { name: "tl", cursor: "cursor-nwse-resize", style: { left: 0, top: 0 } },
    { name: "t", cursor: "cursor-ns-resize", style: { left: "50%", top: 0 } },
    { name: "tr", cursor: "cursor-nesw-resize", style: { left: "100%", top: 0 } },
    { name: "r", cursor: "cursor-ew-resize", style: { left: "100%", top: "50%" } },
    { name: "br", cursor: "cursor-nwse-resize", style: { left: "100%", top: "100%" } },
    { name: "b", cursor: "cursor-ns-resize", style: { left: "50%", top: "100%" } },
    { name: "bl", cursor: "cursor-nesw-resize", style: { left: 0, top: "100%" } },
    { name: "l", cursor: "cursor-ew-resize", style: { left: 0, top: "50%" } },
  ];

  return (
    <div
      className="absolute border border-blue-500 pointer-events-none"
      style={{
        left: bounds.x * stageScale + stagePos.x,
        top: bounds.y * stageScale + stagePos.y,
        width: bounds.width * stageScale,
        height: bounds.height * stageScale,
        transform: `rotate(${item.rotation || 0}deg)`,
        transformOrigin: "top left",
        zIndex: 50,
      }}
    >
      {handleDetails.map((h) => (
        <div
          key={h.name}
          data-testid={`handle-${h.name}`}
          className={`absolute w-2.5 h-2.5 bg-white border border-blue-600 shadow-sm hover:bg-blue-50 transition-colors pointer-events-auto ${h.cursor}`}
          style={{
            ...h.style,
            transform: "translate(-50%, -50%)",
          }}
          onMouseDown={(e) => handleMouseDown(e, h.name)}
        />
      ))}
    </div>
  );
};
