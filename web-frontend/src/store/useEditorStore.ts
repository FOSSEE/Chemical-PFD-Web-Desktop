// src/store/useEditorStore.ts
import { create } from "zustand";
import {
  ComponentItem,
  CanvasItem,
  Connection,
  CanvasState,
} from "../components/Canvas/types";

// 1. Define what a "History Snapshot" looks like
// We only save the data, not the history arrays themselves
type EditorSnapshot = Pick<CanvasState, "items" | "connections" | "counts" | "sequenceCounter">;

// 2. Extend the stored editor state to include history buffers
interface EditorStateWithHistory extends CanvasState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

/** Global store shape **/
interface EditorStore {
  // The value is now the extended state with history
  editors: Record<string, EditorStateWithHistory>;

  // Lifecycle
  initEditor: (editorId: string, initial?: Partial<CanvasState>) => void;
  removeEditor: (editorId: string) => void;

  // --- HISTORY ACTIONS (Ported from useHistory) ---
  undo: (editorId: string) => void;
  redo: (editorId: string) => void;
  clearHistory: (editorId: string) => void;
  // helper to check status in UI
  canUndo: (editorId: string) => boolean;
  canRedo: (editorId: string) => boolean;

  // --- ITEM OPS ---
  addItem: (
    editorId: string,
    component: Omit<ComponentItem, "id">,
    opts?: Partial<Pick<CanvasItem, "x" | "y" | "width" | "height" | "rotation">>
  ) => CanvasItem | undefined;

  updateItem: (
    editorId: string,
    itemId: number,
    patch: Partial<CanvasItem>
  ) => void;
  
  deleteItem: (editorId: string, itemId: number) => void;

  // --- CONNECTION OPS ---
  addConnection: (editorId: string, conn: Omit<Connection, "id">) => Connection;
  updateConnection: (
    editorId: string,
    connectionId: number,
    patch: Partial<Connection>
  ) => void;
  removeConnection: (editorId: string, connectionId: number) => void;

  // --- BATCH OPS ---
  batchUpdateItems: (
    editorId: string,
    updates: { id: number; patch: Partial<CanvasItem> }[]
  ) => void;
  batchDeleteItems: (editorId: string, itemIds: number[]) => void;
  batchRemoveConnections: (editorId: string, connectionIds: number[]) => void;

  // --- HELPERS ---
  getEditorState: (editorId: string) => EditorStateWithHistory | undefined;
  getItemsInOrder: (editorId: string) => CanvasItem[];
  resetCounts: (editorId: string) => void;
  hydrateEditor: (editorId: string, state: CanvasState) => void;
  exportEditorJSON: (editorId: string) => any;
  updateCanvasState: (editorId: string, state: CanvasState) => void;
}

function padCount(n: number) {
  return n.toString().padStart(2, "0");
}

let globalIdCounter = Date.now();

// --- INTERNAL HELPER ---
// Creates a snapshot of the *current* state before a mutation occurs.
// This is equivalent to the `prev` argument in the useHistory hook.
const createSnapshot = (state: EditorStateWithHistory): EditorSnapshot => ({
  items: state.items,
  connections: state.connections,
  counts: state.counts,
  sequenceCounter: state.sequenceCounter,
});

