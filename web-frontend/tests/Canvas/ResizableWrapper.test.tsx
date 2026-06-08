import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResizableWrapper } from "../../src/components/Canvas/ResizableWrapper";
import { CanvasItem } from "../../src/components/Canvas/types";

// Mock item for testing
const mockItem: CanvasItem = {
  id: 1,
  component_id: 101,
  name: "Pump",
  icon: "pump.svg",
  svg: "<svg></svg>",
  class: "Equipment",
  object: "Pump",
  args: [],
  x: 100,
  y: 100,
  width: 100,
  height: 100,
  rotation: 0,
  sequence: 1,
  addedAt: Date.now(),
};

describe("ResizableWrapper Component Resizing Engine", () => {
  it("test_resize_r_stretches_width_only", () => {
    const onResizeMove = vi.fn();
    const onResizeEnd = vi.fn();

    render(
      <ResizableWrapper
        item={mockItem}
        bounds={mockItem}
        stageScale={1}
        stagePos={{ x: 0, y: 0 }}
        otherItems={[]}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handleR = screen.getByTestId("handle-r");
    expect(handleR).toBeDefined();

    // Start drag
    fireEvent.mouseDown(handleR, { clientX: 200, clientY: 150 });
    
    // Move drag (move 50px to the right)
    fireEvent.mouseMove(window, { clientX: 250, clientY: 150 });

    expect(onResizeMove).toHaveBeenCalled();
    const lastMoveCall = onResizeMove.mock.calls[onResizeMove.mock.calls.length - 1][0];
    
    // Width should increase by 50px (from 100 to 150)
    expect(lastMoveCall.width).toBe(150);
    // Height, x, y should stay static
    expect(lastMoveCall.height).toBe(100);
    expect(lastMoveCall.x).toBe(100);
    expect(lastMoveCall.y).toBe(100);

    // End drag
    fireEvent.mouseUp(window, { clientX: 250, clientY: 150 });
    expect(onResizeEnd).toHaveBeenCalledWith({
      x: 100,
      y: 100,
      width: 150,
      height: 100,
    });
  });

  it("test_resize_b_stretches_height_only", () => {
    const onResizeMove = vi.fn();
    const onResizeEnd = vi.fn();

    render(
      <ResizableWrapper
        item={mockItem}
        bounds={mockItem}
        stageScale={1}
        stagePos={{ x: 0, y: 0 }}
        otherItems={[]}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handleB = screen.getByTestId("handle-b");
    expect(handleB).toBeDefined();

    // Start drag
    fireEvent.mouseDown(handleB, { clientX: 150, clientY: 200 });
    
    // Move drag (move 40px down)
    fireEvent.mouseMove(window, { clientX: 150, clientY: 240 });

    expect(onResizeMove).toHaveBeenCalled();
    const lastMoveCall = onResizeMove.mock.calls[onResizeMove.mock.calls.length - 1][0];
    
    // Height should increase by 40px (from 100 to 140)
    expect(lastMoveCall.height).toBe(140);
    // Width, x, y should stay static
    expect(lastMoveCall.width).toBe(100);
    expect(lastMoveCall.x).toBe(100);
    expect(lastMoveCall.y).toBe(100);

    // End drag
    fireEvent.mouseUp(window, { clientX: 150, clientY: 240 });
    expect(onResizeEnd).toHaveBeenCalledWith({
      x: 100,
      y: 100,
      width: 100,
      height: 140,
    });
  });

  it("test_resize_blocks_overlap", () => {
    const onResizeMove = vi.fn();
    const onResizeEnd = vi.fn();

    const otherItems: CanvasItem[] = [
      {
        ...mockItem,
        id: 2,
        x: 220, // Clashing boundary if we expand too much
        y: 100,
        width: 50,
        height: 100,
      },
    ];

    render(
      <ResizableWrapper
        item={mockItem}
        bounds={mockItem}
        stageScale={1}
        stagePos={{ x: 0, y: 0 }}
        otherItems={otherItems}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handleR = screen.getByTestId("handle-r");

    // Start drag
    fireEvent.mouseDown(handleR, { clientX: 200, clientY: 150 });
    
    // Move drag (move 150px to the right, new width 250, overlapping with other item at x=220)
    fireEvent.mouseMove(window, { clientX: 350, clientY: 150 });

    // The resize move callback should NOT have been called with overlapping bounds
    expect(onResizeMove).not.toHaveBeenCalled();
  });

  it("test_resize_bound_clamping", () => {
    const onResizeMove = vi.fn();
    const onResizeEnd = vi.fn();

    render(
      <ResizableWrapper
        item={mockItem}
        bounds={mockItem}
        stageScale={1}
        stagePos={{ x: 0, y: 0 }}
        otherItems={[]}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handleR = screen.getByTestId("handle-r");

    // Start drag
    fireEvent.mouseDown(handleR, { clientX: 200, clientY: 150 });
    
    // Drag aggressively left (trying to shrink it below min_size of 10)
    fireEvent.mouseMove(window, { clientX: 50, clientY: 150 });

    expect(onResizeMove).toHaveBeenCalled();
    const lastMoveCall = onResizeMove.mock.calls[onResizeMove.mock.calls.length - 1][0];
    
    // Width should clamp to 10
    expect(lastMoveCall.width).toBe(10);
  });
});
