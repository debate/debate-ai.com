/**
 * @fileoverview Multi-select dropdown component for selecting multiple options.
 * Wraps functional logic around the DropdownMenu component.
 */

"use client"


import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface MultiSelectOption {
    value: string
    label: string
}

interface MultiSelectProps {
    options: MultiSelectOption[]
    selected: string[]
    onChange: (value: string[]) => void
    placeholder?: string
    label?: string
    className?: string
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select items",
    label,
    className,
}: MultiSelectProps) {
    const handleToggle = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter((item) => item !== value)
            : [...selected, value]
        onChange(newSelected)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-between h-8 text-xs font-normal", className)}
                >
                    <span className="truncate">
                        {selected.length > 0
                            ? `${placeholder} (${selected.length})`
                            : placeholder}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
                {label && (
                    <>
                        <DropdownMenuLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {label}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                    </>
                )}
                {options.map((option) => (
                    <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selected.includes(option.value)}
                        onCheckedChange={() => handleToggle(option.value)}
                        className="text-xs"
                        onSelect={(e) => e.preventDefault()} // Prevent closing on selection
                    >
                        {option.label}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