export const useEditorStore = create<EditorStore>((set, get) => ({
  editors: {},

  initEditor: (editorId, initial = {}) =>
    set((s) => {
      if (s.editors[editorId]) return s;

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            items: initial.items || [],
            connections: initial.connections || [],
            counts: initial.counts || {},
            sequenceCounter: initial.sequenceCounter || 0,
            // Initialize history arrays
            past: [],
            future: [],
          },
        },
      };
    }),

  removeEditor: (editorId) =>
    set((s) => {
      const next = { ...s.editors };
      delete next[editorId];
      return { editors: next };
    }),

  // =========================================
  // HISTORY IMPLEMENTATION
  // =========================================

  undo: (editorId) =>
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed || ed.past.length === 0) return s;

      const previous = ed.past[ed.past.length - 1]; // The state we go back to
      const newPast = ed.past.slice(0, ed.past.length - 1);
      
      const currentSnapshot = createSnapshot(ed); // Save where we are now to future

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            ...previous, // Restore data
            past: newPast,
            future: [currentSnapshot, ...ed.future], // Push current to future
          },
        },
      };
    }),

  redo: (editorId) =>
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed || ed.future.length === 0) return s;

      const next = ed.future[0]; // The state we go forward to
      const newFuture = ed.future.slice(1);

      const currentSnapshot = createSnapshot(ed); // Save where we are now to past

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            ...next, // Restore data
            past: [...ed.past, currentSnapshot], // Push current to past
            future: newFuture,
          },
        },
      };
    }),

  clearHistory: (editorId) =>
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;
      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            past: [],
            future: [],
          },
        },
      };
    }),

  canUndo: (editorId) => {
    const ed = get().editors[editorId];
    return ed ? ed.past.length > 0 : false;
  },

  canRedo: (editorId) => {
    const ed = get().editors[editorId];
    return ed ? ed.future.length > 0 : false;
  },

  // =========================================
  // DATA MUTATIONS (with automatic history)
  // =========================================

  addItem: (editorId, component, opts = {}) => {
    const s = get();
    const editor = s.editors[editorId];
    if (!editor) return undefined;

    // --- 1. RECORD HISTORY ---
    // Save the state BEFORE adding the item to 'past', and clear 'future'
    const snapshot = createSnapshot(editor);
    const newPast = [...editor.past, snapshot];
    // -------------------------

    const key = component.object?.trim() || component.name.trim();
    const currentCount = editor.counts[key] ?? 0;
    const nextCount = currentCount + 1;
    const legend = component.legend ?? "";
    const suffix = component.suffix ?? "";
    const label = `${legend}-${padCount(nextCount)}${suffix ? `-${suffix}` : ""}`;

    const id = ++globalIdCounter;
    const seq = (editor.sequenceCounter ?? 0) + 1;

    const newItem: CanvasItem = {
      id,
      name: component.name,
      icon: component.icon || "",
      svg: component.svg || "",
      class: component.class || "",
      object: component.object || component.name,
      args: component.args || [],
      objectKey: key,
      label,
      legend,
      suffix,
      description: component.description ?? "",
      png: component.png,
      grips: component.grips,
      x: typeof opts.x === "number" ? opts.x : 100,
      y: typeof opts.y === "number" ? opts.y : 100,
      width: typeof opts.width === "number" ? opts.width : 80,
      height: typeof opts.height === "number" ? opts.height : 40,
      rotation: typeof opts.rotation === "number" ? opts.rotation : 0,
      sequence: seq,
      addedAt: Date.now(),
      isCustom: component.isCustom,
    };

    set((state) => ({
      editors: {
        ...state.editors,
        [editorId]: {
          ...state.editors[editorId], // keep existing props
          items: [...state.editors[editorId].items, newItem],
          counts: {
            ...state.editors[editorId].counts,
            [key]: nextCount,
          },
          sequenceCounter: seq,
          // Update History Refs
          past: newPast,
          future: [], // New action clears the future
        },
      },
    }));

    return newItem;
  },

  updateItem: (editorId, itemId, patch) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.map((it) =>
              it.id === itemId ? { ...it, ...patch } : it
            ),
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  deleteItem: (editorId, itemId) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      const filteredConnections = ed.connections.filter(
        (conn) => conn.sourceItemId !== itemId && conn.targetItemId !== itemId
      );

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.filter((it) => it.id !== itemId),
            connections: filteredConnections,
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  addConnection: (editorId, conn) => {
    const id = ++globalIdCounter;
    const newConnection: Connection = { id, ...conn };

    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s; // Safety check

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: [...ed.connections, newConnection],
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });

    return newConnection;
  },

  updateConnection: (editorId, connectionId, patch) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.map((conn) =>
              conn.id === connectionId ? { ...conn, ...patch } : conn
            ),
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  removeConnection: (editorId, connectionId) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.filter((c) => c.id !== connectionId),
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  batchUpdateItems: (editorId, updates) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      const nextItems = [...ed.items];
      updates.forEach(({ id, patch }) => {
        const index = nextItems.findIndex((it) => it.id === id);
        if (index !== -1) {
          nextItems[index] = { ...nextItems[index], ...patch };
        }
      });

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: nextItems,
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  batchDeleteItems: (editorId, itemIds) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      const idsSet = new Set(itemIds);
      const filteredConnections = ed.connections.filter(
        (conn) => !idsSet.has(conn.sourceItemId) && !idsSet.has(conn.targetItemId)
      );

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            items: ed.items.filter((it) => !idsSet.has(it.id)),
            connections: filteredConnections,
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  batchRemoveConnections: (editorId, connectionIds) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;

      // --- RECORD HISTORY ---
      const snapshot = createSnapshot(ed);
      // ----------------------

      const idsSet = new Set(connectionIds);

      return {
        editors: {
          ...s.editors,
          [editorId]: {
            ...ed,
            connections: ed.connections.filter((c) => !idsSet.has(c.id)),
            past: [...ed.past, snapshot],
            future: [],
          },
        },
      };
    });
  },

  // Note: resetCounts is usually a non-visual op, but we might want history
  resetCounts: (editorId) => {
    set((s) => {
      const ed = s.editors[editorId];
      if (!ed) return s;
      
      // Optional: Do we want undo capability for resetting counts? 
      // Assuming yes for consistency:
      const snapshot = createSnapshot(ed);

      return {
        editors: {
          ...s.editors,
          [editorId]: { 
            ...ed, 
            counts: {},
            past: [...ed.past, snapshot],
            future: []
          },
        },
      };
    });
  },

  // Note: hydration usually shouldn't trigger history (it's a load event)
  hydrateEditor: (editorId, state) =>
    set((s) => ({
      editors: {
        ...s.editors,
        [editorId]: {
            ...state,
            past: [], // Reset history on load
            future: []
        },
      },
    })),

  updateCanvasState: (editorId, state) => {
    set((s) => {
        // If this is a bulk update, we might want to history track it
        const ed = s.editors[editorId];
        // If editor exists, save history
        const newPast = ed ? [...ed.past, createSnapshot(ed)] : [];

        return {
            editors: {
                ...s.editors,
                [editorId]: {
                    ...state,
                    past: newPast,
                    future: []
                },
            },
        }
    });
  },

  getEditorState: (editorId) => get().editors[editorId],

  getItemsInOrder: (editorId) => {
    const ed = get().editors[editorId];
    if (!ed) return [];
    return [...ed.items].sort((a, b) => a.sequence - b.sequence);
  },

  exportEditorJSON: (editorId) => {
    const ed = get().editors[editorId];
    // We usually exclude past/future from exports
    if (!ed) return null;
    const { past, future, ...data } = ed;
    return JSON.parse(JSON.stringify(data));
  },
}));