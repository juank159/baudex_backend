import { Injectable } from '@nestjs/common';

export interface AuditLog {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private logs: AuditLog[] = [];

  log(auditData: Omit<AuditLog, 'timestamp'>): void {
    const auditLog: AuditLog = {
      ...auditData,
      timestamp: new Date(),
    };

    this.logs.push(auditLog);

    // En producción, esto debería guardar en base de datos
    console.log('Audit Log:', auditLog);
  }

  getLogs(entityId?: string, userId?: string): AuditLog[] {
    let filteredLogs = this.logs;

    if (entityId) {
      filteredLogs = filteredLogs.filter((log) => log.entityId === entityId);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === userId);
    }

    return filteredLogs.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }
}
