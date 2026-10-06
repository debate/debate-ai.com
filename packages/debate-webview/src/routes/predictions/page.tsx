import { PredictionMarketsPanel } from "../../components/predictions/PredictionMarketsPanel"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * Prediction Markets: bet play-money points on who wins a debate, who wins a
 * tournament, and whose team rating goes up. Every account starts with
 * 1,000 points; prices come from an automated market maker (LMSR) in
 * `debate-predictions`, and every market-settled notification links here.
 */
export default function PredictionMarketsPage() {
  return (
    <ToolPage>
      <ToolPageHeader href="/practice/predictions" backHref="/practice" backLabel="practice" guide="practice-tools" />
      <PredictionMarketsPanel />
    </ToolPage>
  )
}
