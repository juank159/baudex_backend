// src/modules/dashboard/interfaces/reports.interfaces.ts

export interface ReportData {
  title: string;
  description: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: any;
  details: any[];
  charts?: any[];
  metadata: {
    generatedAt: Date;
    generatedBy: string;
    format: string;
  };
}

export interface ReportSummary {
  [key: string]: any;
}

export interface ReportDetails {
  [key: string]: any;
}

export interface ReportChart {
  type: string;
  title: string;
  data: any[];
  options?: any;
}

export interface ReportMetadata {
  generatedAt: Date;
  generatedBy: string;
  format: string;
  version?: string;
  filters?: any;
}
