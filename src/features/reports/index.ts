export type { ReportData, ReportEntry, ReportFilters } from './domain/report-data';
export { collectEntries, monthsOf } from './domain/report-data';
export type { ReportCell, ReportColumn, ReportRow, ReportTable } from './domain/report-table';
export {
  buildReport,
  computeIndicators,
  FUTURE_MONTHS,
  REPORT_INFO,
  REPORT_KINDS,
  type ReportIndicators,
  type ReportKind,
} from './domain/reports';
export {
  LoadReportDataUseCase,
  type ReportsContext,
  type ReportSnapshot,
} from './application/load-report-data';
export {
  ReportsServicesContext,
  useReportsServices,
  type ReportsServices,
} from './presentation/context/reports-context';
export * from './presentation/hooks/use-reports';
