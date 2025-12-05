"use client";

import { useState } from "react";
import { CardData } from "@/lib/types/card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CardPara } from "./card-para";
import { citationFormatters, generateMLACitation } from "@/lib/utils/citation";
import { Badge } from "@/components/ui/badge";
import { Copy, RotateCcw } from "lucide-react";

interface CardDisplayProps {
  card: CardData;
  onUpdate?: (card: CardData) => void;
  onReset?: () => void;
}

export function CardDisplay({ card, onUpdate, onReset }: CardDisplayProps) {
  const [shrunk, setShrunk] = useState(false);
  const [tag, setTag] = useState(card.tag);

  const handleCopy = async () => {
    const citation = generateMLACitation(card);
    const parasText = card.paras
      .map((para) =>
        para
          .filter((run) => (shrunk ? run.highlight || run.underline : true))
          .map((run) => run.text)
          .join("")
      )
      .join("\n\n");

    const fullText = `${tag}\n\n${citation}\n\n${parasText}`;
    await navigator.clipboard.writeText(fullText);
  };

  const bigAuthors = citationFormatters.bigAuthors.format(card);
  const bigDate = citationFormatters.bigDate.format(card);
  const authors = citationFormatters.authors.format(card);
  const title = citationFormatters.title.format(card);
  const siteName = citationFormatters.siteName.format(card);
  const date = citationFormatters.date.format(card);
  const url = citationFormatters.url.format(card);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Card
        </Button>
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Tag */}
          <div>
            <Textarea
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                onUpdate?.({ ...card, tag: e.target.value });
              }}
              placeholder="Type a one sentence summary..."
              className="text-lg font-bold min-h-[60px] resize-none"
            />
          </div>

          {/* Citation */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="text-lg font-bold">
              {bigAuthors} {bigDate}
            </div>
            <div className="text-sm leading-relaxed">
              {authors}. "{title}." <i>{siteName}</i>, {date}, {url}.
            </div>
          </div>

          {/* Paragraph Tools */}
          <div className="flex items-center gap-2 py-2 border-b">
            <Button
              variant={shrunk ? "default" : "outline"}
              size="sm"
              onClick={() => setShrunk(!shrunk)}
            >
              {shrunk ? "Show All" : "Show Highlighted"}
            </Button>
            <div className="flex-1" />
            <Badge variant="outline">
              {card.paras.length} paragraph{card.paras.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {/* Paragraphs */}
          <div className="space-y-4">
            {card.paras.map((para, index) => (
              <CardPara key={index} para={para} shrunk={shrunk} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
