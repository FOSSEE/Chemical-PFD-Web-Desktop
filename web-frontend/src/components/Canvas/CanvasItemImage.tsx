import { useEffect, useRef } from "react";
import {
  Image as KonvaImage,
  Circle,
  Group,
  Text,
} from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { Rect } from "react-konva";

import { calculateAspectFit } from "../../utils/layout";

import { CanvasItem, CanvasItemImageProps } from "./types";

const LABEL_OFFSET = 4;

export const CanvasItemImage = ({
  item,
  isSelected,
  isInvalid,
  onSelect,
  onChange,
  onDragEnd,
  onGripMouseDown,
  onGripMouseEnter,
  onGripMouseLeave,
  isDrawingConnection = false,
  hoveredGrip = null,
}: CanvasItemImageProps) => {
  const [image] = useImage(item.svg || item.icon, "anonymous");

  const groupRef = useRef<Konva.Group>(null);


  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const updatedItem = {
      ...item,
      x: e.target.x(),
      y: e.target.y(),
    };

    onChange(updatedItem);
    onDragEnd?.(updatedItem);
  };



  const labelText = item.label || item.name;

  const labelX = item.x;
  const labelY = item.y + item.height + LABEL_OFFSET;

  // Calculate aspect-fit dimensions using shared helper
  const {
    x: renderX,
    y: renderY,
    width: renderWidth,
    height: renderHeight,
  } = calculateAspectFit(
    item.width,
    item.height,
    image?.naturalWidth || item.naturalWidth,
    image?.naturalHeight || item.naturalHeight,
  );

  // Sync natural dimensions to item state for routing
  useEffect(() => {
    if (
      image &&
      (image.naturalWidth !== item.naturalWidth ||
        image.naturalHeight !== item.naturalHeight)
    ) {
      onChange({
        ...item,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    }
  }, [image, item.naturalWidth, item.naturalHeight, onChange, item]);

  return (
    <>
      {/* ================= IMAGE (Selectable / Transformable) ================= */}
      <Group
        ref={groupRef}
        draggable
        height={item.height}
        rotation={item.rotation}
        scaleX={1}
        scaleY={1}
        width={item.width}
        x={item.x}
        y={item.y}
        onDragEnd={handleDragEnd}
      >
        {isInvalid && (
          <Rect
            dash={[6, 4]}
            height={item.height}
            stroke="red"
            strokeWidth={2}
            width={item.width}
          />
        )}
        <KonvaImage
          height={renderHeight}
          image={image || undefined}
          width={renderWidth}
          x={renderX}
          y={renderY}
          onClick={(e) => onSelect(e as any)}
          onTap={(e) => onSelect(e as any)}
        />
      </Group>

      {/* ================= LABEL (Visual Only, Behind Everything) ================= */}

      <Text
        align="center"
        fill="#374151"
        fontFamily="Arial, sans-serif"
        fontSize={12}
        listening={false}
        offsetX={(item.width + 100) / 2} // Center align
        text={labelText}
        width={item.width + 100} // Increase width to prevent wrapping
        x={labelX + item.width / 2}
        y={labelY + 2}
      />


      {/* ================= GRIPS (Always On Top) ================= */}
      {(isSelected || isDrawingConnection) &&
        item.grips?.map((grip, index) => {
          // Grips are positioned relative to the RENDERED image, not the container box
          const gripX = item.x + renderX + (grip.x / 100) * renderWidth;
          const gripY =
            item.y + renderY + ((100 - grip.y) / 100) * renderHeight;

          const isHovered =
            hoveredGrip?.itemId === item.id && hoveredGrip?.gripIndex === index;

          return (
            <Circle
              key={index}
              listening
              fill={isHovered ? "#22c55e" : "#3b82f6"}
              opacity={isDrawingConnection && !isSelected ? 0.7 : 1}
              radius={isDrawingConnection ? 6 : 5}
              stroke="#ffffff"
              strokeWidth={isHovered ? 3 : 2}
              x={gripX}
              y={gripY}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                onGripMouseDown?.(item.id, index, gripX, gripY);
              }}
              onMouseEnter={(e) => {
                onGripMouseEnter?.(item.id, index);
                e.target
                  .getStage()
                  ?.container()
                  .style.setProperty("cursor", "pointer");
              }}
              onMouseLeave={(e) => {
                onGripMouseLeave?.();
                e.target
                  .getStage()
                  ?.container()
                  .style.setProperty("cursor", "default");
              }}
            />
          );
        })}
    </>
  );
};
