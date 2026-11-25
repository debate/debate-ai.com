/**
 * @fileoverview Public entry for the page flow chart: the watch page's
 * argument mind map drawn from one written page (the docs toolbar's
 * "Flow chart" button). Import as `@debate-ai/videos/page-flow-chart`.
 * @module page-flow-chart
 */
export { PageFlowChartButton, type PageFlowChartButtonProps } from "./components/videos/watch/flow-chart/PageFlowChartButton";
export {
  DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS,
  buildPageFlowChartPrompt,
  pageFlowChartSections,
  type PageFlowChartSection,
} from "./lib/page-flow-chart";
