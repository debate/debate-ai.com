/**
 * @fileoverview The prediction markets page: the board, featured markets,
 * the market card with its bet form, and the new-market form. Mounted by
 * `debate-webview`'s `/practice/predictions` route.
 *
 * @module debate-predictions/ui
 */

export { PredictionMarketsPanel } from "./PredictionMarketsPanel";
export { FeaturedMarkets, type FeaturedMarketsProps } from "./FeaturedMarkets";
export { MarketCard, inputClass, type MarketCardProps } from "./MarketCard";
export { NewMarketForm } from "./NewMarketForm";
