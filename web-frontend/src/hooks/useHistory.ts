import { useState, useCallback } from "react";

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

export function useHistory<T>(initialPresent: T) {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const undo = useCallback(() => {
        setState((currentState) => {
            if (currentState.past.length === 0) return currentState;

            const previous = currentState.past[currentState.past.length - 1];
            const newPast = currentState.past.slice(0, currentState.past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [currentState.present, ...currentState.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState((currentState) => {
            if (currentState.future.length === 0) return currentState;

            const next = currentState.future[0];
            const newFuture = currentState.future.slice(1);

            return {
                past: [...currentState.past, currentState.present],
                present: next,
                future: newFuture,
            };
        });
    }, []);

    const setHistory = useCallback((nextStateOrFunction: T | ((prev: T) => T)) => {
        setState((currentState) => {
            const newPresent = typeof nextStateOrFunction === 'function'
                ? (nextStateOrFunction as (prev: T) => T)(currentState.present)
                : nextStateOrFunction;

            if (currentState.present === newPresent) return currentState;

            return {
                past: [...currentState.past, currentState.present],
                present: newPresent,
                future: [],
            };
        });
    }, []);

    // Helper to reset history (e.g. loading new project)
    const clearHistory = useCallback((newPresent: T) => {
        setState({
            past: [],
            present: newPresent,
            future: []
        });
    }, []);

    return {
        state: state.present,
        set: setHistory,
        undo,
        redo,
        canUndo,
        canRedo,
        clear: clearHistory
    };
}
