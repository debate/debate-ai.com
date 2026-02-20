declare module 'react-spreadsheet-grid' {
    import { ComponentType, ReactElement } from 'react';

    export interface Column {
        id?: string | number;
        title: string | (() => ReactElement);
        value: (row: any, state: { active: boolean; focus: boolean; disabled: boolean }) => ReactElement | string;
        width?: number;
        getCellClassName?: (row: any) => string;
    }

    export interface GridProps {
        columns: any[];
        rows: any[];
        getRowKey: (row: any) => string | number;
        placeholder?: string;
        disabledCellChecker?: (row: any, columnId: string | number) => boolean;
        onCellClick?: (row: any, columnId: string | number) => void;
        onActiveCellChanged?: (coords: { x: number; y: number }) => void;
        headerHeight?: number;
        rowHeight?: number;
        focusOnSingleClick?: boolean;
        isColumnsResizable?: boolean;
        onColumnResize?: (widthValues: any) => void;
        isScrollable?: boolean;
        onScroll?: (scrollPosition: number) => void;
        onScrollReachesBottom?: () => void;
        className?: string;
        style?: React.CSSProperties;
    }

    export const Grid: ComponentType<GridProps>;

    export interface InputProps {
        value: string;
        placeholder?: string;
        focus?: boolean;
        selectTextOnFocus?: boolean;
        onChange?: (value: string) => void;
        className?: string;
    }

    export const Input: ComponentType<InputProps>;

    export interface SelectProps {
        items: { id: string | number; name: string }[];
        selectedId: string | number;
        placeholder?: string;
        isOpen?: boolean;
        onChange?: (value: any) => void;
        className?: string;
    }

    export const Select: ComponentType<SelectProps>;
}

declare module '*.mp3' {
    const src: string;
    export default src;
}

declare module 'turndown' {
    interface TurndownService {
        turndown(html: string): string;
        use(plugin: any): TurndownService;
        addRule(key: string, rule: any): TurndownService;
        keep(filter: string | string[] | ((node: Node, options: any) => boolean)): TurndownService;
        remove(filter: string | string[] | ((node: Node, options: any) => boolean)): TurndownService;
    }

    interface TurndownServiceConstructor {
        new (options?: any): TurndownService;
    }

    const TurndownService: TurndownServiceConstructor;
    export default TurndownService;
}

declare module 'turndown-plugin-gfm' {
    export const gfm: any;
    export const strikethrough: any;
    export const tables: any;
    export const taskListItems: any;
}
