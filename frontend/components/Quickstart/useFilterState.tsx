import { useState } from "react";

export type UseFilterStateProps<T> = {
  defaultValue: T | undefined;
  onSubmit?: (value: T) => void;
};

export function useFilterState<T>(props: UseFilterStateProps<T>) {
  const { defaultValue, onSubmit } = props;
  const [state, setState] = useState(defaultValue);
  return {
    canCancel: defaultValue !== state,
    value: state,
    onChange: setState,
    onReset() {
      setState(defaultValue);
    },
    onSubmit() {
      onSubmit?.(state as T);
    },
  };
}
