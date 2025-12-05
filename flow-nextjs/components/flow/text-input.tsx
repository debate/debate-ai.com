"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  strikethrough?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export interface TextInputRef {
  focus: () => void;
  blur: () => void;
  element: HTMLTextAreaElement | null;
}

export const TextInput = forwardRef<TextInputRef, TextInputProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onFocus,
      onBlur,
      placeholder = "",
      strikethrough = false,
      className,
      autoFocus = false,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-height adjustment
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        // Remove line breaks
        textarea.value = textarea.value.replace(/\r?\n|\r/g, "");
        textarea.style.height = "0px";
        textarea.style.height = textarea.scrollHeight + "px";
      }
    };

    // Adjust height when value changes
    useEffect(() => {
      adjustHeight();
    }, [value]);

    // Auto-focus if requested
    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [autoFocus]);

    // Expose focus/blur methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      element: textareaRef.current,
    }));

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight();
        }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          "w-full resize-none outline-none overflow-hidden",
          "bg-transparent border-none p-0 m-0",
          "leading-[1.5em] min-h-[calc(1em+16px)]",
          "placeholder:text-muted-foreground",
          "focus:z-[10000]",
          strikethrough && "line-through",
          className
        )}
        style={{
          height: "auto",
        }}
      />
    );
  }
);

TextInput.displayName = "TextInput";
