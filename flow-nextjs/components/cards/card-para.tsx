"use client";

import { Para, Run } from "@/lib/types/card";
import { cn } from "@/lib/utils";

interface CardParaProps {
  para: Para;
  shrunk?: boolean;
  onUpdate?: (para: Para) => void;
  editable?: boolean;
}

export function CardPara({ para, shrunk = false, onUpdate, editable = false }: CardParaProps) {
  const renderRun = (run: Run, index: number) => {
    const className = cn(
      run.highlight && "bg-yellow-200 dark:bg-yellow-900",
      run.underline && "underline",
      !shrunk && run.highlight && "font-semibold"
    );

    return (
      <span key={index} className={className}>
        {run.text}
      </span>
    );
  };

  // In shrunk mode, only show highlighted/underlined text
  const displayPara = shrunk
    ? para.filter((run) => run.highlight || run.underline)
    : para;

  if (displayPara.length === 0 && shrunk) {
    return null;
  }

  return (
    <p className="leading-relaxed text-base">
      {displayPara.map((run, index) => renderRun(run, index))}
    </p>
  );
}
