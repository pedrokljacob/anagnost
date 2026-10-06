import React from "react";
import { HandyKeysShortcutInput } from "./HandyKeysShortcutInput";

interface ShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

/**
 * Shortcut input for a binding. Recording always goes through the handy-keys
 * backend; the Rust `keyboard_implementation` setting only decides which
 * backend registers the shortcut.
 */
export const ShortcutInput: React.FC<ShortcutInputProps> = (props) => (
  <HandyKeysShortcutInput {...props} />
);
