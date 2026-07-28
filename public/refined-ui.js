const analysisGrid = document.querySelector(".analysis-grid");
const dayBreakdowns = document.querySelector(".day-breakdowns");

if (analysisGrid && dayBreakdowns) {
  analysisGrid.insertAdjacentElement("afterend", dayBreakdowns);
  dayBreakdowns.classList.add("panel", "day-breakdowns-surface");
}
